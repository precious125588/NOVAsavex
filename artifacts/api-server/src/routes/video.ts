import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import crypto from "crypto";
import { logger } from "../lib/logger.js";

const router = Router();

const UPLOAD_DIR = "/tmp/novasave-uploads";
const OUTPUT_DIR = "/tmp/novasave-output";
[UPLOAD_DIR, OUTPUT_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(mp4|mov|avi|mkv|webm|flv|m4v|mp3|wav|aac|ogg|m4a)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

const downloadStore = new Map<string, { filePath: string; filename: string; createdAt: number }>();

function cleanupOldFiles() {
  const now = Date.now();
  for (const [id, entry] of downloadStore) {
    if (now - entry.createdAt > 2 * 60 * 60 * 1000) {
      try { fs.unlinkSync(entry.filePath); } catch { }
      downloadStore.delete(id);
    }
  }
}
setInterval(cleanupOldFiles, 30 * 60 * 1000);

function runFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { timeout: 10 * 60 * 1000 });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => { stdout += d.toString(); });
    proc.stderr.on("data", d => { stderr += d.toString(); });
    proc.on("close", code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
    proc.on("error", reject);
  });
}

function getFFmpegQualityArgs(quality: string, isAudio: boolean): string[] {
  if (isAudio) return ["-vn", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
  switch (quality) {
    case "4k": case "max":
      return ["-vf", "scale=-2:2160:flags=lanczos,unsharp=5:5:1.0:3:3:0.0", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k"];
    case "1080p":
      return ["-vf", "scale=-2:1080:flags=lanczos", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"];
    case "720p":
      return ["-vf", "scale=-2:720:flags=lanczos", "-c:v", "libx264", "-crf", "20", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k"];
    case "480p":
      return ["-vf", "scale=-2:480:flags=lanczos", "-c:v", "libx264", "-crf", "23", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k"];
    case "copy": default:
      return ["-c", "copy"];
  }
}

async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", filePath]);
    let out = "";
    proc.stdout.on("data", d => { out += d.toString(); });
    proc.on("close", () => {
      try { resolve(parseFloat((JSON.parse(out) as { format?: { duration?: string } }).format?.duration || "0") || 0); }
      catch { resolve(0); }
    });
    proc.on("error", () => resolve(0));
  });
}

async function downloadUrlToFile(url: string, ext = ".mp4"): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NOVAsavex/1.0)" },
    });
    if (!resp.ok) throw new Error(`Remote ${resp.status}`);
    const dest = path.join(UPLOAD_DIR, `url_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`);
    fs.writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
    return dest;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveInput(req: Request): Promise<{ inputPath: string; baseName: string } | null> {
  if (req.file) {
    return { inputPath: req.file.path, baseName: path.parse(req.file.originalname).name };
  }
  if (req.body.sourceUrl) {
    const rawUrl = req.body.sourceUrl as string;
    const ext = rawUrl.split("?")[0].match(/\.(mp4|mov|avi|mkv|webm|mp3|m4a)$/i)?.[0] || ".mp4";
    const inputPath = await downloadUrlToFile(rawUrl, ext);
    return { inputPath, baseName: "source" };
  }
  return null;
}

