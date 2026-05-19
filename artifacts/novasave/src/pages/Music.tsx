import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Music as MusicIcon, Search, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX,
  Download, Loader2, Mic2, Heart, Shuffle, Repeat, ChevronDown, ChevronUp,
  ListMusic, ExternalLink, Disc3,
} from "lucide-react";

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number | string;
  thumbnail?: string;
  previewUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
}

interface LyricsData {
  lyrics: string;
  title: string;
  artist: string;
  thumbnail?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ song, previewUrl }: { song: Song; previewUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => { audio.removeEventListener("timeupdate", onTime); audio.removeEventListener("loadedmetadata", onLoaded); audio.removeEventListener("ended", onEnded); };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
    setPlaying(!playing);
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = parseFloat(e.target.value);
  };

  const changeVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <div className="bg-black/30 rounded-xl p-4 space-y-3">
      <audio ref={audioRef} src={previewUrl} preload="metadata" />
      <div className="flex items-center gap-3">
        {song.thumbnail && <img src={song.thumbnail} alt="cover" className="w-12 h-12 rounded-lg object-cover" />}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{song.title}</p>
          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        </div>
        <Disc3 className={`w-5 h-5 text-primary ${playing ? "animate-spin" : ""}`} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-10 text-right font-mono">{formatTime(currentTime)}</span>
        <input type="range" min={0} max={duration || 30} value={currentTime} onChange={seek} className="flex-1 accent-purple-500 h-1 cursor-pointer" />
        <span className="text-xs text-muted-foreground w-10 font-mono">{duration ? formatTime(duration) : "0:30"}</span>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button className="text-muted-foreground hover:text-foreground transition-colors"><SkipBack className="w-4 h-4" /></button>
        <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors">
          {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
        </button>
        <button className="text-muted-foreground hover:text-foreground transition-colors"><SkipForward className="w-4 h-4" /></button>
        <div className="flex items-center gap-1 ml-4">
          <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={changeVolume} className="w-16 accent-purple-500 h-1 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

function SongCard({ song, onPlay, onGetLyrics, onDownload }: {
  song: Song;
  onPlay: (song: Song) => void;
  onGetLyrics: (song: Song) => void;
  onDownload: (song: Song) => void;
}) {
  return (
    <div className="glass-card rounded-xl p-3 flex items-center gap-3 hover:bg-white/5 transition-all group">
      <div className="relative w-12 h-12 flex-shrink-0">
        {song.thumbnail ? (
          <img src={song.thumbnail} alt="cover" className="w-12 h-12 rounded-lg object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <MusicIcon className="w-5 h-5 text-white" />
          </div>
        )}
        <button onClick={() => onPlay(song)} className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-4 h-4 text-white ml-0.5" />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}{song.album ? ` · ${song.album}` : ""}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onGetLyrics(song)} title="Get lyrics">
          <Mic2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(song)} title="Download">
          <Download className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function MusicPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<{ song: Song; url: string } | null>(null);
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setSearching(true);
    fetch("/api/music/search?q=top+hits")
      .then(r => r.json())
      .then((data: { songs?: Song[] }) => { setSongs(data.songs || []); })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, []);

  const searchSongs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSongs([]);
    try {
      const resp = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      const data = await resp.json() as { songs?: Song[]; message?: string };
      setSongs(data.songs || []);
      if (!data.songs?.length) toast({ title: "No results", description: "Try a different search term" });
    } catch {
      toast({ title: "Search failed", description: "Please try again", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handlePlay = (song: Song) => {
    if (song.previewUrl) {
      setNowPlaying({ song, url: song.previewUrl });
    } else {
      toast({ title: "No preview available", description: "Try downloading the full song" });
    }
  };

  const handleGetLyrics = async (song: Song) => {
    setLyricsLoading(true);
    setShowLyrics(true);
    setLyrics(null);
    try {
      const resp = await fetch(`/api/music/lyrics?title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`);
      if (!resp.ok) throw new Error("Not found");
      const data = await resp.json() as LyricsData;
      setLyrics(data);
    } catch {
      toast({ title: "Lyrics not found", description: "Could not find lyrics for this song", variant: "destructive" });
      setShowLyrics(false);
    } finally {
      setLyricsLoading(false);
    }
  };

  const handleDownload = async (song: Song) => {
    const url = song.spotifyUrl || song.youtubeUrl;
    if (!url) {
      toast({ title: "No download URL", description: "Paste a Spotify or YouTube link below to download" });
      return;
    }
    setDownloading(true);
    try {
      const resp = await fetch(`/api/music/download?url=${encodeURIComponent(url)}`);
      const data = await resp.json() as { downloadUrl?: string; error?: string };
      if (data.downloadUrl) {
        const a = document.createElement("a");
        a.href = `/api/proxy?url=${encodeURIComponent(data.downloadUrl)}&filename=${encodeURIComponent(song.title + ".mp3")}`;
        a.download = `${song.title} - ${song.artist}.mp3`;
        a.click();
        toast({ title: "Download started", description: song.title });
      } else {
        toast({ title: "Download failed", description: data.error || "Try again", variant: "destructive" });
      }
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDirectDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadUrl.trim()) return;
    setDownloading(true);
    try {
      const resp = await fetch(`/api/music/download?url=${encodeURIComponent(downloadUrl)}`);
      const data = await resp.json() as { downloadUrl?: string; title?: string; artist?: string; error?: string };
      if (data.downloadUrl) {
        const filename = `${data.title || "song"} - ${data.artist || ""}.mp3`;
        const a = document.createElement("a");
        a.href = `/api/proxy?url=${encodeURIComponent(data.downloadUrl)}&filename=${encodeURIComponent(filename)}`;
        a.download = filename;
        a.click();
        toast({ title: "Download started", description: data.title || "Song" });
        setDownloadUrl("");
      } else {
        toast({ title: "Download failed", description: data.error || "Invalid URL", variant: "destructive" });
      }
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center neon-glow">
              <MusicIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Music Player</h1>
          </div>
          <p className="text-muted-foreground">Search songs, play previews, view lyrics, and download music</p>
        </div>

        {/* Now playing */}
        {nowPlaying && (
          <div className="glass-card rounded-2xl p-4 border border-green-500/20 bg-gradient-to-br from-green-900/20 to-emerald-900/20">
            <div className="flex items-center gap-2 mb-3">
              <Disc3 className="w-4 h-4 text-green-400 animate-spin" />
              <span className="text-sm font-medium text-green-400">Now Playing</span>
            </div>
            <AudioPlayer song={nowPlaying.song} previewUrl={nowPlaying.url} />
          </div>
        )}

        {/* Lyrics */}
        {showLyrics && (
          <div className="glass-card rounded-2xl p-4 border border-purple-500/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-400">Lyrics</span>
                {lyrics && <span className="text-sm text-muted-foreground">— {lyrics.title} by {lyrics.artist}</span>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowLyrics(false)}>
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
            {lyricsLoading && (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-muted-foreground">Fetching lyrics...</span>
              </div>
            )}
            {lyrics && !lyricsLoading && (
              <div className="max-h-80 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">{lyrics.lyrics}</pre>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <form onSubmit={searchSongs} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search songs, artists, albums..."
                className="pl-9 h-11"
              />
            </div>
            <Button type="submit" className="h-11 gap-2" disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
          </form>
        </div>

        {/* Search results */}
        {songs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{songs.length} results</span>
            </div>
            <div className="space-y-1">
              {songs.map((song, i) => (
                <SongCard key={song.id || i} song={song} onPlay={handlePlay} onGetLyrics={handleGetLyrics} onDownload={handleDownload} />
              ))}
            </div>
          </div>
        )}

        {/* Direct download */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-green-400" />
            Download from Spotify / YouTube
          </h3>
          <form onSubmit={handleDirectDownload} className="flex gap-2">
            <Input
              value={downloadUrl}
              onChange={e => setDownloadUrl(e.target.value)}
              placeholder="Paste Spotify track or YouTube URL..."
              className="flex-1 h-11"
            />
            <Button type="submit" className="h-11 gap-2 bg-green-600 hover:bg-green-700" disabled={downloading}>
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Downloading..." : "Download"}
            </Button>
          </form>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">Spotify Tracks</Badge>
            <Badge variant="outline" className="text-xs">YouTube Music</Badge>
            <Badge variant="outline" className="text-xs">MP3 Format</Badge>
          </div>
        </div>
      </div>
    </Layout>
  );
}
