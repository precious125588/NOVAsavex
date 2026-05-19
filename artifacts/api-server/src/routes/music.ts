import { Router, Request, Response } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const DAVID = "https://apis.davidcyril.name.ng";
const PREX = "https://apis.prexzyvilla.site";
const ITUNES = "https://itunes.apple.com";
const LYRICS_OVH = "https://api.lyrics.ovh";

async function fetchJson(url: string, timeoutMs = 20000, extraHeaders: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json",
        ...extraHeaders,
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

// Search songs — David Cyril (text param) + Prexzy + iTunes fallback
router.get("/music/search", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query || query.trim().length < 2) { res.status(400).json({ error: "Search query required (min 2 chars)" }); return; }

  // 1. David Cyril — uses `text` param
  const davidEndpoints = [
    `${DAVID}/search/spotify?text=${encodeURIComponent(query)}`,
    `${DAVID}/search/spotify-v2?text=${encodeURIComponent(query)}`,
    `${DAVID}/search/applemusic?text=${encodeURIComponent(query)}`,
    `${DAVID}/search/songs?text=${encodeURIComponent(query)}`,
    `${DAVID}/search/music?text=${encodeURIComponent(query)}`,
  ];

  // 2. Prexzy — uses `q` param
  const prexEndpoints = [
    `${PREX}/search/spotify?q=${encodeURIComponent(query)}`,
    `${PREX}/search/music?q=${encodeURIComponent(query)}`,
    `${PREX}/music/search?q=${encodeURIComponent(query)}`,
    `${PREX}/search/songs?q=${encodeURIComponent(query)}`,
  ];

  for (const endpoint of [...davidEndpoints, ...prexEndpoints]) {
    try {
      const data = await fetchJson(endpoint);
      const items = safeArr(data.data || data.result || data.results || data.songs || data.tracks || data.items);
      if (items.length > 0) {
        const songs = items.map((item) => {
          const t = safeRec(item);
          return {
            id: safeStr(t.id) || safeStr(t.track_id) || safeStr(t.trackId),
            title: safeStr(t.title) || safeStr(t.name) || safeStr(t.trackName) || safeStr(t.song),
            artist: safeStr(t.artist) || safeStr(t.artists) || safeStr(t.author) || safeStr(t.artistName),
            album: safeStr(t.album) || safeStr(t.album_name) || safeStr(t.collectionName),
            duration: t.duration || t.duration_ms || t.trackTimeMillis,
            thumbnail: safeStr(t.thumbnail) || safeStr(t.cover) || safeStr(t.image) || safeStr(t.artwork) || safeStr(t.artworkUrl100),
            previewUrl: safeStr(t.preview_url) || safeStr(t.preview) || safeStr(t.audio_preview) || safeStr(t.previewUrl),
            spotifyUrl: safeStr(t.spotify_url) || safeStr(t.url) || safeStr(t.external_url) || safeStr(t.trackViewUrl),
            youtubeUrl: safeStr(t.youtube_url) || safeStr(t.yt_url),
          };
        }).filter(s => s.title);
        if (songs.length > 0) { res.json({ songs, source: endpoint }); return; }
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Music search endpoint failed");
    }
  }

  // 3. iTunes fallback (completely free, no key needed)
  try {
    const itunesData = await fetchJson(`${ITUNES}/search?term=${encodeURIComponent(query)}&media=music&limit=20&entity=song`);
    const items = safeArr(itunesData.results);
    if (items.length > 0) {
      const songs = items.map((item) => {
        const t = safeRec(item);
        return {
          id: safeStr(t.trackId),
          title: safeStr(t.trackName),
          artist: safeStr(t.artistName),
          album: safeStr(t.collectionName),
          duration: t.trackTimeMillis,
          thumbnail: safeStr(t.artworkUrl100)?.replace("100x100", "300x300"),
          previewUrl: safeStr(t.previewUrl),
          spotifyUrl: safeStr(t.trackViewUrl),
        };
      }).filter(s => s.title);
      if (songs.length > 0) { res.json({ songs, source: "itunes" }); return; }
    }
  } catch (err) {
    logger.warn({ err }, "iTunes search failed");
  }

  res.json({ songs: [], message: "No results found" });
});

