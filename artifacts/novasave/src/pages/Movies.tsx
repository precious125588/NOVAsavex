import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Film, Search, Play, Pause, Download, Loader2, Star, X, Volume2, VolumeX,
  Maximize, Minimize, Settings, Subtitles, ChevronDown, Captions, RefreshCw,
  ExternalLink, SkipForward, SkipBack, FastForward, Rewind,
} from "lucide-react";

interface Movie {
  id?: string;
  title?: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  year?: string;
  rating?: number | string;
  genres?: unknown[];
  runtime?: number | string;
  type?: string;
  imdbId?: string;
  language?: string;
  quality?: string;
}

interface StreamSource {
  url: string;
  quality: string;
  label?: string;
}

interface Subtitle {
  lang: string;
  url: string;
  label: string;
  default?: boolean;
}

interface StreamData {
  streamUrl: string;
  sources: StreamSource[];
  subtitles: Subtitle[];
  title?: string;
  thumbnail?: string;
  duration?: number;
}

const LANGUAGES = [
  { code: "en", label: "English" }, { code: "fr", label: "French" },
  { code: "es", label: "Spanish" }, { code: "de", label: "German" },
  { code: "it", label: "Italian" }, { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" }, { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" }, { code: "zh", label: "Chinese" },
];

const GENRES = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Thriller", "Documentary", "Family"];
const QUALITIES = ["auto", "4k", "1080p", "720p", "480p", "360p"];

