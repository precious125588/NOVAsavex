import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Play, Download, Loader2, Star, Swords, ChevronRight, X, ExternalLink } from "lucide-react";

interface AnimeItem {
  id: string;
  title: string;
  image?: string;
  status?: string;
  episodes?: number | string;
  rating?: string;
  genres?: string[];
  synopsis?: string;
  type?: string;
  url?: string;
}

interface Episode {
  id: string;
  episodeId?: string;
  number?: number | string;
  title?: string;
  url?: string;
}

interface StreamData {
  streamUrl: string;
  sources?: Array<{ url: string; quality: string }>;
  subtitles?: unknown[];
  title?: string;
}

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];

function AnimeCard({ anime, onClick }: { anime: AnimeItem; onClick: (anime: AnimeItem) => void }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden cursor-pointer group hover:ring-1 hover:ring-primary/50 transition-all" onClick={() => onClick(anime)}>
      <div className="relative aspect-[3/4] bg-black/40">
        {anime.image ? (
          <img src={anime.image} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Swords className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-xs font-medium text-white line-clamp-2 leading-tight">{anime.title}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {anime.rating && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                <Star className="w-2.5 h-2.5 fill-amber-400" />{anime.rating}
              </span>
            )}
            {anime.episodes && <span className="text-[10px] text-muted-foreground">{anime.episodes} eps</span>}
            {anime.status && <Badge variant="outline" className="text-[9px] h-3 px-1 border-none bg-black/50">{anime.status}</Badge>}
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamModal({ streamData, title, onClose }: { streamData: StreamData; title: string; onClose: () => void }) {
  const { toast } = useToast();
  const handleDownload = () => {
    const url = streamData.streamUrl;
    const a = document.createElement("a");
    a.href = `/api/proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(title + ".mp4")}`;
    a.download = `${title}.mp4`;
    a.click();
    toast({ title: "Download started" });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {streamData.sources && streamData.sources.length > 1 && (
            <p className="text-xs text-muted-foreground">{streamData.sources.length} quality options</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" />Download
          </Button>
          <a href={streamData.streamUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-8 gap-1">
              <ExternalLink className="w-3.5 h-3.5" />Open
            </Button>
          </a>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
      </div>
      <div className="flex-1 bg-black">
        <video
          src={streamData.streamUrl}
          controls
          autoPlay
          className="w-full h-full"
          onError={() => toast({ title: "Stream error", description: "Try downloading instead", variant: "destructive" })}
        />
      </div>
    </div>
  );
}

export default function Anime() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEps, setLoadingEps] = useState(false);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  useEffect(() => {
    setSearching(true);
    fetch("/api/anime/search?q=popular")
      .then(r => r.json())
      .then((data: { animes?: AnimeItem[] }) => { setAnimes(data.animes || []); })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, []);

  const searchAnime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setAnimes([]);
    setSelectedAnime(null);
    try {
      const resp = await fetch(`/api/anime/search?q=${encodeURIComponent(query)}`);
      const data = await resp.json() as { animes?: AnimeItem[] };
      setAnimes(data.animes || []);
      if (!data.animes?.length) toast({ title: "No results", description: "Try a different title" });
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const loadAnimeInfo = async (anime: AnimeItem) => {
    setSelectedAnime(anime);
    setEpisodes([]);
    setLoadingEps(true);
    try {
      const resp = await fetch(`/api/anime/info?id=${encodeURIComponent(anime.id || anime.url || "")}`);
      const data = await resp.json() as { episodes?: Episode[]; data?: { episodes?: Episode[] } };
      const eps = data.episodes || data.data?.episodes || [];
      setEpisodes(eps);
    } catch {
      toast({ title: "Could not load episodes", variant: "destructive" });
    } finally {
      setLoadingEps(false);
    }
  };

  const streamEpisode = async (ep: Episode) => {
    const epId = ep.episodeId || ep.id || "";
    setStreamingId(epId);
    try {
      const resp = await fetch(`/api/anime/stream?episodeId=${encodeURIComponent(epId)}`);
      if (!resp.ok) throw new Error("Stream not available");
      const data = await resp.json() as StreamData;
      setStreamData(data);
      setStreamTitle(`${selectedAnime?.title || ""} - Episode ${ep.number || ep.id}`);
    } catch {
      toast({ title: "Stream unavailable", description: "Try downloading instead", variant: "destructive" });
    } finally {
      setStreamingId(null);
    }
  };

  const downloadEpisode = async (ep: Episode) => {
    const epId = ep.episodeId || ep.id || "";
    const title = `${selectedAnime?.title || "anime"}_ep${ep.number || ep.id}`;
    try {
      const resp = await fetch(`/api/anime/download?episodeId=${encodeURIComponent(epId)}`);
      const data = await resp.json() as { downloadUrl?: string; error?: string };
      if (data.downloadUrl) {
        const a = document.createElement("a");
        a.href = `/api/proxy?url=${encodeURIComponent(data.downloadUrl)}&filename=${encodeURIComponent(title + ".mp4")}`;
        a.download = `${title}.mp4`;
        a.click();
        toast({ title: "Download started", description: title });
      } else {
        toast({ title: "Download unavailable", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const searchByGenre = (genre: string) => {
    setActiveGenre(genre);
    setQuery(genre);
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    setTimeout(() => searchAnime(fakeEvent), 100);
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {streamData && (
          <StreamModal streamData={streamData} title={streamTitle} onClose={() => setStreamData(null)} />
        )}

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center neon-glow">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Anime Hub</h1>
          </div>
          <p className="text-muted-foreground">Search, stream, and download your favorite anime</p>
        </div>

        <form onSubmit={searchAnime} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search anime title..." className="pl-9 h-11" />
          </div>
          <Button type="submit" className="h-11" disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </form>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {GENRES.map(genre => (
            <button key={genre} onClick={() => searchByGenre(genre)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                activeGenre === genre
                  ? "bg-primary text-white border-primary"
                  : "border-white/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}>
              {genre}
            </button>
          ))}
        </div>

        {selectedAnime && (
          <div className="glass-card rounded-2xl p-4 space-y-4 border border-indigo-500/20">
            <div className="flex gap-4">
              {selectedAnime.image && <img src={selectedAnime.image} alt={selectedAnime.title} className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />}
              <div className="flex-1 min-w-0 space-y-1">
                <h2 className="font-bold text-lg">{selectedAnime.title}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAnime.status && <Badge variant="outline" className="text-xs">{selectedAnime.status}</Badge>}
                  {selectedAnime.episodes && <Badge variant="outline" className="text-xs">{selectedAnime.episodes} eps</Badge>}
                  {selectedAnime.rating && <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">★ {selectedAnime.rating}</Badge>}
                </div>
                {selectedAnime.synopsis && <p className="text-xs text-muted-foreground line-clamp-3">{selectedAnime.synopsis}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelectedAnime(null)}><X className="w-4 h-4" /></Button>
            </div>

            {loadingEps && (
              <div className="flex items-center gap-2 justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm text-muted-foreground">Loading episodes...</span>
              </div>
            )}

            {episodes.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Episodes ({episodes.length})</p>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {episodes.map((ep, i) => {
                    const epId = ep.episodeId || ep.id || "";
                    return (
                      <div key={epId || i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 group">
                        <span className="text-xs text-muted-foreground w-8">Ep {ep.number || i + 1}</span>
                        <span className="flex-1 text-sm truncate">{ep.title || `Episode ${ep.number || i + 1}`}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => streamEpisode(ep)} disabled={streamingId === epId}>
                            {streamingId === epId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}Watch
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={() => downloadEpisode(ep)}>
                            <Download className="w-3 h-3" />DL
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!loadingEps && episodes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No episodes found. Try watching directly:</p>
            )}

            {selectedAnime.url && (
              <a href={selectedAnime.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-2 w-full">
                  <ExternalLink className="w-3.5 h-3.5" />Watch on Source
                </Button>
              </a>
            )}
          </div>
        )}

        {animes.length > 0 && !selectedAnime && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">{animes.length} results — click to see episodes</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {animes.map((anime, i) => (
                <AnimeCard key={anime.id || i} anime={anime} onClick={loadAnimeInfo} />
              ))}
            </div>
          </div>
        )}

        {animes.length === 0 && !selectedAnime && !searching && (
          <div className="text-center py-12 text-muted-foreground">
            <Swords className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Search for any anime</p>
            <p className="text-sm">Watch online or download episodes for offline viewing</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
