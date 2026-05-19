import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetHistory, getGetHistoryQueryKey } from "@workspace/api-client-react";
import {
  Search, Download, Film, Music, Image, List, Zap, Globe,
  CheckCircle2, AlertCircle, Clock, Scissors, RefreshCw, Trash2,
} from "lucide-react";
import { SiTiktok, SiYoutube, SiPinterest, SiSpotify } from "react-icons/si";
import { Link } from "wouter";

interface MediaItem { url: string; quality: string; format: string; label: string; fileSize?: number | null }
interface LocalJob {
  jobId: string; status: string; url: string; platform: string;
  contentType: string; title?: string | null; thumbnail?: string | null;
  author?: string | null; duration?: number | null; mediaItems: MediaItem[];
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  ready:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed:     "bg-red-500/15 text-red-400 border-red-500/30",
  processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  pending:    "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  ready:      <CheckCircle2 className="w-3 h-3" />,
  failed:     <AlertCircle className="w-3 h-3" />,
  processing: <Clock className="w-3 h-3" />,
  pending:    <Clock className="w-3 h-3" />,
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  tiktok:    <SiTiktok    className="w-4 h-4 text-pink-400"   />,
  youtube:   <SiYoutube   className="w-4 h-4 text-red-400"    />,
  pinterest: <SiPinterest className="w-4 h-4 text-rose-400"   />,
  spotify:   <SiSpotify   className="w-4 h-4 text-green-400"  />,
  unknown:   <Globe        className="w-4 h-4 text-muted-foreground" />,
};

