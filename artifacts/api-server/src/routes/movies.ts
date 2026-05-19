import { Router, Request, Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const DAVID    = "https://apis.davidcyril.name.ng";
const PREX     = "https://apis.prexzyvilla.site";
const CONSUMET = "https://api.consumet.org";
// Free public APIs — no key required
const VIDSRC   = "https://vidsrc.to/api";           // embed API
const VIDSRC2  = "https://vidsrc.me";               // embed player
const VIDSRC3  = "https://v2.vidsrc.me";            // v2 embed

async function fetchJson(url: string, timeoutMs = 25000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/json" },
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json() as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}

function safeArr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function safeStr(v: unknown): string { return typeof v === "string" ? v : ""; }
function safeRec(v: unknown): Record<string, unknown> { return (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, unknown> : {}; }

function normalizeMovie(item: unknown, source = ""): Record<string, unknown> {
  const m = safeRec(item);
  const posterRaw = safeStr(m.poster) || safeStr(m.poster_path) || safeStr(m.image) || safeStr(m.thumbnail) || safeStr(m.cover) || safeStr(m.img);
  const poster = posterRaw && posterRaw.startsWith("/") ? `https://image.tmdb.org/t/p/w500${posterRaw}` : posterRaw;
  const backdropRaw = safeStr(m.backdrop) || safeStr(m.backdrop_path) || safeStr(m.banner);
  const backdrop = backdropRaw && backdropRaw.startsWith("/") ? `https://image.tmdb.org/t/p/original${backdropRaw}` : backdropRaw;
  return {
    id: safeStr(m.id) || safeStr(m.imdbId) || safeStr(m.tmdbId) || safeStr(m.mal_id),
    title: safeStr(m.title) || safeStr(m.name) || safeStr(m.film_name),
    overview: safeStr(m.overview) || safeStr(m.plot) || safeStr(m.description) || safeStr(m.synopsis),
    poster,
    backdrop,
    year: safeStr(m.year) || safeStr(m.release_date)?.slice(0, 4) || safeStr(m.releaseDate)?.slice(0, 4),
    rating: m.vote_average ?? m.rating ?? m.score,
    genres: m.genres || m.genre_ids,
    runtime: m.runtime || m.duration,
    type: safeStr(m.media_type) || safeStr(m.type) || "movie",
    imdbId: safeStr(m.imdb_id) || safeStr(m.imdbId),
    language: safeStr(m.original_language) || safeStr(m.language),
    quality: safeStr(m.quality) || "HD",
    source,
  };
}

// ─── SEARCH ───────────────────────────────────────────────────
router.get("/movies/search", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const type  = (req.query.type as string) || "movie";
  if (!query?.trim()) { res.status(400).json({ error: "Query required" }); return; }

  const endpoints = [
    // David Cyril — real confirmed endpoints
    `${DAVID}/movies/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/firemovie/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/firemovies/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/zoom/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/movie/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/nkiri/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/mynetnaija/search?q=${encodeURIComponent(query)}`,
    `${DAVID}/fzmovies/search?q=${encodeURIComponent(query)}`,
    // Prexzy
    `${PREX}/movies/search?q=${encodeURIComponent(query)}&type=${type}`,
    `${PREX}/search/movies?q=${encodeURIComponent(query)}`,
    `${PREX}/movie/search?q=${encodeURIComponent(query)}`,
    // Consumet FlixHQ (free, no key)
    `${CONSUMET}/movies/flixhq/search?query=${encodeURIComponent(query)}&type=${type === "tv" ? "Tv shows" : "Movie"}`,
    // vidsrc.to search (free)
    `${VIDSRC}/search/movie?query=${encodeURIComponent(query)}&limit=20`,
    `${VIDSRC}/search/tv?query=${encodeURIComponent(query)}&limit=20`,
  ];

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = safeArr(data.results || data.data || data.movies || data.result || data.films || data.videos);
      if (items.length > 0) {
        res.json({ movies: items.map(i => normalizeMovie(i, endpoint)), total: items.length, source: endpoint });
        return;
      }
    } catch (err) { logger.warn({ err, endpoint }, "Movie search failed"); }
  }
  res.json({ movies: [], total: 0, message: "No results found. Try a different title." });
});

// ─── TRENDING ─────────────────────────────────────────────────
router.get("/movies/trending", async (_req: Request, res: Response) => {
  const endpoints = [
    `${DAVID}/movies/latest`,
    `${DAVID}/movies/trending`,
    `${DAVID}/movies/net9ja/latest`,
    `${PREX}/movies/trending`,
    `${PREX}/trending/movies`,
    `${CONSUMET}/movies/flixhq/recent-movies`,
    `${CONSUMET}/movies/flixhq/trending`,
    `${VIDSRC}/list/movie/latest?page=1`,
    `${VIDSRC}/list/movie?page=1`,
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = safeArr(data.results || data.data || data.movies || data.trending || data.recent || data.result);
      if (items.length > 0) {
        res.json({ movies: items.map(i => normalizeMovie(i, endpoint)), source: endpoint });
        return;
      }
    } catch { /* try next */ }
  }
  res.json({ movies: [], message: "Trending unavailable" });
});

