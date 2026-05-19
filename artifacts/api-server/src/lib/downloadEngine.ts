import crypto from "crypto";
import { db } from "@workspace/db";
import { downloadsTable, errorLogsTable } from "@workspace/db";
import { eq, desc, gte, sql } from "drizzle-orm";
import { logger } from "./logger.js";

export type Platform = "tiktok" | "youtube" | "pinterest" | "spotify" | "instagram" | "facebook" | "twitter" | "unknown";
export type ContentType = "video" | "audio" | "image" | "playlist" | "shorts" | "reels" | "pin" | "song" | "unknown";
export type JobStatus = "pending" | "processing" | "ready" | "failed";
export type Quality = "auto" | "hd" | "sd" | "low" | "audio_only" | "360p" | "720p" | "1080p" | "4k";
export type Format = "mp4" | "mp3" | "auto";

export interface MediaItem {
  url: string;
  quality: string;
  format: string;
  label: string;
  fileSize?: number | null;
}

export interface DownloadJob {
  jobId: string;
  status: JobStatus;
  url: string;
  platform: Platform;
  contentType: ContentType;
  title?: string | null;
  thumbnail?: string | null;
  author?: string | null;
  duration?: number | null;
  mediaItems: MediaItem[];
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
  retryCount: number;
  apiUsed?: string | null;
}

interface ApiConfig {
  name: string;
  platform: Platform;
  enabled: boolean;
  priority: number;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
}

interface PlatformCfg {
  enabled: boolean;
  apiPriority: string[];
}

interface AppConfig {
  tiktok: PlatformCfg;
  youtube: PlatformCfg;
  pinterest: PlatformCfg;
  spotify: PlatformCfg;
  instagram: PlatformCfg;
  facebook: PlatformCfg;
  twitter: PlatformCfg;
  rateLimitPerMinute: number;
  cacheExpiryMinutes: number;
}

const jobStore = new Map<string, DownloadJob>();
const cache = new Map<string, { result: DownloadJob; expiresAt: number }>();
const processingQueue: Set<string> = new Set();

const DAVID = "https://apis.davidcyril.name.ng";
const PREX = "https://apis.prexzyvilla.site";

let appConfig: AppConfig = {
  tiktok: {
    enabled: true,
    apiPriority: ["prexzyvilla-tiktokV3", "prexzyvilla-tiktok", "prexzyvilla-tiktokV2", "davidcyril-tiktok", "prexzyvilla-aio"],
  },
  youtube: {
    enabled: true,
    apiPriority: ["prexzyvilla-ytdownload", "davidcyril-youtube", "prexzyvilla-ytinfo", "prexzyvilla-aio", "davidcyril-aio"],
  },
  pinterest: {
    enabled: true,
    apiPriority: ["prexzyvilla-pinterestV2", "davidcyril-pinterest", "prexzyvilla-pinterest", "prexzyvilla-aio", "davidcyril-aio"],
  },
  spotify: {
    enabled: true,
    apiPriority: ["api-spotifydown", "prexzyvilla-spotify", "davidcyril-spotify", "fabdl", "prexzyvilla-aio"],
  },
  instagram: {
    enabled: true,
    apiPriority: ["prexzyvilla-instagram", "prexzyvilla-ig2", "davidcyril-instagram", "prexzyvilla-aio"],
  },
  facebook: {
    enabled: true,
    apiPriority: ["prexzyvilla-facebook", "prexzyvilla-facebookv2", "davidcyril-facebook", "prexzyvilla-aio"],
  },
  twitter: {
    enabled: true,
    apiPriority: ["prexzyvilla-twitter", "davidcyril-twitter", "prexzyvilla-aio"],
  },
  rateLimitPerMinute: 20,
  cacheExpiryMinutes: 30,
};

const apiStats = new Map<string, ApiConfig>();

function initApiStats() {
  const apis: Array<{ name: string; platform: Platform }> = [
    { name: "prexzyvilla-tiktokV3", platform: "tiktok" },
    { name: "prexzyvilla-tiktok", platform: "tiktok" },
    { name: "prexzyvilla-tiktokV2", platform: "tiktok" },
    { name: "davidcyril-tiktok", platform: "tiktok" },
    { name: "prexzyvilla-ytdownload", platform: "youtube" },
    { name: "prexzyvilla-ytinfo", platform: "youtube" },
    { name: "davidcyril-youtube", platform: "youtube" },
    { name: "prexzyvilla-pinterestV2", platform: "pinterest" },
    { name: "prexzyvilla-pinterest", platform: "pinterest" },
    { name: "davidcyril-pinterest", platform: "pinterest" },
    { name: "prexzyvilla-aio", platform: "unknown" },
    { name: "davidcyril-aio", platform: "unknown" },
    { name: "api-spotifydown", platform: "spotify" },
    { name: "prexzyvilla-spotify", platform: "spotify" },
    { name: "davidcyril-spotify", platform: "spotify" },
    { name: "fabdl", platform: "spotify" },
    { name: "prexzyvilla-instagram", platform: "instagram" },
    { name: "prexzyvilla-ig2", platform: "instagram" },
    { name: "davidcyril-instagram", platform: "instagram" },
    { name: "prexzyvilla-facebook", platform: "facebook" },
    { name: "prexzyvilla-facebookv2", platform: "facebook" },
    { name: "davidcyril-facebook", platform: "facebook" },
    { name: "prexzyvilla-twitter", platform: "twitter" },
    { name: "davidcyril-twitter", platform: "twitter" },
  ];
  for (const api of apis) {
    apiStats.set(api.name, { ...api, enabled: true, priority: 0, totalCalls: 0, successCalls: 0, failureCalls: 0 });
  }
}
initApiStats();

