import { Router, Request, Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const DAVID = "https://apis.davidcyril.name.ng";
const PREX = "https://apis.prexzyvilla.site";

async function fetchJson(url: string, timeoutMs = 20000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    return await resp.json() as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

function safeArr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function safeStr(v: unknown): string { return typeof v === "string" ? v : ""; }
function safeRec(v: unknown): Record<string, unknown> { return (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {}; }

function normalizeItem(item: unknown, site: string): Record<string, unknown> {
  const m = safeRec(item);
  const ch = safeRec(m.channel);
  return {
    id: safeStr(m.id) || safeStr(m.video_id) || safeStr(m.eid) || safeStr(m.contentId),
    title: safeStr(m.title) || safeStr(m.name) || "Untitled",
    thumbnail: safeStr(m.thumbnail) || safeStr(m.image) || safeStr(m.thumb) || safeStr(m.preview_url) || safeStr(m.downloadUrl),
    url: safeStr(m.url) || safeStr(m.video_url) || safeStr(m.postUrl) || safeStr(m.link),
    downloadUrl: safeStr(m.downloadUrl),
    duration: safeStr(m.duration) || safeStr(m.length),
    views: safeStr(m.views) || safeStr(m.nb_views),
    rating: safeStr(m.rating) || safeStr(m.rate),
    resolution: safeStr(m.resolution),
    channel: safeStr(ch.name) || safeStr(m.channel),
    tags: m.tags || m.categories,
    site,
  };
}

// Multi-site adult search — using real David Cyril endpoints
router.get("/adult/search", async (req: Request, res: Response) => {
  const q = (req.query.q as string) || "trending";
  const site = (req.query.site as string) || "xnxx";
  const page = parseInt(req.query.page as string || "1", 10);

  // Real David Cyril adult endpoints (confirmed working from API docs)
  const davidEndpoints: Record<string, string[]> = {
    xnxx: [
      `${DAVID}/xxx/xnxx?q=${encodeURIComponent(q)}&page=${page}`,
      `${DAVID}/xxx/xnxx?query=${encodeURIComponent(q)}&page=${page}`,
    ],
    xvideos: [
      `${DAVID}/xxx/xvideos?q=${encodeURIComponent(q)}&page=${page}`,
      `${DAVID}/xxx/xvideos?query=${encodeURIComponent(q)}&page=${page}`,
      `${DAVID}/xvideo?q=${encodeURIComponent(q)}&page=${page}`,
    ],
    xhamster: [
      `${DAVID}/xhamster/search?q=${encodeURIComponent(q)}&page=${page}`,
      `${DAVID}/xhamster/random`,
    ],
    naijatape: [
      `${DAVID}/naijatape`,
    ],
    leaktube: [
      `${DAVID}/leaktube`,
    ],
    naijablow: [
      `${DAVID}/naijablow`,
    ],
    darknaija: [
      `${DAVID}/darknaija`,
    ],
    all: [
      `${DAVID}/xxx/xnxx?q=${encodeURIComponent(q)}&page=${page}`,
      `${DAVID}/xxx/xvideos?q=${encodeURIComponent(q)}&page=${page}`,
      `${DAVID}/xhamster/search?q=${encodeURIComponent(q)}&page=${page}`,
    ],
  };

  // Prexzy fallback endpoints
  const prexEndpoints: Record<string, string[]> = {
    xnxx: [
      `${PREX}/nsfw/xnxx-search?q=${encodeURIComponent(q)}&page=${page}`,
      `${PREX}/nsfw/search?site=xnxx&q=${encodeURIComponent(q)}`,
    ],
    xvideos: [
      `${PREX}/nsfw/xvideos-search?q=${encodeURIComponent(q)}&page=${page}`,
      `${PREX}/nsfw/search?site=xvideos&q=${encodeURIComponent(q)}`,
    ],
    xhamster: [
      `${PREX}/nsfw/xhamster-search?q=${encodeURIComponent(q)}&page=${page}`,
    ],
    pornhub: [
      `${PREX}/nsfw/pornhub-search?q=${encodeURIComponent(q)}&page=${page}`,
      `${PREX}/nsfw/search?site=pornhub&q=${encodeURIComponent(q)}`,
    ],
    eporner: [
      `${PREX}/nsfw/eporner-search?q=${encodeURIComponent(q)}&page=${page}`,
    ],
    redtube: [
      `${PREX}/nsfw/redtube-search?q=${encodeURIComponent(q)}&page=${page}`,
    ],
    all: [
      `${PREX}/nsfw/search?q=${encodeURIComponent(q)}&page=${page}`,
      `${PREX}/nsfw/xnxx-search?q=${encodeURIComponent(q)}`,
    ],
  };

  const davidEps = davidEndpoints[site] || davidEndpoints.all;
  const prexEps = prexEndpoints[site] || prexEndpoints.all;

  for (const endpoint of [...davidEps, ...prexEps]) {
    try {
      const data = await fetchJson(endpoint);

      // David Cyril XNXX format: { success, data: { results: [...] } }
      const innerData = safeRec(data.data);
      const results = safeArr(innerData.results || data.results || data.data || data.videos || data.content || data.items);

      // Naijatape format: { success, data: { title, thumbnail, downloadUrl } }
      if (innerData.downloadUrl || innerData.title) {
        res.json({ results: [normalizeItem(innerData, site)], site, query: q, source: endpoint });
        return;
      }

      if (results.length > 0) {
        res.json({
          results: results.map(i => normalizeItem(i, site)),
          site,
          query: q,
          total: innerData.totalResults || results.length,
          page: innerData.page || page,
          totalPages: innerData.totalPages,
          source: endpoint,
        });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, `Adult search failed (${site})`);
    }
  }

  res.json({ results: [], site, query: q, message: "No results found. Try a different keyword or site." });
});

// Get video download link — David Cyril real download endpoints
router.get("/adult/download", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  const site = (req.query.site as string) || "xnxx";
  if (!url) { res.status(400).json({ error: "Video URL is required" }); return; }

  // Real David Cyril download endpoints
  const davidEndpoints: Record<string, string[]> = {
    xnxx: [
      `${DAVID}/download/xnxx?url=${encodeURIComponent(url)}`,
      `${DAVID}/xxx/xnxx/download?url=${encodeURIComponent(url)}`,
    ],
    xvideos: [
      `${DAVID}/xvideo?url=${encodeURIComponent(url)}`,
      `${DAVID}/xxx/xvideos/download?url=${encodeURIComponent(url)}`,
    ],
    xhamster: [
      `${DAVID}/xhamster/download?url=${encodeURIComponent(url)}`,
    ],
    default: [
      `${DAVID}/download/xnxx?url=${encodeURIComponent(url)}`,
      `${DAVID}/xvideo?url=${encodeURIComponent(url)}`,
    ],
  };

  // Prexzy fallback
  const prexEndpoints: Record<string, string[]> = {
    xnxx: [
      `${PREX}/nsfw/xnxx-dl?url=${encodeURIComponent(url)}`,
      `${PREX}/nsfw/download?site=xnxx&url=${encodeURIComponent(url)}`,
    ],
    xvideos: [
      `${PREX}/nsfw/xvideos-dl?url=${encodeURIComponent(url)}`,
      `${PREX}/nsfw/download?site=xvideos&url=${encodeURIComponent(url)}`,
    ],
    xhamster: [
      `${PREX}/nsfw/xhamster-dl?url=${encodeURIComponent(url)}`,
    ],
    pornhub: [
      `${PREX}/nsfw/pornhub-dl?url=${encodeURIComponent(url)}`,
    ],
    default: [
      `${PREX}/nsfw/download?url=${encodeURIComponent(url)}`,
    ],
  };

  const davidEps = davidEndpoints[site] || davidEndpoints.default;
  const prexEps = prexEndpoints[site] || prexEndpoints.default;

  for (const endpoint of [...davidEps, ...prexEps]) {
    try {
      const data = await fetchJson(endpoint, 30000);
      const d = safeRec(data.data || data.result || data);
      const dlUrl = safeStr(d.downloadUrl) || safeStr(d.url) || safeStr(d.hd) || safeStr(d.sd) || safeStr(d.low) || safeStr(data.url) || safeStr(data.downloadUrl) || safeStr(data.DownloadLink);
      if (dlUrl) {
        const qualities: Array<{ label: string; url: string; quality: string }> = [];
        if (safeStr(d.hd)) qualities.push({ label: "HD", url: safeStr(d.hd), quality: "hd" });
        if (safeStr(d.sd)) qualities.push({ label: "SD", url: safeStr(d.sd), quality: "sd" });
        if (safeStr(d.low)) qualities.push({ label: "Low", url: safeStr(d.low), quality: "low" });
        if (qualities.length === 0) qualities.push({ label: "Default", url: dlUrl, quality: "auto" });
        res.json({ downloadUrl: dlUrl, qualities, title: safeStr(d.title) || safeStr(data.title), site, source: endpoint });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, `Adult download failed (${site})`);
    }
  }
  res.status(404).json({ error: "Download link not available. Try opening the original URL in your browser." });
});

// Trending content — David Cyril Nigerian/African adult content sites
router.get("/adult/trending", async (req: Request, res: Response) => {
  const site = (req.query.site as string) || "xnxx";

  // David Cyril trending endpoints
  const davidTrending: Record<string, string[]> = {
    xnxx: [
      `${DAVID}/xxx/xnxx?q=trending`,
      `${DAVID}/xxx/xnxx?q=hot`,
    ],
    xvideos: [
      `${DAVID}/xxx/xvideos?q=trending`,
    ],
    xhamster: [
      `${DAVID}/xhamster/random`,
    ],
    naijatape: [`${DAVID}/naijatape`],
    leaktube: [`${DAVID}/leaktube`],
    naijablow: [`${DAVID}/naijablow`],
    darknaija: [`${DAVID}/darknaija`],
    all: [
      `${DAVID}/naijatape`,
      `${DAVID}/leaktube`,
      `${DAVID}/xxx/xnxx?q=trending`,
    ],
  };

  const prexTrending = [
    `${PREX}/nsfw/trending?site=${site}`,
    `${PREX}/nsfw/${site}-search?q=trending`,
    `${PREX}/nsfw/search?q=trending&site=${site}`,
  ];

  const davidEps = davidTrending[site] || davidTrending.all;

  for (const endpoint of [...davidEps, ...prexTrending]) {
    try {
      const data = await fetchJson(endpoint);
      const innerData = safeRec(data.data);

      // Naijatape/Leaktube single item format
      if (innerData.downloadUrl || innerData.title) {
        res.json({ results: [normalizeItem(innerData, site)], site, source: endpoint });
        return;
      }

      const results = safeArr(innerData.results || data.results || data.data || data.videos || data.content || data.items);
      if (results.length > 0) {
        res.json({ results: results.map(i => normalizeItem(i, site)), site, source: endpoint });
        return;
      }
    } catch { /* try next */ }
  }

  res.json({ results: [], site, message: "Trending unavailable" });
});

export { router as adultRouter };