// Get lyrics — David Cyril (t+a params) + lyrics.ovh fallback
router.get("/music/lyrics", async (req: Request, res: Response) => {
  const query = req.query.q as string || req.query.title as string;
  const artist = req.query.artist as string;
  if (!query) { res.status(400).json({ error: "Song title required" }); return; }

  // 1. David Cyril — needs t (title) and a (artist)
  const davidEndpoints = artist ? [
    `${DAVID}/lyrics?t=${encodeURIComponent(query)}&a=${encodeURIComponent(artist)}`,
    `${DAVID}/lyrics/search?t=${encodeURIComponent(query)}&a=${encodeURIComponent(artist)}`,
    `${DAVID}/lyrics/genius?t=${encodeURIComponent(query)}&a=${encodeURIComponent(artist)}`,
    `${DAVID}/lyrics/lrclib?t=${encodeURIComponent(query)}&a=${encodeURIComponent(artist)}`,
  ] : [
    `${DAVID}/lyrics?q=${encodeURIComponent(query)}`,
    `${DAVID}/lyrics/search?q=${encodeURIComponent(query)}`,
  ];

  // 2. Prexzy
  const prexEndpoints = [
    `${PREX}/lyrics?q=${encodeURIComponent(query)}${artist ? `&artist=${encodeURIComponent(artist)}` : ""}`,
    `${PREX}/music/lyrics?q=${encodeURIComponent(query)}`,
  ];

  for (const endpoint of [...davidEndpoints, ...prexEndpoints]) {
    try {
      const data = await fetchJson(endpoint);
      const lyrics = safeStr(data.lyrics) || safeStr(data.result) || safeStr(safeRec(data.data).lyrics);
      if (lyrics && lyrics.length > 10) {
        res.json({
          lyrics,
          title: safeStr(data.title) || safeStr(safeRec(data.data).title) || query,
          artist: safeStr(data.artist) || safeStr(safeRec(data.data).artist) || artist || "",
          thumbnail: safeStr(data.thumbnail) || safeStr(data.cover),
          source: endpoint,
        });
        return;
      }
    } catch (err) {
      logger.warn({ err, endpoint }, "Lyrics endpoint failed");
    }
  }

  // 3. lyrics.ovh fallback (free public API)
  if (artist) {
    try {
      const ovhData = await fetchJson(`${LYRICS_OVH}/v1/${encodeURIComponent(artist)}/${encodeURIComponent(query)}`);
      const lyrics = safeStr(ovhData.lyrics);
      if (lyrics && lyrics.length > 10) {
        res.json({ lyrics, title: query, artist, source: "lyrics.ovh" });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "lyrics.ovh fallback failed");
    }
  }

  res.status(404).json({ error: "Lyrics not found. Try adding the artist name as ?artist=ArtistName" });
});

// Download a song from Spotify/YouTube
router.get("/music/download", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) { res.status(400).json({ error: "Spotify or YouTube URL required" }); return; }

  try {
    if (url.includes("spotify.com")) {
      const trackIdMatch = url.match(/\/track\/([A-Za-z0-9]+)/);
      if (!trackIdMatch) { res.status(400).json({ error: "Invalid Spotify track URL" }); return; }
      const trackId = trackIdMatch[1];

      // David Cyril — /spotifydl and /spotifydl2 return DownloadLink
      const davidEndpoints = [
        { url: `${DAVID}/spotifydl?url=${encodeURIComponent(url)}`, type: "david" },
        { url: `${DAVID}/spotifydl2?url=${encodeURIComponent(url)}`, type: "david" },
        { url: `${DAVID}/download/spotdown?url=${encodeURIComponent(url)}`, type: "david" },
        { url: `${DAVID}/download/spotidown?url=${encodeURIComponent(url)}`, type: "david" },
        { url: `${DAVID}/download/spodownloader?url=${encodeURIComponent(url)}`, type: "david" },
        { url: `${DAVID}/download/spotmate?url=${encodeURIComponent(url)}`, type: "david" },
      ];

      // Prexzy
      const prexEndpoints = [
        { url: `${PREX}/download/spotify?url=${encodeURIComponent(url)}`, type: "prex" },
        { url: `${PREX}/download/spotifyv2?url=${encodeURIComponent(url)}`, type: "prex" },
        { url: `${PREX}/spotifydl?url=${encodeURIComponent(url)}`, type: "prex" },
      ];

      // SpotifyDown API (free public)
      const spotifyDownEndpoints = [
        {
          url: `https://api.spotifydown.com/download/${trackId}`,
          headers: { "Origin": "https://spotifydown.com", "Referer": "https://spotifydown.com/" },
          type: "spotifydown",
        },
      ];

      for (const ep of [...davidEndpoints, ...prexEndpoints, ...spotifyDownEndpoints]) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);
          const resp = await fetch(ep.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept": "application/json",
              ...("headers" in ep && ep.headers && typeof ep.headers === "object" ? ep.headers as Record<string, string> : {}),
            },
          });
          clearTimeout(timer);
          if (!resp.ok) continue;
          const data = await resp.json() as Record<string, unknown>;

          // David Cyril format: { DownloadLink, title, channel, thumbnail }
          const dlUrl = safeStr(data.DownloadLink) || safeStr(data.link) || safeStr(safeRec(data.data).url) || safeStr(data.url);
          if (dlUrl) {
            res.json({
              downloadUrl: dlUrl,
              title: safeStr(data.title) || safeStr(safeRec(data.metadata).title),
              artist: safeStr(data.channel) || safeStr(data.artist) || safeStr(safeRec(data.metadata).artists),
              thumbnail: safeStr(data.thumbnail) || safeStr(safeRec(data.metadata).cover),
              format: "mp3",
              source: ep.url,
            });
            return;
          }
        } catch (err) {
          logger.warn({ err, url: ep.url }, "Spotify download endpoint failed");
        }
      }
    } else if (url.includes("youtu")) {
      const endpoints = [
        `${DAVID}/download/ytmp3?url=${encodeURIComponent(url)}`,
        `${DAVID}/download/ytmp3v2?url=${encodeURIComponent(url)}`,
        `${DAVID}/youtube/mp3?url=${encodeURIComponent(url)}`,
        `${PREX}/download/ytdownload?url=${encodeURIComponent(url)}&type=audio&format=mp3`,
        `${PREX}/download/ytmp3?url=${encodeURIComponent(url)}`,
      ];
      for (const ep of endpoints) {
        try {
          const data = await fetchJson(ep, 30000);
          const d = safeRec(data.data || data.result || data);
          const dlUrl = safeStr(d.url) || safeStr(d.mp3) || safeStr(d.download) || safeStr(data.url) || safeStr(data.DownloadLink);
          if (dlUrl) {
            res.json({ downloadUrl: dlUrl, title: safeStr(d.title) || safeStr(data.title), format: "mp3", source: ep });
            return;
          }
        } catch { /* try next */ }
      }
    }
    res.status(422).json({ error: "Could not extract download link from this URL. Make sure it's a valid Spotify track or YouTube URL." });
  } catch (err) {
    logger.error({ err }, "Music download failed");
    res.status(500).json({ error: "Music download failed. Please try again." });
  }
});