// ─── STREAM ───────────────────────────────────────────────────
router.get("/movies/stream", async (req: Request, res: Response) => {
  const id      = req.query.id as string;
  const title   = req.query.title as string;
  const quality = (req.query.quality as string) || "hd";
  const season  = (req.query.season as string) || "1";
  const episode = (req.query.episode as string) || "1";
  if (!id && !title) { res.status(400).json({ error: "ID or title required" }); return; }
  const searchKey = id || title;

  // 1. Consumet FlixHQ direct streaming
  const consumetEndpoints = [
    `${CONSUMET}/movies/flixhq/watch?episodeId=${encodeURIComponent(searchKey)}&mediaId=${encodeURIComponent(id || "")}`,
    `${CONSUMET}/movies/flixhq/watch-movie?episodeId=${encodeURIComponent(searchKey)}&mediaId=${encodeURIComponent(id || "")}`,
  ];
  for (const endpoint of consumetEndpoints) {
    try {
      const data = await fetchJson(endpoint, 30000);
      const sources = safeArr(data.sources || data.data);
      if (sources.length > 0) {
        const subtitles = safeArr(data.subtitles || data.tracks || data.subs).map(s => {
          const sub = safeRec(s);
          return { lang: safeStr(sub.lang) || safeStr(sub.label), url: safeStr(sub.file) || safeStr(sub.url), default: Boolean(sub.default), label: safeStr(sub.label) || safeStr(sub.lang) };
        });
        res.json({ streamUrl: safeStr(safeRec(sources[0]).url), sources: sources.map(s => ({ url: safeStr(safeRec(s).url), quality: safeStr(safeRec(s).quality) || quality })), subtitles, title: safeStr(data.title), source: endpoint });
        return;
      }
    } catch (err) { logger.warn({ err, endpoint }, "Consumet stream failed"); }
  }

  // 2. Prexzy / David Cyril streaming
  const streamEndpoints = [
    `${PREX}/movies/stream?id=${encodeURIComponent(searchKey)}&quality=${quality}`,
    `${DAVID}/movies/stream?id=${encodeURIComponent(searchKey)}`,
    `${PREX}/stream/movie?id=${encodeURIComponent(searchKey)}&quality=${quality}`,
    `${DAVID}/zoom/stream?id=${encodeURIComponent(searchKey)}`,
    `${DAVID}/firemovie/stream?id=${encodeURIComponent(searchKey)}`,
  ];
  for (const endpoint of streamEndpoints) {
    try {
      const data = await fetchJson(endpoint, 30000);
      const d = safeRec(data.data || data.result || data);
      const streamUrl = safeStr(d.url) || safeStr(d.stream) || safeStr(d.source) || safeStr(d.link) || safeStr(data.url) || safeStr(data.stream);
      if (streamUrl) {
        const sources = safeArr(d.sources || d.links || d.qualities);
        res.json({ streamUrl, sources: sources.length > 0 ? sources : [{ url: streamUrl, quality }], subtitles: safeArr(d.subtitles || d.tracks), title: safeStr(d.title) || safeStr(data.title), source: endpoint });
        return;
      }
    } catch (err) { logger.warn({ err, endpoint }, "Movie stream failed"); }
  }

  // 3. vidsrc.me / 2embed embed fallback (always works with imdb id)
  const isImdb = id && id.startsWith("tt");
  if (isImdb) {
    const embedUrl = `${VIDSRC2}/embed/movie?imdb=${id}`;
    res.json({ streamUrl: embedUrl, sources: [{ url: embedUrl, quality: "HD", type: "embed" }], subtitles: [], embed: true, embedUrl, message: "Embed player — streams directly in browser." });
    return;
  }

  // 4. Generate embed from any numeric id
  if (id) {
    const embedUrls = [
      `https://www.2embed.to/embed/tmdb/movie?id=${id}`,
      `${VIDSRC3}/embed/movie/${id}`,
      `https://superembed.stream/movie/${id}`,
      `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
    ];
    res.json({ streamUrl: embedUrls[0], sources: embedUrls.map((u, i) => ({ url: u, quality: `Embed ${i + 1}`, type: "embed" })), subtitles: [], embed: true, embedUrl: embedUrls[0], message: "Embed player." });
    return;
  }

  res.status(404).json({ error: "Stream not available. Try downloading instead." });
});

// ─── DOWNLOAD ─────────────────────────────────────────────────
router.get("/movies/download", async (req: Request, res: Response) => {
  const id      = req.query.id as string;
  const title   = req.query.title as string;
  const quality = (req.query.quality as string) || "hd";
  if (!id && !title) { res.status(400).json({ error: "ID or title required" }); return; }
  const searchKey = id || title;

  const endpoints = [
    `${DAVID}/movies/fzmovies/download?id=${encodeURIComponent(searchKey)}&quality=${quality}`,
    `${DAVID}/movie/download?id=${encodeURIComponent(searchKey)}&quality=${quality}`,
    `${DAVID}/nkiri/download?id=${encodeURIComponent(searchKey)}`,
    `${DAVID}/mynetnaija/download?id=${encodeURIComponent(searchKey)}`,
    `${DAVID}/firemovie/download?id=${encodeURIComponent(searchKey)}&quality=${quality}`,
    `${DAVID}/fzmovies/download?q=${encodeURIComponent(title || searchKey)}&quality=${quality}`,
    `${PREX}/movies/download?id=${encodeURIComponent(searchKey)}&quality=${quality}`,
    `${PREX}/download/movie?id=${encodeURIComponent(searchKey)}&quality=${quality}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint, 30000);
      const d = safeRec(data.data || data.result || data);
      const downloadUrl = safeStr(d.url) || safeStr(d.download) || safeStr(d.link) || safeStr(d.downloadUrl) || safeStr(data.url) || safeStr(data.download);
      if (downloadUrl) {
        res.json({ downloadUrl, quality, title: safeStr(d.title) || safeStr(data.title) || title, size: d.size || d.fileSize, source: endpoint });
        return;
      }
    } catch (err) { logger.warn({ err, endpoint }, "Movie download failed"); }
  }
  res.status(404).json({ error: "Download not available. Try streaming instead." });
});

