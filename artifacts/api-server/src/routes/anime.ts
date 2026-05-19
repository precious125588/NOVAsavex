import { Router, Request, Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const DAVID = "https://apis.davidcyril.name.ng";
const PREX = "https://apis.prexzyvilla.site";
const JIKAN = "https://api.jikan.moe/v4"; // Free MyAnimeList API, no key needed
const CONSUMET = "https://api.consumet.org";

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

function normalizeAnime(item: unknown): Record<string, unknown> {
  const a = safeRec(item);
  const imageRec = safeRec(a.images);
  const jpgRec = safeRec(imageRec.jpg);
  return {
    id: a.id || a.mal_id || a.animeId,
    malId: a.mal_id || a.id,
    title: safeStr(a.title) || safeStr(a.title_english) || safeStr(a.name),
    titleEnglish: safeStr(a.title_english),
    titleJapanese: safeStr(a.title_japanese),
    image: safeStr(a.image) || safeStr(jpgRec.image_url) || safeStr(a.thumbnail) || safeStr(a.cover),
    episodes: a.episodes || a.totalEpisodes,
    status: safeStr(a.status),
    score: a.score || a.rating,
    genres: safeArr(a.genres).map(g => {
      const gRec = safeRec(g);
      return safeStr(gRec.name) || String(g);
    }).filter(Boolean),
    synopsis: safeStr(a.synopsis) || safeStr(a.description) || safeStr(a.background),
    type: safeStr(a.type),
    year: a.year || (safeStr(safeRec(a.aired).from || "")).slice(0, 4),
    rank: a.rank,
    popularity: a.popularity,
    url: safeStr(a.url),
  };
}

// Search anime — David Cyril (/anime/search) + Jikan + Consumet
router.get("/anime/search", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query || query.trim().length < 1) { res.status(400).json({ error: "Anime title required" }); return; }

  // 1. David Cyril — confirmed working with /anime/search?q=...
  const davidEndpoints = [
    `${DAVID}/anime/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/anime/otakudesu/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/anime/animeindo/search?q=${encodeURIComponent(query)}`,
  ];

  // 2. Prexzy
  const prexEndpoints = [
    `${PREX}/anime/search?q=${encodeURIComponent(query)}`,
    `${PREX}/search/anime?q=${encodeURIComponent(query)}`,
  ];

  // 3. Jikan (free MyAnimeList API — no key required)
  const jikanEndpoints = [
    `${JIKAN}/anime?q=${encodeURIComponent(query)}&limit=20`,
    `${JIKAN}/anime?q=${encodeURIComponent(query)}&limit=20&sfw=true`,
  ];

  // 4. Consumet (free)
  const consumetEndpoints = [
    `${CONSUMET}/anime/gogoanime/${encodeURIComponent(query)}`,
    `${CONSUMET}/anime/zoro/${encodeURIComponent(query)}`,
    `${CONSUMET}/anime/9anime/${encodeURIComponent(query)}`,
  ];

  for (const endpoint of [...davidEndpoints, ...prexEndpoints]) {
    try {
      const data = await fetchJson(endpoint);
      // David Cyril returns { results: [...] }
      const items = safeArr(data.results || data.data || data.animes || data.anime);
      if (items.length > 0) {
        res.json({ animes: items.map(normalizeAnime), source: endpoint });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Anime search failed");
    }
  }

  for (const endpoint of jikanEndpoints) {
    try {
      const data = await fetchJson(endpoint);
      // Jikan returns { data: [...] }
      const items = safeArr(data.data);
      if (items.length > 0) {
        res.json({ animes: items.map(normalizeAnime), source: "jikan" });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Jikan anime search failed");
    }
  }

  for (const endpoint of consumetEndpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = safeArr(data.results || data.data || data.animes);
      if (items.length > 0) {
        res.json({ animes: items.map(normalizeAnime), source: "consumet" });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Consumet anime search failed");
    }
  }

  res.json({ animes: [], message: "No results found" });
});

// Get anime details + episodes
router.get("/anime/info", async (req: Request, res: Response) => {
  const id = req.query.id as string || req.query.url as string;
  if (!id) { res.status(400).json({ error: "Anime ID required" }); return; }

  // David Cyril — confirmed working with /anime/info?id=... (MAL ID)
  const davidEndpoints = [
    `${DAVID}/anime/info?id=${encodeURIComponent(id)}`,
    `${DAVID}/anime/episodes?id=${encodeURIComponent(id)}`,
  ];

  for (const endpoint of davidEndpoints) {
    try {
      const data = await fetchJson(endpoint);
      if (data.success && (data.title || data.episodes)) {
        res.json({ ...data, source: "david" });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "David Cyril anime info failed");
    }
  }

  // Jikan fallback (MAL API — works if id is a MAL ID)
  if (/^\d+$/.test(id)) {
    try {
      const [infoData, epsData] = await Promise.allSettled([
        fetchJson(`${JIKAN}/anime/${id}`),
        fetchJson(`${JIKAN}/anime/${id}/episodes`),
      ]);
      const info = infoData.status === "fulfilled" ? safeRec(infoData.value.data) : {};
      const eps = epsData.status === "fulfilled" ? safeArr(safeRec(epsData.value).data) : [];
      if (info.title || info.mal_id) {
        res.json({ ...normalizeAnime(info), episodes: eps, source: "jikan" });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Jikan anime info failed");
    }
  }

  // Consumet by ID
  const consumetEndpoints = [
    `${CONSUMET}/anime/gogoanime/info/${encodeURIComponent(id)}`,
    `${CONSUMET}/anime/zoro/info?id=${encodeURIComponent(id)}`,
    `${PREX}/anime/info?id=${encodeURIComponent(id)}`,
  ];

  for (const endpoint of consumetEndpoints) {
    try {
      const data = await fetchJson(endpoint);
      if (data && (safeRec(data).title || safeRec(safeRec(data).data).title)) {
        res.json({ ...data, source: endpoint });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Anime info failed");
    }
  }

  res.status(404).json({ error: "Anime not found" });
});

// Get episodes list
router.get("/anime/episodes", async (req: Request, res: Response) => {
  const id = req.query.id as string;
  const page = parseInt(req.query.page as string || "1", 10);
  if (!id) { res.status(400).json({ error: "Anime ID required" }); return; }

  // David Cyril — confirmed working
  try {
    const data = await fetchJson(`${DAVID}/anime/episodes?id=${encodeURIComponent(id)}&page=${page}`);
    if (data.success && Array.isArray(data.episodes)) {
      res.json({ episodes: data.episodes, hasNext: data.has_next, source: "david" });
      return;
    }
  } catch (err) {
    logger.warn({ err }, "David Cyril episodes failed");
  }

  // Jikan fallback
  if (/^\d+$/.test(id)) {
    try {
      const data = await fetchJson(`${JIKAN}/anime/${id}/episodes?page=${page}`);
      const eps = safeArr(data.data);
      if (eps.length > 0) {
        res.json({ episodes: eps, hasNext: safeRec(data.pagination).has_next_page, source: "jikan" });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Jikan episodes failed");
    }
  }

  // Prexzy/Consumet
  const endpoints = [
    `${PREX}/anime/episodes?id=${encodeURIComponent(id)}&page=${page}`,
    `${CONSUMET}/anime/gogoanime/info/${encodeURIComponent(id)}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const eps = safeArr(data.episodes || data.data || data.result);
      if (eps.length > 0) { res.json({ episodes: eps, source: endpoint }); return; }
    } catch { /* try next */ }
  }

  res.status(404).json({ error: "Episodes not found" });
});

// Get stream URL — Consumet (free streaming) + Prexzy/David
router.get("/anime/stream", async (req: Request, res: Response) => {
  const episodeId = req.query.episodeId as string || req.query.id as string;
  const server = (req.query.server as string) || "gogocdn";
  if (!episodeId) { res.status(400).json({ error: "Episode ID required" }); return; }

  // Consumet — free anime streaming
  const consumetEndpoints = [
    `${CONSUMET}/anime/gogoanime/watch/${encodeURIComponent(episodeId)}?server=${server}`,
    `${CONSUMET}/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`,
    `${CONSUMET}/anime/zoro/watch?episodeId=${encodeURIComponent(episodeId)}`,
    `${CONSUMET}/anime/9anime/watch?episodeId=${encodeURIComponent(episodeId)}`,
  ];

  for (const endpoint of consumetEndpoints) {
    try {
      const data = await fetchJson(endpoint, 30000);
      const sources = safeArr(data.sources || data.data);
      if (sources.length > 0) {
        const streamUrl = safeStr(safeRec(sources[0]).url) || safeStr(safeRec(sources[0]).file);
        res.json({
          streamUrl,
          sources: sources.map(s => ({
            url: safeStr(safeRec(s).url) || safeStr(safeRec(s).file),
            quality: safeStr(safeRec(s).quality) || "auto",
            isM3U8: Boolean(safeRec(s).isM3U8),
          })).filter(s => s.url),
          subtitles: safeArr(data.subtitles || data.tracks),
          headers: data.headers,
          source: endpoint,
        });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Consumet anime stream failed");
    }
  }

  // David Cyril / Prexzy fallbacks
  const endpoints = [
    `${DAVID}/anime/stream?episodeId=${encodeURIComponent(episodeId)}`,
    `${PREX}/anime/stream?episodeId=${encodeURIComponent(episodeId)}&server=${server}`,
    `${PREX}/anime/episode?id=${encodeURIComponent(episodeId)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint, 30000);
      const d = safeRec(data.data || data.result || data);
      const streamUrl = safeStr(d.url) || safeStr(d.streamUrl) || safeStr(d.m3u8) || safeStr(d.source) || safeStr(data.url);
      if (streamUrl) {
        const sources = safeArr(d.sources || d.links || data.sources);
        res.json({
          streamUrl,
          sources: sources.length > 0 ? sources : [{ url: streamUrl, quality: "auto" }],
          subtitles: safeArr(d.subtitles || d.tracks),
          source: endpoint,
        });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Anime stream failed");
    }
  }

  res.status(404).json({ error: "Stream not available for this episode" });
});

// Download anime episode
router.get("/anime/download", async (req: Request, res: Response) => {
  const episodeId = req.query.episodeId as string || req.query.id as string;
  const quality = (req.query.quality as string) || "hd";
  if (!episodeId) { res.status(400).json({ error: "Episode ID required" }); return; }

  const endpoints = [
    `${DAVID}/anime/download?episodeId=${encodeURIComponent(episodeId)}&quality=${quality}`,
    `${PREX}/anime/download?episodeId=${encodeURIComponent(episodeId)}&quality=${quality}`,
    `${CONSUMET}/anime/gogoanime/watch/${encodeURIComponent(episodeId)}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint, 30000);
      const d = safeRec(data.data || data.result || data);
      const sources = safeArr(d.sources || data.sources);
      const downloadUrl = safeStr(d.download) || safeStr(d.url) || safeStr(d.hd) || safeStr(d.sd)
        || (sources.length > 0 ? safeStr(safeRec(sources[0]).url) : "")
        || safeStr(data.url);
      if (downloadUrl) {
        res.json({
          downloadUrl,
          quality,
          title: safeStr(d.title) || safeStr(data.title),
          sources: sources.length > 0 ? sources : [{ url: downloadUrl, quality }],
          source: endpoint,
        });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Anime download failed");
    }
  }
  res.status(404).json({ error: "Download not available for this episode" });
});

// Trending/Popular anime — Jikan (free, reliable) + David Cyril + Consumet
router.get("/anime/trending", async (_req: Request, res: Response) => {
  // Jikan top anime (completely free)
  try {
    const data = await fetchJson(`${JIKAN}/top/anime?limit=20&filter=airing`);
    const items = safeArr(data.data);
    if (items.length > 0) {
      res.json({ trending: items.map(normalizeAnime), source: "jikan" });
      return;
    }
  } catch { /* try next */ }

  // David Cyril trending
  const davidEndpoints = [
    `${DAVID}/anime/trending`,
    `${DAVID}/anime/popular`,
    `${DAVID}/anime/schedule`,
  ];

  for (const endpoint of davidEndpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = safeArr(data.results || data.data || data.animes || data.trending || data.schedule);
      if (items.length > 0) { res.json({ trending: items.map(normalizeAnime), source: endpoint }); return; }
    } catch { /* try next */ }
  }

  // Consumet + Prexzy
  const fallbackEndpoints = [
    `${CONSUMET}/anime/gogoanime/top-airing`,
    `${PREX}/anime/trending`,
    `${PREX}/anime/popular`,
  ];

  for (const endpoint of fallbackEndpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = safeArr(data.results || data.data || data.animes || data.trending);
      if (items.length > 0) { res.json({ trending: items.map(normalizeAnime), source: endpoint }); return; }
    } catch { /* try next */ }
  }

  res.json({ trending: [] });
});

// Anime schedule
router.get("/anime/schedule", async (req: Request, res: Response) => {
  const day = req.query.day as string;

  try {
    const url = day
      ? `${JIKAN}/schedules?filter=${encodeURIComponent(day)}&limit=25`
      : `${JIKAN}/schedules?limit=25`;
    const data = await fetchJson(url);
    const items = safeArr(data.data);
    if (items.length > 0) {
      res.json({ schedule: items.map(normalizeAnime), source: "jikan" });
      return;
    }
  } catch { /* try next */ }

  try {
    const data = await fetchJson(`${DAVID}/anime/schedule`);
    const items = safeArr(data.schedule || data.data || data.results);
    if (items.length > 0) { res.json({ schedule: items, source: "david" }); return; }
  } catch { /* try next */ }

  res.json({ schedule: [] });
});

// Anime genres
router.get("/anime/genres", async (_req: Request, res: Response) => {
  try {
    const data = await fetchJson(`${JIKAN}/genres/anime`);
    const genres = safeArr(data.data).map(g => {
      const gRec = safeRec(g);
      return { id: gRec.mal_id, name: safeStr(gRec.name), count: gRec.count };
    });
    if (genres.length > 0) { res.json({ genres }); return; }
  } catch { /* fallback */ }
  res.json({ genres: ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"].map((name, id) => ({ id, name })) });
});

export { router as animeRouter };