// --- Full-featured Video Player ---
function VideoPlayer({ stream, movie, onClose }: { stream: StreamData; movie: Movie; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeSource, setActiveSource] = useState(0);
  const [activeSub, setActiveSub] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState("");
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sources = stream.sources.length > 0 ? stream.sources : [{ url: stream.streamUrl, quality: "auto" }];
  const currentSrc = sources[activeSource]?.url || stream.streamUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onLoaded = () => { setDuration(video.duration); setBuffering(false); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onError = () => setError("Stream error — try another quality or download instead");
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
    };
  }, []);

  const togglePlay = () => { const v = videoRef.current; if (!v) return; v.paused ? v.play().catch(() => {}) : v.pause(); };
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => { const v = videoRef.current; if (v) v.currentTime = parseFloat(e.target.value); };
  const skip = (secs: number) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(duration, v.currentTime + secs)); };
  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => { const vol = parseFloat(e.target.value); setVolume(vol); if (videoRef.current) videoRef.current.volume = vol; };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(!muted); };
  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) { await el.requestFullscreen(); setFullscreen(true); }
    else { await document.exitFullscreen(); setFullscreen(false); }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}` : `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const showControlsTemp = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 3500);
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `/api/proxy?url=${encodeURIComponent(currentSrc)}&filename=${encodeURIComponent((movie.title || "movie") + ".mp4")}`;
    a.download = `${movie.title || "movie"}.mp4`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className={`flex items-center justify-between p-3 bg-gradient-to-b from-black/90 to-transparent absolute top-0 left-0 right-0 z-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-white font-semibold text-sm">{movie.title}</p>
            {movie.year && <p className="text-white/60 text-xs">{movie.year} · {stream.sources[activeSource]?.quality || "HD"}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleDownload} className="text-white hover:bg-white/10 gap-1 text-xs">
            <Download className="w-3.5 h-3.5" />Save
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setShowSettings(!showSettings)} className="text-white hover:bg-white/10">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute top-14 right-3 z-20 bg-black/90 backdrop-blur rounded-xl p-3 w-56 space-y-3 border border-white/10">
          <div>
            <p className="text-xs text-white/60 mb-1.5">Quality</p>
            <div className="space-y-1">
              {sources.map((s, i) => (
                <button key={i} onClick={() => { setActiveSource(i); setShowSettings(false); }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-all ${activeSource === i ? "bg-primary text-white" : "text-white/80 hover:bg-white/10"}`}>
                  {s.quality || s.label || `Source ${i + 1}`}
                </button>
              ))}
            </div>
          </div>
          {stream.subtitles.length > 0 && (
            <div>
              <p className="text-xs text-white/60 mb-1.5">Subtitles</p>
              <button onClick={() => { setActiveSub(null); setShowSettings(false); }}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm ${activeSub === null ? "bg-primary text-white" : "text-white/80 hover:bg-white/10"}`}>
                Off
              </button>
              {stream.subtitles.map((sub, i) => (
                <button key={i} onClick={() => { setActiveSub(i); setShowSettings(false); }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm ${activeSub === i ? "bg-primary text-white" : "text-white/80 hover:bg-white/10"}`}>
                  {sub.label || sub.lang}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video */}
      <div ref={containerRef} className="flex-1 relative cursor-pointer" onClick={() => { togglePlay(); showControlsTemp(); }} onMouseMove={showControlsTemp}>
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <p className="text-white/80 text-center px-8">{error}</p>
            <Button onClick={handleDownload} className="gap-2"><Download className="w-4 h-4" />Download Instead</Button>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={currentSrc}
            className="w-full h-full"
            preload="metadata"
            crossOrigin="anonymous"
            onClick={e => e.stopPropagation()}
          >
            {activeSub !== null && stream.subtitles[activeSub] && (
              <track kind="subtitles" src={stream.subtitles[activeSub].url} srcLang={stream.subtitles[activeSub].lang} label={stream.subtitles[activeSub].label} default />
            )}
          </video>
        )}

        {buffering && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          </div>
        )}

        {!playing && !buffering && !error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 space-y-2 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-xs font-mono w-12 text-right">{formatTime(currentTime)}</span>
          <input
            type="range" min={0} max={duration || 100} value={currentTime} onChange={seek}
            className="flex-1 h-1 accent-purple-500 cursor-pointer"
            onClick={e => e.stopPropagation()}
          />
          <span className="text-white/70 text-xs font-mono w-12">{formatTime(duration)}</span>
        </div>
        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={e => { e.stopPropagation(); skip(-10); }} className="text-white/80 hover:text-white transition-colors">
              <Rewind className="w-5 h-5" />
            </button>
            <button onClick={e => { e.stopPropagation(); togglePlay(); }} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
              {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
            </button>
            <button onClick={e => { e.stopPropagation(); skip(10); }} className="text-white/80 hover:text-white transition-colors">
              <FastForward className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 ml-2" onClick={e => e.stopPropagation()}>
              <button onClick={toggleMute} className="text-white/80 hover:text-white">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={changeVolume} className="w-20 accent-purple-500 h-1 cursor-pointer" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stream.subtitles.length > 0 && (
              <button onClick={e => { e.stopPropagation(); setShowSettings(s => !s); }} className="text-white/70 hover:text-white transition-colors">
                <Captions className="w-4 h-4" />
              </button>
            )}
            <button onClick={e => { e.stopPropagation(); toggleFullscreen(); }} className="text-white/70 hover:text-white transition-colors">
              {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Movie Card ---
function MovieCard({ movie, onClick }: { movie: Movie; onClick: (m: Movie) => void }) {
  return (
    <div onClick={() => onClick(movie)} className="glass-card rounded-xl overflow-hidden cursor-pointer group hover:ring-1 hover:ring-primary/50 transition-all">
      <div className="relative aspect-[2/3] bg-black/40">
        {movie.poster ? (
          <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Film className="w-12 h-12 text-muted-foreground/20" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {movie.rating && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
            <span className="text-[10px] text-white font-medium">{typeof movie.rating === "number" ? movie.rating.toFixed(1) : movie.rating}</span>
          </div>
        )}
        {movie.quality && (
          <div className="absolute top-2 left-2"><Badge className="text-[9px] h-4 bg-primary/80">{movie.quality}</Badge></div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="w-6 h-6 text-white ml-1" />
          </div>
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-medium line-clamp-2 leading-tight">{movie.title}</p>
        {movie.year && <p className="text-[10px] text-muted-foreground mt-0.5">{movie.year}</p>}
      </div>
    </div>
  );
}

// --- Movie Detail Modal ---
function MovieDetailModal({ movie, onClose, onPlay, onDownload }: {
  movie: Movie;
  onClose: () => void;
  onPlay: (quality: string) => void;
  onDownload: (quality: string) => void;
}) {
  const [quality, setQuality] = useState("hd");
  const [subLang, setSubLang] = useState("en");

  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="glass-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Backdrop */}
        {movie.backdrop && (
          <div className="relative h-40 overflow-hidden rounded-t-2xl">
            <img src={movie.backdrop} alt="backdrop" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        <div className="p-5 space-y-4">
          {!movie.backdrop && (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{movie.title}</h2>
              <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
          )}

          <div className="flex gap-4">
            {movie.poster && <img src={movie.poster} alt={movie.title} className="w-24 rounded-lg object-cover flex-shrink-0" />}
            <div className="space-y-2">
              {movie.backdrop && <h2 className="text-lg font-bold leading-tight">{movie.title}</h2>}
              <div className="flex flex-wrap gap-1.5">
                {movie.year && <Badge variant="outline" className="text-xs">{movie.year}</Badge>}
                {movie.runtime && <Badge variant="outline" className="text-xs">{movie.runtime}min</Badge>}
                {movie.rating && (
                  <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">
                    ★ {typeof movie.rating === "number" ? movie.rating.toFixed(1) : movie.rating}
                  </Badge>
                )}
                {movie.language && <Badge variant="outline" className="text-xs uppercase">{movie.language}</Badge>}
              </div>
              {movie.overview && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{movie.overview}</p>}
            </div>
          </div>

          {/* Quality selector */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Quality</p>
            <div className="flex gap-1.5 flex-wrap">
              {QUALITIES.map(q => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${quality === q ? "bg-primary text-white" : "bg-white/10 text-muted-foreground hover:bg-white/20"}`}>
                  {q.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle language */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Subtitle language</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => setSubLang(l.code)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs transition-all ${subLang === l.code ? "bg-primary text-white" : "bg-white/10 text-muted-foreground hover:bg-white/20"}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button className="h-11 gap-2 bg-gradient-to-r from-purple-600 to-blue-600" onClick={() => onPlay(quality)}>
              <Play className="w-4 h-4" />Watch Now
            </Button>
            <Button variant="outline" className="h-11 gap-2" onClick={() => onDownload(quality)}>
              <Download className="w-4 h-4" />Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Movies() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [trending, setTrending] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/movies/trending")
      .then(r => r.json())
      .then((data: { movies?: Movie[] }) => { setTrending(data.movies || []); })
      .catch(() => {})
      .finally(() => setLoadingTrending(false));
  }, []);

  const searchMovies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setMovies([]);
    setSelectedMovie(null);
    try {
      const resp = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`);
      const data = await resp.json() as { movies?: Movie[] };
      setMovies(data.movies || []);
      if (!data.movies?.length) toast({ title: "No movies found", description: "Try a different title" });
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const searchByGenre = (genre: string) => {
    setActiveGenre(genre);
    setQuery(genre);
    setTimeout(async () => {
      setSearching(true);
      setMovies([]);
      try {
        const resp = await fetch(`/api/movies/search?q=${encodeURIComponent(genre)}`);
        const data = await resp.json() as { movies?: Movie[] };
        setMovies(data.movies || []);
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 50);
  };

  const handlePlay = async (quality: string) => {
    if (!selectedMovie) return;
    setStreaming(true);
    const key = selectedMovie.id || selectedMovie.title || "";
    try {
      const resp = await fetch(`/api/movies/stream?id=${encodeURIComponent(key)}&title=${encodeURIComponent(selectedMovie.title || "")}&quality=${quality}`);
      if (!resp.ok) throw new Error("Stream unavailable");
      const data = await resp.json() as StreamData;
      setStreamData(data);
    } catch {
      toast({ title: "Stream unavailable", description: "Try downloading instead", variant: "destructive" });
    } finally {
      setStreaming(false);
    }
  };

  const handleDownload = async (quality: string) => {
    if (!selectedMovie) return;
    setDownloading(true);
    const key = selectedMovie.id || selectedMovie.title || "";
    try {
      const resp = await fetch(`/api/movies/download?id=${encodeURIComponent(key)}&title=${encodeURIComponent(selectedMovie.title || "")}&quality=${quality}`);
      const data = await resp.json() as { downloadUrl?: string; error?: string; title?: string };
      if (data.downloadUrl) {
        const filename = `${data.title || selectedMovie.title || "movie"}_${quality}.mp4`;
        const a = document.createElement("a");
        a.href = `/api/proxy?url=${encodeURIComponent(data.downloadUrl)}&filename=${encodeURIComponent(filename)}`;
        a.download = filename;
        a.click();
        toast({ title: "Download started", description: selectedMovie.title });
      } else {
        toast({ title: "Download unavailable", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const displayMovies = movies.length > 0 ? movies : [];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Video Player */}
        {streamData && selectedMovie && (
          <VideoPlayer stream={streamData} movie={selectedMovie} onClose={() => setStreamData(null)} />
        )}

        {/* Movie Detail Modal */}
        {selectedMovie && !streamData && (
          <MovieDetailModal
            movie={selectedMovie}
            onClose={() => setSelectedMovie(null)}
            onPlay={handlePlay}
            onDownload={handleDownload}
          />
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center neon-glow">
              <Film className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Movies</h1>
          </div>
          <p className="text-muted-foreground">Stream and download movies with subtitles in multiple languages</p>
        </div>

        {/* Search */}
        <form onSubmit={searchMovies} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search movies, series, documentaries..." className="pl-9 h-11" />
          </div>
          <Button type="submit" className="h-11" disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </form>

        {/* Genre filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {GENRES.map(g => (
            <button key={g} onClick={() => searchByGenre(g)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                activeGenre === g
                  ? "bg-primary text-white border-primary"
                  : "border-white/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}>
              {g}
            </button>
          ))}
        </div>

        {/* Search results */}
        {displayMovies.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">{displayMovies.length} results — click any movie to play or download</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {displayMovies.map((movie, i) => (
                <MovieCard key={movie.id || i} movie={movie} onClick={setSelectedMovie} />
              ))}
            </div>
          </div>
        )}

        {/* Trending */}
        {displayMovies.length === 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Film className="w-4 h-4 text-blue-400" />Trending Movies
              </h2>
              <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" onClick={() => { setLoadingTrending(true); fetch("/api/movies/trending").then(r => r.json()).then((d: { movies?: Movie[] }) => setTrending(d.movies || [])).finally(() => setLoadingTrending(false)); }}>
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </Button>
            </div>

            {loadingTrending ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="glass-card rounded-xl animate-pulse">
                    <div className="aspect-[2/3] bg-white/5 rounded-xl" />
                    <div className="p-2 space-y-1"><div className="h-2.5 bg-white/5 rounded w-3/4" /><div className="h-2 bg-white/5 rounded w-1/3" /></div>
                  </div>
                ))}
              </div>
            ) : trending.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {trending.map((movie, i) => (
                  <MovieCard key={movie.id || i} movie={movie} onClick={setSelectedMovie} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Film className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Search for any movie to get started</p>
                <p className="text-sm mt-1">Stream online with subtitles or download for offline viewing</p>
              </div>
            )}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          {[
            { icon: Play, label: "Stream Online", desc: "Watch directly in browser", color: "text-blue-400" },
            { icon: Download, label: "Download", desc: "Save for offline", color: "text-green-400" },
            { icon: Captions, label: "Subtitles", desc: "10+ languages", color: "text-purple-400" },
            { icon: Settings, label: "Quality", desc: "4K to 360p", color: "text-amber-400" },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="glass-card rounded-xl p-3 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