export function getAppConfig(): AppConfig {
  return { ...appConfig };
}

export function updateAppConfig(update: Partial<AppConfig>): AppConfig {
  appConfig = { ...appConfig, ...update };
  return appConfig;
}

export function getApiStats(): ApiConfig[] {
  return Array.from(apiStats.values());
}

function getCacheKey(url: string, quality: string, format: string): string {
  return crypto.createHash("sha256").update(`${url}:${quality}:${format}`).digest("hex");
}

function getFromCache(key: string): DownloadJob | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.result;
}

function setCache(key: string, result: DownloadJob): void {
  const expiryMs = appConfig.cacheExpiryMinutes * 60 * 1000;
  cache.set(key, { result, expiresAt: Date.now() + expiryMs });
}

export function detectPlatform(url: string): { platform: Platform; contentType: ContentType; valid: boolean } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (hostname.includes("tiktok.com") || hostname.includes("vm.tiktok.com") || hostname.includes("vt.tiktok.com")) {
      const contentType: ContentType = pathname.includes("/music/") ? "audio" : "video";
      return { platform: "tiktok", contentType, valid: true };
    }

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be") || hostname.includes("yt.be")) {
      let contentType: ContentType = "video";
      const q = parsed.searchParams;
      if (q.get("list")) contentType = "playlist";
      else if (pathname.includes("/shorts/")) contentType = "shorts";
      return { platform: "youtube", contentType, valid: true };
    }

    if (hostname.includes("pinterest.com") || hostname.includes("pin.it") || hostname.includes("pinterest.co")) {
      const contentType: ContentType = pathname.includes("/pin/") ? "pin" : "image";
      return { platform: "pinterest", contentType, valid: true };
    }

    if (hostname.includes("spotify.com") || hostname.includes("open.spotify.com")) {
      let contentType: ContentType = "song";
      if (pathname.includes("/album/")) contentType = "playlist";
      else if (pathname.includes("/playlist/")) contentType = "playlist";
      return { platform: "spotify", contentType, valid: true };
    }

    if (hostname.includes("instagram.com") || hostname.includes("instagr.am")) {
      const contentType: ContentType = pathname.includes("/reel/") ? "reels" : "video";
      return { platform: "instagram", contentType, valid: true };
    }

    if (hostname.includes("facebook.com") || hostname.includes("fb.watch") || hostname.includes("fb.com")) {
      return { platform: "facebook", contentType: "video", valid: true };
    }

    if (hostname.includes("twitter.com") || hostname.includes("x.com") || hostname.includes("t.co")) {
      return { platform: "twitter", contentType: "video", valid: true };
    }

    return { platform: "unknown", contentType: "unknown", valid: false };
  } catch {
    return { platform: "unknown", contentType: "unknown", valid: false };
  }
}