router.post("/video/trim", upload.single("file"), async (req: Request, res: Response) => {
  let input: { inputPath: string; baseName: string } | null = null;
  try { input = await resolveInput(req); } catch (err) {
    res.status(400).json({ error: `Could not load source: ${err instanceof Error ? err.message : String(err)}` }); return;
  }
  if (!input) { res.status(400).json({ error: "Provide a file upload or sourceUrl" }); return; }

  const { inputPath, baseName } = input;
  const startTime = parseFloat((req.body.startTime as string) || "0");
  const endTime   = parseFloat((req.body.endTime   as string) || "0");
  const quality   = (req.body.quality as string) || "copy";
  const isAudio   = quality === "audio";
  const outputExt = isAudio ? ".mp3" : ".mp4";

  if (isNaN(startTime) || isNaN(endTime) || endTime <= startTime) {
    try { fs.unlinkSync(inputPath); } catch { }
    res.status(400).json({ error: "Invalid start/end times" }); return;
  }

  const duration       = endTime - startTime;
  const outputId       = `trim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const outputPath     = path.join(OUTPUT_DIR, `${outputId}${outputExt}`);
  const outputFilename = `${baseName}_trim_${Math.round(startTime)}s-${Math.round(endTime)}s${outputExt}`;

  try {
    await runFFmpeg(["-y", "-ss", String(startTime), "-i", inputPath, "-t", String(duration), ...getFFmpegQualityArgs(quality, isAudio), "-avoid_negative_ts", "make_zero", outputPath]);
    try { fs.unlinkSync(inputPath); } catch { }
    downloadStore.set(outputId, { filePath: outputPath, filename: outputFilename, createdAt: Date.now() });
    const stat = fs.statSync(outputPath);
    res.json({ downloadId: outputId, filename: outputFilename, fileSize: stat.size, duration: Math.round(duration * 100) / 100 });
  } catch (err) {
    logger.error({ err }, "FFmpeg trim failed");
    try { fs.unlinkSync(inputPath); } catch { }
    try { fs.unlinkSync(outputPath); } catch { }
    res.status(500).json({ error: "Trim failed. Try a different quality or file." });
  }
});

router.post("/video/split", upload.single("file"), async (req: Request, res: Response) => {
  let input: { inputPath: string; baseName: string } | null = null;
  try { input = await resolveInput(req); } catch (err) {
    res.status(400).json({ error: `Could not load source: ${err instanceof Error ? err.message : String(err)}` }); return;
  }
  if (!input) { res.status(400).json({ error: "Provide a file upload or sourceUrl" }); return; }

  const { inputPath, baseName } = input;
  const splitPointsRaw = (req.body.splitPoints as string) || "";
  const quality  = (req.body.quality as string) || "copy";
  const isAudio  = quality === "audio";
  const outputExt = isAudio ? ".mp3" : ".mp4";

  const splitPoints = splitPointsRaw.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);
  if (splitPoints.length === 0) {
    try { fs.unlinkSync(inputPath); } catch { }
    res.status(400).json({ error: "No valid split points" }); return;
  }

  try {
    const totalDuration = await getVideoDuration(inputPath);
    const segs: { s: number; e: number }[] = [];
    let prev = 0;
    for (const pt of splitPoints) {
      if (pt > 0 && pt < totalDuration) { segs.push({ s: prev, e: pt }); prev = pt; }
    }
    segs.push({ s: prev, e: totalDuration });

    const results: Array<{ downloadId: string; filename: string; fileSize: number; startTime: number; endTime: number }> = [];
    const qArgs = getFFmpegQualityArgs(quality, isAudio);

    for (let i = 0; i < segs.length; i++) {
      const { s, e } = segs[i];
      const segId   = `seg_${Date.now()}_${i}_${crypto.randomBytes(3).toString("hex")}`;
      const segPath = path.join(OUTPUT_DIR, `${segId}${outputExt}`);
      const segFile = `${baseName}_part${i + 1}${outputExt}`;
      await runFFmpeg(["-y", "-ss", String(s), "-i", inputPath, "-t", String(e - s), ...qArgs, "-avoid_negative_ts", "make_zero", segPath]);
      const stat = fs.statSync(segPath);
      downloadStore.set(segId, { filePath: segPath, filename: segFile, createdAt: Date.now() });
      results.push({ downloadId: segId, filename: segFile, fileSize: stat.size, startTime: s, endTime: e });
    }
    try { fs.unlinkSync(inputPath); } catch { }
    res.json({ segments: results, totalSegments: results.length });
  } catch (err) {
    logger.error({ err }, "FFmpeg split failed");
    try { fs.unlinkSync(inputPath); } catch { }
    res.status(500).json({ error: "Split failed. Try a different file." });
  }
});

router.post("/video/enhance", upload.single("file"), async (req: Request, res: Response) => {
  let input: { inputPath: string; baseName: string } | null = null;
  try { input = await resolveInput(req); } catch (err) {
    res.status(400).json({ error: `Could not load source: ${err instanceof Error ? err.message : String(err)}` }); return;
  }
  if (!input) { res.status(400).json({ error: "Provide a file upload or sourceUrl" }); return; }

  const { inputPath, baseName } = input;
  const targetQuality  = (req.body.quality as string) || "1080p";
  const outputId       = `enhance_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const outputPath     = path.join(OUTPUT_DIR, `${outputId}.mp4`);
  const outputFilename = `${baseName}_enhanced_${targetQuality}.mp4`;

  try {
    await runFFmpeg(["-y", "-i", inputPath, ...getFFmpegQualityArgs(targetQuality, false), outputPath]);
    try { fs.unlinkSync(inputPath); } catch { }
    const stat = fs.statSync(outputPath);
    downloadStore.set(outputId, { filePath: outputPath, filename: outputFilename, createdAt: Date.now() });
    res.json({ downloadId: outputId, filename: outputFilename, fileSize: stat.size });
  } catch (err) {
    logger.error({ err }, "FFmpeg enhance failed");
    try { fs.unlinkSync(inputPath); } catch { }
    try { fs.unlinkSync(outputPath); } catch { }
    res.status(500).json({ error: "Enhancement failed. Try a different quality." });
  }
});