// ─── INFO ─────────────────────────────────────────────────────
router.get("/movies/info", async (req: Request, res: Response) => {
  const id    = req.query.id as string;
  const title = req.query.title as string;
  if (!id && !title) { res.status(400).json({ error: "ID or title required" }); return; }
  const endpoints = [
    ...(id ? [`${DAVID}/movies/info?id=${encodeURIComponent(id)}`, `${PREX}/movies/info?id=${encodeURIComponent(id)}`, `${CONSUMET}/movies/flixhq/info?id=${encodeURIComponent(id)}`] : []),
    ...(title ? [`${PREX}/movie?title=${encodeURIComponent(title)}`, `${DAVID}/movie?title=${encodeURIComponent(title)}`] : []),
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const d = safeRec(data.data || data.result || data.info || data);
      if (d.title || d.name) { res.json(normalizeMovie(d, endpoint)); return; }
    } catch (err) { logger.warn({ err, endpoint }, "Movie info failed"); }
  }
  res.status(404).json({ error: "Movie not found" });
});

// ─── SUBTITLES ────────────────────────────────────────────────
router.get("/movies/subtitles", async (req: Request, res: Response) => {
  const id   = req.query.id as string;
  const lang = (req.query.lang as string) || "en";
  if (!id) { res.status(400).json({ error: "ID required" }); return; }
  const endpoints = [
    `${CONSUMET}/movies/flixhq/watch?episodeId=${encodeURIComponent(id)}&mediaId=${encodeURIComponent(id)}`,
    `${PREX}/movies/subtitles?id=${encodeURIComponent(id)}&lang=${lang}`,
    `${DAVID}/movies/subtitles?id=${encodeURIComponent(id)}&lang=${lang}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const subs = safeArr(data.subtitles || data.tracks || data.subs).filter(s => safeStr(safeRec(s).file || safeRec(s).url));
      if (subs.length > 0) {
        res.json({ subtitles: subs.map(s => { const sub = safeRec(s); return { lang: safeStr(sub.lang) || lang, url: safeStr(sub.file) || safeStr(sub.url), label: safeStr(sub.label) || lang }; }) });
        return;
      }
    } catch { /* try next */ }
  }
  res.json({ subtitles: [] });
});

// ─── GENRES ───────────────────────────────────────────────────
router.get("/movies/genres", (_req: Request, res: Response) => {
  res.json({ genres: [
    { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 18, name: "Drama" },
    { id: 14, name: "Fantasy" }, { id: 27, name: "Horror" }, { id: 9648, name: "Mystery" },
    { id: 10749, name: "Romance" }, { id: 878, name: "Sci-Fi" }, { id: 53, name: "Thriller" },
    { id: 99, name: "Documentary" }, { id: 10751, name: "Family" }, { id: 36, name: "History" },
    { id: 10752, name: "War" }, { id: 37, name: "Western" },
  ]});
});

export { router as moviesRouter };