function generateJobId(): string {
  return `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

async function fetchWithTimeout(url: string, timeoutMs = 20000, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        ...extraHeaders,
      }
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

function recordApiCall(apiName: string, success: boolean) {
  const stat = apiStats.get(apiName);
  if (stat) {
    stat.totalCalls++;
    if (success) stat.successCalls++;
    else stat.failureCalls++;
  }
}

function safeStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function safeRecord(v: unknown): Record<string, unknown> {
  return (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {};
}

function safeArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

async function tryTikTokApis(url: string, _quality: Quality): Promise<{ mediaItems: MediaItem[]; title?: string; thumbnail?: string; author?: string; duration?: number; apiUsed: string }> {
  const apis = appConfig.tiktok.apiPriority.filter(name => apiStats.get(name)?.enabled !== false);

  for (const apiName of apis) {
    try {
      let apiUrl = "";
      if (apiName === "prexzyvilla-tiktokV3") apiUrl = `${PREX}/download/tiktokV3?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-tiktok") apiUrl = `${PREX}/download/tiktok?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-tiktokV2") apiUrl = `${PREX}/download/tiktokV2?url=${encodeURIComponent(url)}`;
      else if (apiName === "davidcyril-tiktok") apiUrl = `${DAVID}/download/tiktok?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-aio") apiUrl = `${PREX}/download/aio?url=${encodeURIComponent(url)}`;
      else continue;

      const resp = await fetchWithTimeout(apiUrl, 25000);
      if (!resp.ok) { recordApiCall(apiName, false); continue; }
      const data = await resp.json() as Record<string, unknown>;
      recordApiCall(apiName, true);

      const mediaItems: MediaItem[] = [];
      const d = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
      const title = safeStr(data.title) || safeStr(d.title);
      const thumbnail = safeStr(data.thumbnail) || safeStr(data.cover) || safeStr(d.thumbnail) || safeStr(d.cover);
      const author = safeStr(data.author) || safeStr(d.author) || safeStr(d.author_nickname) || safeStr(d.nickname);

      if (safeStr(d.hdplay)) mediaItems.push({ url: d.hdplay as string, quality: "hd", format: "mp4", label: "HD Video (Best Quality)" });
      if (safeStr(d.play)) mediaItems.push({ url: d.play as string, quality: "hd", format: "mp4", label: "HD Video (No Watermark)" });
      if (safeStr(d.wmplay)) mediaItems.push({ url: d.wmplay as string, quality: "sd", format: "mp4", label: "SD Video (With Watermark)" });
      if (safeStr(d.music)) mediaItems.push({ url: d.music as string, quality: "audio", format: "mp3", label: "Audio / Music Track" });
      if (safeStr(data.url as string)) mediaItems.push({ url: data.url as string, quality: "hd", format: "mp4", label: "HD Video" });

      const images = safeArray(d.images).concat(safeArray(data.images));
      images.forEach((img, i) => {
        if (typeof img === "string" && img) {
          mediaItems.push({ url: img, quality: "original", format: "jpg", label: `Image ${i + 1}` });
        }
      });

      if (mediaItems.length === 0) { recordApiCall(apiName, false); continue; }
      return { mediaItems, title, thumbnail, author, apiUsed: apiName };
    } catch (err) {
      logger.warn({ err, apiName }, "TikTok API failed");
      recordApiCall(apiName, false);
    }
  }
  throw new Error("All TikTok APIs failed. Please try again later.");
}

async function tryYouTubeApis(url: string, quality: Quality, format: Format): Promise<{ mediaItems: MediaItem[]; title?: string; thumbnail?: string; author?: string; duration?: number; apiUsed: string }> {
  const apis = appConfig.youtube.apiPriority.filter(name => apiStats.get(name)?.enabled !== false);

  for (const apiName of apis) {
    try {
      let data: Record<string, unknown> = {};
      if (apiName === "prexzyvilla-ytdownload") {
        const isAudio = quality === "audio_only" || format === "mp3";
        const ytQuality = quality === "4k" ? "1080" : quality === "1080p" ? "1080" : quality === "720p" ? "720" : quality === "360p" ? "360" : isAudio ? "audio" : "720";
        const ytFormat = isAudio ? "mp3" : "mp4";
        const ytType = isAudio ? "audio" : "video";
        const apiUrl = `${PREX}/download/ytdownload?url=${encodeURIComponent(url)}&type=${ytType}&format=${ytFormat}&quality=${ytQuality}`;
        const resp = await fetchWithTimeout(apiUrl, 35000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        data = await resp.json() as Record<string, unknown>;
        recordApiCall(apiName, true);
      } else if (apiName === "davidcyril-youtube") {
        const isAudio = quality === "audio_only" || format === "mp3";
        const apiUrl = isAudio
          ? `${DAVID}/download/ytmp3?url=${encodeURIComponent(url)}`
          : `${DAVID}/download/ytmp4?url=${encodeURIComponent(url)}`;
        const resp = await fetchWithTimeout(apiUrl, 35000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        data = await resp.json() as Record<string, unknown>;
        recordApiCall(apiName, true);
      } else if (apiName === "prexzyvilla-ytinfo") {
        const resp = await fetchWithTimeout(`${PREX}/download/ytinfo?url=${encodeURIComponent(url)}`, 25000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        data = await resp.json() as Record<string, unknown>;
        recordApiCall(apiName, true);
      } else if (apiName === "prexzyvilla-aio") {
        const resp = await fetchWithTimeout(`${PREX}/download/aio?url=${encodeURIComponent(url)}`, 25000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        data = await resp.json() as Record<string, unknown>;
        recordApiCall(apiName, true);
      } else if (apiName === "davidcyril-aio") {
        const resp = await fetchWithTimeout(`${DAVID}/download/aiov2?url=${encodeURIComponent(url)}`, 25000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        data = await resp.json() as Record<string, unknown>;
        recordApiCall(apiName, true);
      } else continue;

      const mediaItems: MediaItem[] = [];
      const info = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
      const title = safeStr(info.title) || safeStr(data.title);
      const thumbnail = safeStr(info.thumbnail) || safeStr(data.thumbnail);
      const author = safeStr(info.channel) || safeStr(info.author) || safeStr(data.author) || safeStr(info.uploader);
      const duration = typeof info.duration === "number" ? info.duration : undefined;

      // Direct URL
      if (safeStr(info.url)) {
        const isAudio = quality === "audio_only" || format === "mp3";
        const fmt = isAudio ? "mp3" : "mp4";
        mediaItems.push({ url: info.url as string, quality: quality === "auto" ? "720p" : quality, format: fmt, label: `${quality === "auto" ? "720p" : quality} ${fmt.toUpperCase()}` });
      }

      // Formats array
      if (Array.isArray(info.formats)) {
        (info.formats as Record<string, unknown>[]).forEach(f => {
          const fUrl = safeStr(f.url);
          const fQuality = safeStr(f.quality_label) || safeStr(f.quality) || safeStr(f.resolution) || "auto";
          const fFormat = safeStr(f.ext) || (safeStr(f.mimeType)?.includes("audio") ? "mp3" : "mp4");
          if (fUrl && !mediaItems.find(m => m.url === fUrl)) {
            mediaItems.push({ url: fUrl, quality: fQuality, format: fFormat, label: `${fQuality} ${fFormat.toUpperCase()}` });
          }
        });
      }

      // Fallback fields
      if (safeStr(info.mp4 as string) && !mediaItems.find(m => m.url === info.mp4)) {
        mediaItems.push({ url: info.mp4 as string, quality: "720p", format: "mp4", label: "720p MP4" });
      }
      const audioUrl = safeStr(info.mp3 as string) || safeStr((info as Record<string, unknown>).audio as string);
      if (audioUrl && !mediaItems.find(m => m.url === audioUrl)) {
        mediaItems.push({ url: audioUrl, quality: "audio", format: "mp3", label: "Audio MP3" });
      }
      // DavidCyril/prexzyvilla specific fields
      const videoUrl = safeStr(data.download as string) || safeStr(data.link as string) || safeStr(data.url as string);
      if (videoUrl && !mediaItems.find(m => m.url === videoUrl)) {
        const ext = videoUrl.includes(".mp3") ? "mp3" : "mp4";
        mediaItems.push({ url: videoUrl, quality: quality === "auto" ? "720p" : quality, format: ext, label: `Video ${ext.toUpperCase()}` });
      }

      if (mediaItems.length === 0) { recordApiCall(apiName, false); continue; }
      return { mediaItems, title, thumbnail, author, duration, apiUsed: apiName };
    } catch (err) {
      logger.warn({ err, apiName }, "YouTube API failed");
      recordApiCall(apiName, false);
    }
  }
  throw new Error("All YouTube APIs failed. Please try again later.");
}

async function tryPinterestApis(url: string): Promise<{ mediaItems: MediaItem[]; title?: string; thumbnail?: string; apiUsed: string }> {
  const apis = appConfig.pinterest.apiPriority.filter(name => apiStats.get(name)?.enabled !== false);

  for (const apiName of apis) {
    try {
      let apiUrl = "";
      if (apiName === "prexzyvilla-pinterestV2") apiUrl = `${PREX}/download/pinterestV2?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-pinterest") apiUrl = `${PREX}/download/pinterest?url=${encodeURIComponent(url)}`;
      else if (apiName === "davidcyril-pinterest") apiUrl = `${DAVID}/download/pinterest?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-aio") apiUrl = `${PREX}/download/aio?url=${encodeURIComponent(url)}`;
      else if (apiName === "davidcyril-aio") apiUrl = `${DAVID}/download/aiov2?url=${encodeURIComponent(url)}`;
      else continue;

      const resp = await fetchWithTimeout(apiUrl, 25000);
      if (!resp.ok) { recordApiCall(apiName, false); continue; }
      const data = await resp.json() as Record<string, unknown>;
      recordApiCall(apiName, true);

      const mediaItems: MediaItem[] = [];
      const d = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
      const title = safeStr(d.title) || safeStr(data.title) || "Pinterest Media";
      const imgUrl = safeStr(d.url as string) || safeStr(d.media_url as string) || safeStr(data.url as string) || safeStr(d.image as string);
      const videoUrl = safeStr(d.video_url as string) || safeStr(d.video as string) ||
        safeStr((safeRecord(d.videos) as Record<string, string>)?.["720p"]) ||
        safeStr((safeRecord(d.videos) as Record<string, string>)?.["1080p"]);

      if (videoUrl) mediaItems.push({ url: videoUrl, quality: "hd", format: "mp4", label: "Video" });
      if (imgUrl && !mediaItems.find(m => m.url === imgUrl)) {
        const ext = imgUrl.includes(".png") ? "png" : imgUrl.includes(".gif") ? "gif" : "jpg";
        mediaItems.push({ url: imgUrl, quality: "original", format: ext, label: "Original Image" });
      }
      const images = safeArray(d.images);
      images.forEach((img, i) => {
        if (typeof img === "string" && img && !mediaItems.find(m => m.url === img)) {
          mediaItems.push({ url: img, quality: "original", format: "jpg", label: `Image ${i + 1}` });
        }
      });

      if (mediaItems.length === 0) { recordApiCall(apiName, false); continue; }
      return { mediaItems, title, thumbnail: imgUrl || undefined, apiUsed: apiName };
    } catch (err) {
      logger.warn({ err, apiName }, "Pinterest API failed");
      recordApiCall(apiName, false);
    }
  }
  throw new Error("All Pinterest APIs failed. Please try again later.");
}

async function tryInstagramApis(url: string): Promise<{ mediaItems: MediaItem[]; title?: string; thumbnail?: string; author?: string; apiUsed: string }> {
  const apis = appConfig.instagram.apiPriority.filter(name => apiStats.get(name)?.enabled !== false);

  for (const apiName of apis) {
    try {
      let apiUrl = "";
      if (apiName === "prexzyvilla-instagram") apiUrl = `${PREX}/download/instagram?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-ig2") apiUrl = `${PREX}/download/ig2?url=${encodeURIComponent(url)}`;
      else if (apiName === "davidcyril-instagram") apiUrl = `${DAVID}/instagram?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-aio") apiUrl = `${PREX}/download/aio?url=${encodeURIComponent(url)}`;
      else continue;

      const resp = await fetchWithTimeout(apiUrl, 25000);
      if (!resp.ok) { recordApiCall(apiName, false); continue; }
      const data = await resp.json() as Record<string, unknown>;
      recordApiCall(apiName, true);

      const mediaItems: MediaItem[] = [];
      const d = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
      const title = safeStr(d.caption) || safeStr(d.title) || "Instagram Media";
      const thumbnail = safeStr(d.thumbnail) || safeStr(d.thumb);
      const author = safeStr(d.author) || safeStr(d.username) || safeStr(d.owner);

      const videoUrl = safeStr(d.url as string) || safeStr(d.video as string) || safeStr(data.url as string);
      if (videoUrl) mediaItems.push({ url: videoUrl, quality: "hd", format: "mp4", label: "Video HD" });

      safeArray(d.medias || d.items || d.videos).forEach((item, i) => {
        const it = safeRecord(item);
        const iu = safeStr(it.url);
        if (iu && !mediaItems.find(m => m.url === iu)) {
          const isVid = safeStr(it.type) === "video" || iu.includes(".mp4");
          mediaItems.push({ url: iu, quality: "hd", format: isVid ? "mp4" : "jpg", label: `Media ${i + 1}` });
        }
      });

      if (mediaItems.length === 0) { recordApiCall(apiName, false); continue; }
      return { mediaItems, title, thumbnail, author, apiUsed: apiName };
    } catch (err) {
      logger.warn({ err, apiName }, "Instagram API failed");
      recordApiCall(apiName, false);
    }
  }
  throw new Error("All Instagram APIs failed. Please try again later.");
}

async function tryFacebookApis(url: string): Promise<{ mediaItems: MediaItem[]; title?: string; thumbnail?: string; apiUsed: string }> {
  const apis = appConfig.facebook.apiPriority.filter(name => apiStats.get(name)?.enabled !== false);

  for (const apiName of apis) {
    try {
      let apiUrl = "";
      if (apiName === "prexzyvilla-facebook") apiUrl = `${PREX}/download/facebook?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-facebookv2") apiUrl = `${PREX}/download/facebookv2?url=${encodeURIComponent(url)}`;
      else if (apiName === "davidcyril-facebook") apiUrl = `${DAVID}/facebook?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-aio") apiUrl = `${PREX}/download/aio?url=${encodeURIComponent(url)}`;
      else continue;

      const resp = await fetchWithTimeout(apiUrl, 25000);
      if (!resp.ok) { recordApiCall(apiName, false); continue; }
      const data = await resp.json() as Record<string, unknown>;
      recordApiCall(apiName, true);

      const mediaItems: MediaItem[] = [];
      const d = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
      const title = safeStr(d.title) || "Facebook Video";
      const thumbnail = safeStr(d.thumbnail);

      const hdUrl = safeStr(d.hd) || safeStr(d.video_hd) || safeStr(d.url as string);
      const sdUrl = safeStr(d.sd) || safeStr(d.video_sd);
      if (hdUrl) mediaItems.push({ url: hdUrl, quality: "hd", format: "mp4", label: "Video HD" });
      if (sdUrl && sdUrl !== hdUrl) mediaItems.push({ url: sdUrl, quality: "sd", format: "mp4", label: "Video SD" });

      if (mediaItems.length === 0) { recordApiCall(apiName, false); continue; }
      return { mediaItems, title, thumbnail, apiUsed: apiName };
    } catch (err) {
      logger.warn({ err, apiName }, "Facebook API failed");
      recordApiCall(apiName, false);
    }
  }
  throw new Error("All Facebook APIs failed. Please try again later.");
}

async function tryTwitterApis(url: string): Promise<{ mediaItems: MediaItem[]; title?: string; thumbnail?: string; apiUsed: string }> {
  const apis = appConfig.twitter.apiPriority.filter(name => apiStats.get(name)?.enabled !== false);

  for (const apiName of apis) {
    try {
      let apiUrl = "";
      if (apiName === "prexzyvilla-twitter") apiUrl = `${PREX}/download/twitter?url=${encodeURIComponent(url)}`;
      else if (apiName === "davidcyril-twitter") apiUrl = `${DAVID}/twitter?url=${encodeURIComponent(url)}`;
      else if (apiName === "prexzyvilla-aio") apiUrl = `${PREX}/download/aio?url=${encodeURIComponent(url)}`;
      else continue;

      const resp = await fetchWithTimeout(apiUrl, 25000);
      if (!resp.ok) { recordApiCall(apiName, false); continue; }
      const data = await resp.json() as Record<string, unknown>;
      recordApiCall(apiName, true);

      const mediaItems: MediaItem[] = [];
      const d = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
      const title = safeStr(d.text) || safeStr(data.title) || "Twitter/X Video";
      const thumbnail = safeStr(d.thumbnail);

      safeArray(d.medias || d.videos || d.items).forEach((item, i) => {
        const it = safeRecord(item);
        const iu = safeStr(it.url) || safeStr(it.video);
        if (iu && !mediaItems.find(m => m.url === iu)) {
          const q = safeStr(it.quality) || (i === 0 ? "hd" : "sd");
          mediaItems.push({ url: iu, quality: q, format: "mp4", label: `Video ${q.toUpperCase()}` });
        }
      });
      const videoUrl = safeStr(data.url as string) || safeStr(d.url as string);
      if (videoUrl && !mediaItems.find(m => m.url === videoUrl)) {
        mediaItems.push({ url: videoUrl, quality: "hd", format: "mp4", label: "Video" });
      }

      if (mediaItems.length === 0) { recordApiCall(apiName, false); continue; }
      return { mediaItems, title, thumbnail, apiUsed: apiName };
    } catch (err) {
      logger.warn({ err, apiName }, "Twitter API failed");
      recordApiCall(apiName, false);
    }
  }
  throw new Error("All Twitter/X APIs failed. Please try again later.");
}

async function trySpotifyApis(url: string): Promise<{ mediaItems: MediaItem[]; title?: string; thumbnail?: string; author?: string; duration?: number; apiUsed: string }> {
  const apis = appConfig.spotify.apiPriority.filter(name => apiStats.get(name)?.enabled !== false);

  function extractSpotifyTrackId(spotifyUrl: string): string | null {
    try {
      const parsed = new URL(spotifyUrl);
      const match = parsed.pathname.match(/\/track\/([A-Za-z0-9]+)/);
      return match ? match[1] : null;
    } catch { return null; }
  }

  for (const apiName of apis) {
    try {
      if (apiName === "api-spotifydown") {
        const trackId = extractSpotifyTrackId(url);
        if (!trackId) { recordApiCall(apiName, false); continue; }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        try {
          const resp = await fetch(`https://api.spotifydown.com/download/${trackId}`, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "application/json",
              "Origin": "https://spotifydown.com",
              "Referer": "https://spotifydown.com/",
            },
          });
          clearTimeout(timer);
          if (!resp.ok) { recordApiCall(apiName, false); continue; }
          const data = await resp.json() as Record<string, unknown>;
          if (!data.success || !safeStr(data.link as string)) { recordApiCall(apiName, false); continue; }
          const meta = safeRecord(data.metadata);
          recordApiCall(apiName, true);
          return {
            mediaItems: [{ url: data.link as string, quality: "audio", format: "mp3", label: "Audio MP3 — Spotify" }],
            title: safeStr(meta.title as string) || safeStr(data.title as string),
            thumbnail: safeStr(meta.cover as string) || safeStr(data.cover as string),
            author: safeStr(meta.artists as string) || safeStr(data.artists as string),
            apiUsed: "api-spotifydown",
          };
        } catch { clearTimeout(timer); recordApiCall(apiName, false); }
      }

      if (apiName === "prexzyvilla-spotify") {
        const resp = await fetchWithTimeout(`${PREX}/download/spotifyv2?url=${encodeURIComponent(url)}`, 30000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        const data = await resp.json() as Record<string, unknown>;
        const d = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
        const mp3Url = safeStr(d.url as string) || safeStr(d.audio as string) || safeStr(d.link as string) || safeStr(data.url as string) || safeStr(data.link as string);
        if (!mp3Url) { recordApiCall(apiName, false); continue; }
        recordApiCall(apiName, true);
        return {
          mediaItems: [{ url: mp3Url, quality: "audio", format: "mp3", label: "Audio MP3 — Spotify" }],
          title: safeStr(d.title as string) || safeStr(data.title as string),
          thumbnail: safeStr(d.cover as string) || safeStr(d.thumbnail as string),
          author: safeStr(d.artist as string) || safeStr(d.artists as string),
          apiUsed: "prexzyvilla-spotify",
        };
      }

      if (apiName === "davidcyril-spotify") {
        const resp = await fetchWithTimeout(`${DAVID}/spotifydl?url=${encodeURIComponent(url)}`, 30000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        const data = await resp.json() as Record<string, unknown>;
        const d = safeRecord(data.data) || safeRecord(data.result) || safeRecord(data);
        const mp3Url = safeStr(d.url as string) || safeStr(d.link as string) || safeStr(data.url as string) || safeStr(data.link as string);
        if (!mp3Url) { recordApiCall(apiName, false); continue; }
        recordApiCall(apiName, true);
        return {
          mediaItems: [{ url: mp3Url, quality: "audio", format: "mp3", label: "Audio MP3 — Spotify" }],
          title: safeStr(d.title as string) || safeStr(data.title as string),
          thumbnail: safeStr(d.cover as string) || safeStr(d.thumbnail as string),
          author: safeStr(d.artist as string) || safeStr(d.artists as string),
          apiUsed: "davidcyril-spotify",
        };
      }

      if (apiName === "fabdl") {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const infoResp = await fetch(`https://api.fabdl.com/spotify/get?url=${encodeURIComponent(url)}`, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
          });
          clearTimeout(timer);
          if (!infoResp.ok) { recordApiCall(apiName, false); continue; }
          const info = await infoResp.json() as Record<string, unknown>;
          const result = safeRecord(info.result);
          if (!safeStr(result.gid as string) || !safeStr(result.id as string)) { recordApiCall(apiName, false); continue; }

          await new Promise(r => setTimeout(r, 1500));
          const convertController = new AbortController();
          const convertTimer = setTimeout(() => convertController.abort(), 30000);
          try {
            const convertResp = await fetch(`https://api.fabdl.com/spotify/mp3-convert-task/${result.gid}/${result.id}`, {
              signal: convertController.signal,
              headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
            });
            clearTimeout(convertTimer);
            if (!convertResp.ok) { recordApiCall(apiName, false); continue; }
            const convert = await convertResp.json() as Record<string, unknown>;
            const cr = safeRecord(convert.result);
            const dlUrl = safeStr(cr.download_url as string);
            if (!dlUrl) { recordApiCall(apiName, false); continue; }
            recordApiCall(apiName, true);
            return {
              mediaItems: [{ url: dlUrl, quality: "audio", format: "mp3", label: "Audio MP3 — Spotify" }],
              title: safeStr(result.name as string),
              thumbnail: safeStr(result.image as string),
              author: safeStr(result.artists as string),
              apiUsed: "fabdl",
            };
          } catch { clearTimeout(convertTimer); recordApiCall(apiName, false); }
        } catch { clearTimeout(timer); recordApiCall(apiName, false); }
      }

      if (apiName === "prexzyvilla-aio") {
        const resp = await fetchWithTimeout(`${PREX}/download/aio?url=${encodeURIComponent(url)}`, 25000);
        if (!resp.ok) { recordApiCall(apiName, false); continue; }
        const data = await resp.json() as Record<string, unknown>;
        const d = safeRecord(data.data) || safeRecord(data);
        const mp3Url = safeStr(d.mp3 as string) || safeStr(d.audio as string) || safeStr(d.url as string);
        if (!mp3Url) { recordApiCall(apiName, false); continue; }
        recordApiCall(apiName, true);
        return {
          mediaItems: [{ url: mp3Url, quality: "audio", format: "mp3", label: "Audio MP3 — Spotify" }],
          title: safeStr(d.title as string) || safeStr(data.title as string),
          thumbnail: safeStr(d.thumbnail as string) || safeStr(data.thumbnail as string),
          author: safeStr(d.author as string),
          apiUsed: "prexzyvilla-aio",
        };
      }
    } catch (err) {
      logger.warn({ err, apiName }, "Spotify API failed");
      recordApiCall(apiName, false);
    }
  }
  throw new Error("All Spotify APIs failed. Please try again later.");
}

