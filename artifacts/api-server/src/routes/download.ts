import { Router } from "express";
import {
  detectPlatform,
  submitDownload,
  getJob,
  getHistory,
  getPublicStats,
} from "../lib/downloadEngine.js";
import { DetectPlatformQueryParams, SubmitDownloadBody } from "@workspace/api-zod";

const router = Router();

const ipRateMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimitPerMinute() { return 30; }

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= getRateLimitPerMinute()) return false;
  entry.count++;
  return true;
}

function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch { return null; }
}

function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const mimeMap: Record<string, string> = {
    mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo",
    mkv: "video/x-matroska", webm: "video/webm", flv: "video/x-flv",
    m4v: "video/mp4", "3gp": "video/3gpp",
    mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac",
    ogg: "audio/ogg", wav: "audio/wav", flac: "audio/flac",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", heic: "image/heic",
    pdf: "application/pdf", zip: "application/zip",
  };
  return mimeMap[ext] || "application/octet-stream";
}

function getMimeTypeFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const ext = pathname.toLowerCase().split(".").pop() || "";
    return getMimeTypeFromFilename(`file.${ext}`);
  } catch { return ""; }
}

router.get("/detect", (req, res) => {
  const parsed = DetectPlatformQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Missing url parameter" }); return; }
  const cleanUrl = sanitizeUrl(parsed.data.url);
  if (!cleanUrl) { res.status(400).json({ error: "Invalid URL" }); return; }
  const result = detectPlatform(cleanUrl);
  res.json({ platform: result.platform, contentType: result.contentType, valid: result.valid, title: null, thumbnail: null });
});

router.post("/download", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket?.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: "Rate limit exceeded. Please wait before making more requests." });
    return;
  }

  const parsed = SubmitDownloadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const { url, quality = "auto", format = "auto" } = parsed.data;
  const cleanUrl = sanitizeUrl(url);
  if (!cleanUrl) { res.status(400).json({ error: "Invalid or unsafe URL" }); return; }

  const detection = detectPlatform(cleanUrl);
  if (!detection.valid) {
    res.status(400).json({ error: "Unsupported platform. Supported: TikTok, YouTube, Pinterest, Spotify, Instagram, Facebook, Twitter/X." });
    return;
  }

  try {
    const job = await submitDownload(
      cleanUrl,
      quality as "auto" | "hd" | "sd" | "low" | "audio_only" | "360p" | "720p" | "1080p" | "4k",
      format as "mp4" | "mp3" | "auto",
      ip
    );
    res.status(202).json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process download";
    res.status(400).json({ error: message });
  }
});

router.get("/download/:jobId", (req, res) => {
  const { jobId } = req.params;
  if (!jobId || typeof jobId !== "string") { res.status(400).json({ error: "Invalid job ID" }); return; }
  const job = getJob(jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

router.get("/history", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || "20", 10), 100);
  const history = await getHistory(limit);
  res.json(history);
});

router.get("/stats/public", async (_req, res) => {
  const stats = await getPublicStats();
  res.json(stats);
});

router.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  const filename = (req.query.filename as string) || "download";

  if (!targetUrl) { res.status(400).json({ error: "url required" }); return; }

  let cleanUrl: string;
  try {
    const parsed = new URL(decodeURIComponent(targetUrl));
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
    cleanUrl = parsed.href;
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    const upstream = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Encoding": "identity",
        "Referer": (() => { try { return new URL(cleanUrl).origin; } catch { return ""; } })(),
      },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
      return;
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9._\-\s()]/g, "_").slice(0, 200);

    // iOS fix: detect MIME from filename first, then from URL, then from upstream header
    // Never use application/octet-stream blindly — it causes .bin files on iOS
    const upstreamCt = upstream.headers.get("content-type") || "";
    const filenameExt = safeFilename.includes(".") ? safeFilename.split(".").pop()?.toLowerCase() || "" : "";
    const mimeFromFilename = filenameExt ? getMimeTypeFromFilename(`file.${filenameExt}`) : "";
    const mimeFromUrl = getMimeTypeFromUrl(cleanUrl);

    let finalMime: string;
    if (mimeFromFilename && mimeFromFilename !== "application/octet-stream") {
      finalMime = mimeFromFilename;
    } else if (upstreamCt && !upstreamCt.includes("octet-stream") && !upstreamCt.includes("binary")) {
      finalMime = upstreamCt.split(";")[0].trim();
    } else if (mimeFromUrl && mimeFromUrl !== "application/octet-stream") {
      finalMime = mimeFromUrl;
    } else if (upstreamCt && upstreamCt !== "") {
      finalMime = upstreamCt.split(";")[0].trim();
    } else {
      finalMime = "video/mp4";
    }

    // Ensure filename has correct extension
    let finalFilename = safeFilename;
    if (!finalFilename.includes(".") || finalFilename.endsWith("_")) {
      const extMap: Record<string, string> = { "video/mp4": ".mp4", "video/quicktime": ".mov", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp" };
      finalFilename += extMap[finalMime] || ".mp4";
    }

    const contentLength = upstream.headers.get("content-length");

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(finalFilename)}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`);
    res.setHeader("Content-Type", finalMime);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    if (!upstream.body) { res.status(500).json({ error: "No response body" }); return; }

    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.writable) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    await pump();
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: "Failed to proxy download. The media link may have expired." });
    else res.end();
  }
});

export { router as downloadRouter };