router.post("/video/extract-audio", upload.single("file"), async (req: Request, res: Response) => {
  let input: { inputPath: string; baseName: string } | null = null;
  try { input = await resolveInput(req); } catch (err) {
    res.status(400).json({ error: `Could not load source: ${err instanceof Error ? err.message : String(err)}` }); return;
  }
  if (!input) { res.status(400).json({ error: "Provide a file upload or sourceUrl" }); return; }

  const { inputPath, baseName } = input;
  const format = ((req.body.format as string) || "mp3").toLowerCase();
  const outputId   = `audio_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const outputPath = path.join(OUTPUT_DIR, `${outputId}.${format}`);
  const outputFile = `${baseName}_audio.${format}`;

  try {
    const codecArgs = format === "aac" ? ["-c:a", "aac", "-b:a", "256k"] : ["-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100"];
    await runFFmpeg(["-y", "-i", inputPath, "-vn", ...codecArgs, outputPath]);
    try { fs.unlinkSync(inputPath); } catch { }
    const stat = fs.statSync(outputPath);
    downloadStore.set(outputId, { filePath: outputPath, filename: outputFile, createdAt: Date.now() });
    res.json({ downloadId: outputId, filename: outputFile, fileSize: stat.size });
  } catch (err) {
    logger.error({ err }, "Audio extract failed");
    try { fs.unlinkSync(inputPath); } catch { }
    try { fs.unlinkSync(outputPath); } catch { }
    res.status(500).json({ error: "Audio extraction failed." });
  }
});

router.get("/video/download/:id", (req: Request, res: Response) => {
  const id = String(req.params.id);
  const entry = downloadStore.get(id);
  if (!entry) { res.status(404).json({ error: "File not found or expired" }); return; }
  if (!fs.existsSync(entry.filePath)) { downloadStore.delete(id); res.status(404).json({ error: "File expired" }); return; }
  const ext = path.extname(entry.filePath).toLowerCase();
  const ct = ext === ".mp3" ? "audio/mpeg" : ext === ".aac" ? "audio/aac" : "video/mp4";
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(entry.filename)}"`);
  res.setHeader("Content-Type", ct);
  res.setHeader("Content-Length", fs.statSync(entry.filePath).size);
  const stream = fs.createReadStream(entry.filePath);
  stream.pipe(res);
  stream.on("error", () => res.status(500).end());
});

export { router as videoRouter };
