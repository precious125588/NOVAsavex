import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Flame, Music, Film, Video, Loader2, Star, ExternalLink, TrendingUp, Download, RefreshCw } from "lucide-react";

type TrendingTab = "all" | "movies" | "songs" | "videos";

interface TrendingItem {
  id?: string;
  title?: string;
  name?: string;
  image?: string;
  thumbnail?: string;
  poster?: string;
  cover?: string;
  artist?: string;
  channel?: string;
  author?: string;
  rating?: number | string;
  views?: number | string;
  platform?: string;
  url?: string;
  type?: string;
  year?: string;
  genre?: string;
}

function TrendingCard({ item, tab, index }: { item: TrendingItem; tab: TrendingTab; index: number }) {
  const title = item.title || item.name || `Item ${index + 1}`;
  const thumb = item.image || item.thumbnail || item.poster || item.cover;
  const sub = item.artist || item.channel || item.author || item.genre || item.year;

  const handleOpen = () => { if (item.url) window.open(item.url, "_blank"); };

  return (
    <div className="glass-card rounded-xl overflow-hidden group hover:ring-1 hover:ring-primary/40 transition-all cursor-pointer" onClick={handleOpen}>
      <div className="relative aspect-video bg-black/40">
        {thumb ? (
          <img src={thumb} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {tab === "movies" ? <Film className="w-10 h-10 text-muted-foreground/30" /> :
             tab === "songs" ? <Music className="w-10 h-10 text-muted-foreground/30" /> :
             <Video className="w-10 h-10 text-muted-foreground/30" />}
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-[10px] font-bold text-white">#{index + 1}</span>
        </div>
        {item.rating && (
          <div className="absolute top-2 right-2 bg-black/70 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
            <span className="text-[10px] text-white">{item.rating}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-xs font-medium text-white line-clamp-2 leading-tight">{title}</p>
          {sub && <p className="text-[10px] text-white/60 mt-0.5">{sub}</p>}
        </div>
        {item.url && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>
      {item.views && (
        <div className="px-2 py-1.5">
          <p className="text-[10px] text-muted-foreground">{typeof item.views === "number" ? item.views.toLocaleString() : item.views} views</p>
        </div>
      )}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl overflow-hidden animate-pulse">
          <div className="aspect-video bg-white/5" />
          <div className="p-2 space-y-1">
            <div className="h-3 bg-white/5 rounded w-3/4" />
            <div className="h-2 bg-white/5 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Trending() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TrendingTab>("all");
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrending = async (tab: TrendingTab, showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setItems([]);

    try {
      const resp = await fetch(`/api/tools/trending?type=${tab}`);
      const data = await resp.json() as Record<string, unknown>;
      const pick = data.data ?? data.result ?? data.trending ?? data.movies ?? data.songs ?? data.videos ?? data.items ?? [];
      const list: TrendingItem[] = Array.isArray(pick) ? pick as TrendingItem[] : [];
      setItems(list);
      if (list.length === 0) toast({ title: "No trending data", description: "Try again later" });
    } catch {
      toast({ title: "Could not load trending data", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchTrending(activeTab); }, [activeTab]);

  const TABS: { id: TrendingTab; label: string; icon: React.ElementType; color: string }[] = [
    { id: "all", label: "All Trending", icon: Flame, color: "text-orange-400" },
    { id: "movies", label: "Movies", icon: Film, color: "text-blue-400" },
    { id: "songs", label: "Songs", icon: Music, color: "text-green-400" },
    { id: "videos", label: "Videos", icon: Video, color: "text-red-400" },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center neon-glow">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Trending Now</h1>
          </div>
          <p className="text-muted-foreground">Discover what's hot — movies, songs, and viral videos</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-black/20 rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? "text-white" : tab.color}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => fetchTrending(activeTab, true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <LoadingGrid />
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">No trending data available</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Try refreshing or check back later</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => fetchTrending(activeTab)}>
              <RefreshCw className="w-4 h-4" />Try Again
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <p className="text-sm text-muted-foreground">{items.length} trending {activeTab === "all" ? "items" : activeTab}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((item, i) => (
                <TrendingCard key={item.id || i} item={item} tab={activeTab} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