const CONTENT_ICONS: Record<string, React.ReactNode> = {
  video:    <Film   className="w-3 h-3" />,
  audio:    <Music  className="w-3 h-3" />,
  song:     <Music  className="w-3 h-3" />,
  image:    <Image  className="w-3 h-3" />,
  playlist: <List   className="w-3 h-3" />,
  shorts:   <Zap    className="w-3 h-3" />,
  pin:      <Image  className="w-3 h-3" />,
  unknown:  <Globe  className="w-3 h-3" />,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildProxyUrl(mediaUrl: string, filename: string): string {
  return `/api/proxy?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
}

export default function History() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");

  const { data: apiHistory, isLoading } = useGetHistory(
    { limit: 100 },
    { query: { queryKey: getGetHistoryQueryKey({ limit: 100 }) } }
  );

  const localJobs: LocalJob[] = useMemo(() => {
    try {
      const saved = localStorage.getItem("novasave_jobs");
      return saved ? (JSON.parse(saved) as LocalJob[]) : [];
    } catch { return []; }
  }, []);

  const localMap = useMemo(() => {
    const map = new Map<string, LocalJob>();
    for (const j of localJobs) map.set(j.jobId, j);
    return map;
  }, [localJobs]);

  const merged = useMemo(() => {
    const apiIds = new Set((apiHistory || []).map(h => h.jobId));
    const localOnly = localJobs.filter(j => !apiIds.has(j.jobId));
    const combined = [
      ...(apiHistory || []).map(h => ({
        jobId: h.jobId, status: h.status, url: h.url,
        platform: h.platform, contentType: h.contentType,
        title: h.title, thumbnail: h.thumbnail, createdAt: h.createdAt,
        mediaItems: localMap.get(h.jobId)?.mediaItems ?? [],
        author: localMap.get(h.jobId)?.author ?? null,
        duration: localMap.get(h.jobId)?.duration ?? null,
      })),
      ...localOnly.map(j => ({ ...j })),
    ];
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
  }, [apiHistory, localJobs, localMap]);

  const filtered = merged.filter(item => {
    const matchSearch = !search || (item.title || item.url || "").toLowerCase().includes(search.toLowerCase());
    const matchPlatform = platform === "all" || item.platform === platform;
    return matchSearch && matchPlatform;
  });

  function openInStudio(item: { url: string; title?: string | null; mediaItems: MediaItem[]; contentType: string }) {
    const vidItem = item.mediaItems.find(m => ["mp4","mov","webm","mkv"].includes(m.format));
    const audioItem = item.mediaItems.find(m => ["mp3","m4a","aac"].includes(m.format));
    const mediaItem = vidItem || audioItem || item.mediaItems[0];
    const baseName = (item.title || "media").replace(/[^a-zA-Z0-9\s_-]/g, "").trim().slice(0, 50) || "media";
    if (mediaItem) {
      sessionStorage.setItem("novasave_studio", JSON.stringify({
        mediaUrl: mediaItem.url,
        filename: `${baseName}.${mediaItem.format}`,
        mode: vidItem ? "trim" : "enhance",
      }));
      navigate("/studio");
    } else {
      sessionStorage.setItem("novasave_studio", JSON.stringify({
        mediaUrl: item.url,
        filename: `${baseName}`,
        mode: "trim",
      }));
      navigate("/studio");
    }
  }

  function reDownload(url: string) {
    navigate("/");
    setTimeout(() => {
      const event = new CustomEvent("novasave_prefill", { detail: { url } });
      window.dispatchEvent(event);
    }, 300);
  }

  function clearLocalHistory() {
    localStorage.removeItem("novasave_jobs");
    window.location.reload();
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Download History</h1>
            <p className="text-muted-foreground text-sm">
              Your downloads — saved locally so they're always here when you return.
            </p>
          </div>
          {localJobs.length > 0 && (
            <Button
              variant="ghost" size="sm"
              className="text-xs text-muted-foreground gap-1 hover:text-red-400"
              onClick={clearLocalHistory}
            >
              <Trash2 className="w-3 h-3" />Clear saved
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or URL…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["all", "tiktok", "youtube", "pinterest", "spotify"].map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  platform === p
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "border-border text-muted-foreground hover:border-primary/20 hover:text-foreground"
                }`}
              >
                {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-4 flex items-center gap-3">
                <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Download className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="font-semibold text-foreground mb-2">No downloads yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              {search || platform !== "all"
                ? "No results match your filters."
                : "Start downloading something — it'll show up here and stay even after you close the app."}
            </p>
            <Link href="/">
              <button className="text-sm text-primary hover:underline">Go to Downloader</button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, i) => {
              const hasMedia = item.mediaItems.length > 0;
              const isVideo = item.contentType === "video" || item.contentType === "shorts";
              const isAudio = item.contentType === "audio" || item.contentType === "song";
              const baseName = (item.title || "media").replace(/[^a-zA-Z0-9\s_-]/g, "").trim().slice(0, 50) || "media";
              return (
                <div
                  key={item.jobId}
                  className="glass-card rounded-xl border border-white/8 hover:border-primary/20 transition-all duration-150 overflow-hidden"
                >
                  {/* Main row */}
                  <div className="flex items-center gap-3 p-4">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title || ""}
                        className="w-14 h-14 object-cover rounded-lg border border-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {PLATFORM_ICONS[item.platform] || <Globe className="w-5 h-5 text-muted-foreground" />}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate mb-1">
                        {item.title || item.url}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {PLATFORM_ICONS[item.platform]}
                          <span className="capitalize">{item.platform}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {CONTENT_ICONS[item.contentType] || <Globe className="w-3 h-3" />}
                          <span className="capitalize">{item.contentType}</span>
                        </span>
                        <span className="text-xs text-muted-foreground/60">{timeAgo(item.createdAt)}</span>
                      </div>
                    </div>

                    <Badge className={`text-xs border shrink-0 flex items-center gap-1 ${STATUS_STYLES[item.status] || STATUS_STYLES.pending}`}>
                      {STATUS_ICONS[item.status]}
                      <span className="capitalize">{item.status}</span>
                    </Badge>
                  </div>

                  {/* Action row for ready items */}
                  {item.status === "ready" && (
                    <div className="border-t border-white/6 px-4 py-3 bg-black/10 flex flex-wrap gap-2 items-center">
                      {/* Download buttons for each media item */}
                      {hasMedia && item.mediaItems.slice(0, 3).map((mi, idx) => {
                        const filename = `${baseName}_${mi.quality || idx}.${mi.format}`;
                        return (
                          <a key={idx} href={buildProxyUrl(mi.url, filename)} download={filename}>
                            <Button size="sm" className="h-7 px-3 gap-1 text-xs bg-primary hover:bg-primary/90 text-white border-0">
                              <Download className="w-3 h-3" />
                              {mi.label || `${mi.quality} ${mi.format.toUpperCase()}`}
                              {mi.fileSize ? ` · ${formatBytes(mi.fileSize)}` : ""}
                            </Button>
                          </a>
                        );
                      })}

                      {/* Studio button */}
                      {(isVideo || isAudio || hasMedia) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 gap-1 text-xs border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                          onClick={() => openInStudio(item)}
                        >
                          <Scissors className="w-3 h-3" />Open in Studio
                        </Button>
                      )}

                      {/* Re-download original */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-3 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => reDownload(item.url)}
                      >
                        <RefreshCw className="w-3 h-3" />Re-download
                      </Button>
                    </div>
                  )}

                  {/* Failed items — offer re-download */}
                  {item.status === "failed" && (
                    <div className="border-t border-white/6 px-4 py-2 bg-black/10 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex-1">Download failed</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-3 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => reDownload(item.url)}
                      >
                        <RefreshCw className="w-3 h-3" />Try again
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