// Trending songs — iTunes top 20 + Prexzy/David fallback
router.get("/music/trending", async (_req: Request, res: Response) => {
  // iTunes RSS feed is completely free
  try {
    const itunesData = await fetchJson(`${ITUNES}/search?term=trending&media=music&limit=20&entity=song`);
    const items = safeArr(itunesData.results);
    if (items.length > 0) {
      const songs = items.map((item) => {
        const t = safeRec(item);
        return {
          id: safeStr(t.trackId),
          title: safeStr(t.trackName),
          artist: safeStr(t.artistName),
          album: safeStr(t.collectionName),
          thumbnail: safeStr(t.artworkUrl100)?.replace("100x100", "300x300"),
          previewUrl: safeStr(t.previewUrl),
          spotifyUrl: safeStr(t.trackViewUrl),
          duration: t.trackTimeMillis,
        };
      }).filter(s => s.title);
      if (songs.length > 0) { res.json({ trending: songs, source: "itunes" }); return; }
    }
  } catch { /* try next */ }

  const endpoints = [
    `${DAVID}/music/trending`,
    `${DAVID}/trending/songs`,
    `${PREX}/music/trending`,
    `${PREX}/trending/songs`,
  ];
  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson(endpoint);
      const items = safeArr(data.data || data.result || data.songs || data.tracks || data.trending);
      if (items.length > 0) { res.json({ trending: items, source: endpoint }); return; }
    } catch { /* try next */ }
  }
  res.json({ trending: [], message: "Trending data unavailable" });
});

// Music info (metadata)
router.get("/music/info", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) { res.status(400).json({ error: "URL required" }); return; }
  try {
    if (url.includes("spotify.com")) {
      const trackIdMatch = url.match(/\/track\/([A-Za-z0-9]+)/);
      if (trackIdMatch) {
        try {
          const resp = await fetchJson(`https://api.spotifydown.com/metadata/track/${trackIdMatch[1]}`);
          res.json(resp);
          return;
        } catch { /* fall through */ }
      }
    }
    // Try YouTube info via David Cyril
    const endpoints = [
      `${DAVID}/download/yt?url=${encodeURIComponent(url)}`,
      `${PREX}/download/ytinfo?url=${encodeURIComponent(url)}`,
    ];
    for (const ep of endpoints) {
      try {
        const data = await fetchJson(ep);
        if (data && (data.title || safeRec(data.data).title)) { res.json(data); return; }
      } catch { /* try next */ }
    }
    res.status(404).json({ error: "Could not fetch music info" });
  } catch (err) {
    logger.error({ err }, "Music info failed");
    res.status(500).json({ error: "Could not fetch music info" });
  }
});

export { router as musicRouter };