async function processDownload(job: DownloadJob, quality: Quality, format: Format): Promise<void> {
  try {
    let result: { mediaItems: MediaItem[]; title?: string; thumbnail?: string; author?: string; duration?: number; apiUsed: string };

    switch (job.platform) {
      case "tiktok":
        if (!appConfig.tiktok.enabled) throw new Error("TikTok downloads are currently disabled");
        result = await tryTikTokApis(job.url, quality);
        break;
      case "youtube":
        if (!appConfig.youtube.enabled) throw new Error("YouTube downloads are currently disabled");
        result = await tryYouTubeApis(job.url, quality, format);
        break;
      case "pinterest":
        if (!appConfig.pinterest.enabled) throw new Error("Pinterest downloads are currently disabled");
        result = await tryPinterestApis(job.url);
        break;
      case "spotify":
        if (!appConfig.spotify.enabled) throw new Error("Spotify downloads are currently disabled");
        result = await trySpotifyApis(job.url);
        break;
      case "instagram":
        result = await tryInstagramApis(job.url);
        break;
      case "facebook":
        result = await tryFacebookApis(job.url);
        break;
      case "twitter":
        result = await tryTwitterApis(job.url);
        break;
      default:
        throw new Error("Unsupported platform");
    }

    job.status = "ready";
    job.mediaItems = result.mediaItems;
    job.title = result.title || null;
    job.thumbnail = result.thumbnail || null;
    job.author = result.author || null;
    job.duration = result.duration || null;
    job.apiUsed = result.apiUsed;
    job.completedAt = new Date().toISOString();

    // Persist to DB
    try {
      await db.insert(downloadsTable).values({
        jobId: job.jobId,
        url: job.url,
        platform: job.platform,
        contentType: job.contentType,
        status: "ready",
        title: job.title,
        thumbnail: job.thumbnail,
        apiUsed: job.apiUsed,
        retryCount: job.retryCount,
        createdAt: new Date(job.createdAt),
        completedAt: new Date(),
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, "DB insert failed (non-fatal)");
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    job.status = "failed";
    job.error = errorMsg;
    job.completedAt = new Date().toISOString();

    try {
      await db.insert(errorLogsTable).values({
        url: job.url,
        platform: job.platform,
        error: errorMsg,
        apiUsed: job.apiUsed || "none",
        retryCount: job.retryCount,
        createdAt: new Date(),
      });
    } catch { /* ignore */ }

    logger.error({ err, jobId: job.jobId, platform: job.platform }, "Download job failed");
  } finally {
    processingQueue.delete(job.jobId);
  }
}

export async function submitDownload(url: string, quality: Quality, format: Format, ip: string): Promise<DownloadJob> {
  const cacheKey = getCacheKey(url, quality, format);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const detection = detectPlatform(url);
  const jobId = generateJobId();
  const job: DownloadJob = {
    jobId,
    status: "pending",
    url,
    platform: detection.platform,
    contentType: detection.contentType,
    mediaItems: [],
    retryCount: 0,
    createdAt: new Date().toISOString(),
    apiUsed: null,
  };

  jobStore.set(jobId, job);

  job.status = "processing";
  processingQueue.add(jobId);

  processDownload(job, quality, format).then(() => {
    if (job.status === "ready") setCache(cacheKey, job);
  }).catch(() => { /* handled inside */ });

  return job;
}

export function getJob(jobId: string): DownloadJob | null {
  return jobStore.get(jobId) || null;
}

export async function getHistory(limit: number): Promise<object[]> {
  try {
    const rows = await db.select().from(downloadsTable).orderBy(desc(downloadsTable.createdAt)).limit(limit);
    return rows.map(r => ({
      jobId: r.jobId,
      url: r.url,
      platform: r.platform,
      contentType: r.contentType,
      status: r.status,
      title: r.title,
      thumbnail: r.thumbnail,
      timestamp: r.createdAt?.toISOString() || "",
    }));
  } catch { return []; }
}

export async function getPublicStats(): Promise<object> {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [total, today] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(downloadsTable),
      db.select({ count: sql<number>`count(*)` }).from(downloadsTable).where(gte(downloadsTable.createdAt, todayStart)),
    ]);
    const breakdown = await db.select({ platform: downloadsTable.platform, count: sql<number>`count(*)` }).from(downloadsTable).groupBy(downloadsTable.platform);

    const pb: Record<string, number> = {};
    breakdown.forEach(b => { pb[b.platform] = Number(b.count); });

    const totalCount = Number(total[0]?.count || 0);
    const errorCount = await db.select({ count: sql<number>`count(*)` }).from(errorLogsTable);
    const totalAttempts = totalCount + Number(errorCount[0]?.count || 0);
    const successRate = totalAttempts > 0 ? totalCount / totalAttempts : 1;

    return { totalDownloads: totalCount, todayDownloads: Number(today[0]?.count || 0), platformBreakdown: pb, successRate };
  } catch {
    return { totalDownloads: 0, todayDownloads: 0, platformBreakdown: {}, successRate: 1 };
  }
}

export async function getAdminStats(): Promise<object> {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [total, today, week] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(downloadsTable),
      db.select({ count: sql<number>`count(*)` }).from(downloadsTable).where(gte(downloadsTable.createdAt, todayStart)),
      db.select({ count: sql<number>`count(*)` }).from(downloadsTable).where(gte(downloadsTable.createdAt, weekStart)),
    ]);
    const breakdown = await db.select({ platform: downloadsTable.platform, count: sql<number>`count(*)` }).from(downloadsTable).groupBy(downloadsTable.platform);
    const topErrors = await db.select({ error: errorLogsTable.error }).from(errorLogsTable).orderBy(desc(errorLogsTable.createdAt)).limit(5);

    const pb: Record<string, number> = {};
    breakdown.forEach(b => { pb[b.platform] = Number(b.count); });

    const totalCount = Number(total[0]?.count || 0);
    const apiHealthArr = Array.from(apiStats.values()).map(a => ({
      name: a.name,
      platform: a.platform,
      successRate: a.totalCalls > 0 ? a.successCalls / a.totalCalls : 1,
      totalCalls: a.totalCalls,
      failures: a.failureCalls,
      enabled: a.enabled,
    }));

    const dailyCounts: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const rows = await db.select({ count: sql<number>`count(*)` }).from(downloadsTable)
        .where(sql`${downloadsTable.createdAt} >= ${start} AND ${downloadsTable.createdAt} < ${end}`);
      dailyCounts.push({ date: start.toISOString().slice(0, 10), count: Number(rows[0]?.count || 0) });
    }

    return {
      totalDownloads: totalCount,
      todayDownloads: Number(today[0]?.count || 0),
      weekDownloads: Number(week[0]?.count || 0),
      platformBreakdown: pb,
      successRate: totalCount / Math.max(totalCount + 1, 1),
      activeJobs: processingQueue.size,
      pendingJobs: Array.from(jobStore.values()).filter(j => j.status === "pending").length,
      serverUptime: process.uptime(),
      apiHealth: apiHealthArr,
      dailyCounts,
      topErrors: topErrors.map(e => e.error),
    };
  } catch (err) {
    logger.error({ err }, "getAdminStats failed");
    return { totalDownloads: 0, todayDownloads: 0, weekDownloads: 0, platformBreakdown: {}, successRate: 1, activeJobs: 0, pendingJobs: 0, serverUptime: process.uptime(), apiHealth: [], dailyCounts: [], topErrors: [] };
  }
}

export async function getAdminLogs(limit: number): Promise<object[]> {
  try {
    const rows = await db.select().from(errorLogsTable).orderBy(desc(errorLogsTable.createdAt)).limit(limit);
    return rows.map(r => ({
      id: r.id?.toString() || "",
      timestamp: r.createdAt?.toISOString() || "",
      platform: r.platform,
      url: r.url,
      error: r.error,
      apiUsed: r.apiUsed,
      retryCount: r.retryCount,
    }));
  } catch { return []; }
}

export function getActiveJobs(): DownloadJob[] {
  return Array.from(jobStore.values()).filter(j => j.status === "pending" || j.status === "processing");
}
