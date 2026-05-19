import { useState, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Radio, Download, Loader2, Video, ImageIcon, Play, Share2, Copy,
  Check, X, Pin, EyeOff, Trash2, Globe, RefreshCw, ChevronDown,
  Music2, Film, Image, Headphones, Filter, Search,
} from "lucide-react";
import {
  SiTiktok, SiInstagram, SiYoutube, SiPinterest, SiWhatsapp,
  SiFacebook, SiSpotify,
} from "react-icons/si";

function SiTwitter({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface MediaItem {
  url: string;
  quality: string;
  format: string;
  label: string;
  fileSize?: number | null;
}

interface FeedItem {
  jobId: string;
  status: string;
  url: string;
  platform: string;
  contentType: string;
  title?: string | null;
  thumbnail?: string | null;
  author?: string | null;
  duration?: number | null;
  mediaItems: MediaItem[];
  createdAt: string;
  pinned?: boolean;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const PLATFORM_ICONS: Record<string, React.ElementType> = {
  tiktok: SiTiktok, instagram: SiInstagram, youtube: SiYoutube,
  pinterest: SiPinterest, facebook: SiFacebook, twitter: SiTwitter,
  spotify: SiSpotify, whatsapp: SiWhatsapp,
};
const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#ff0050", instagram: "#e4405f", youtube: "#ff0000",
  pinterest: "#e60023", facebook: "#1877f2", twitter: "#1da1f2",
  spotify: "#1db954", whatsapp: "#25d366",
};

function getMime(format: string): string {
  const map: Record<string, string> = {
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    mkv: "video/x-matroska", m4v: "video/mp4", "3gp": "video/3gpp",
    mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac",
    ogg: "audio/ogg", wav: "audio/wav", flac: "audio/flac",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp",
  };
  return map[format.toLowerCase()] || "application/octet-stream";
}

function isVideoFormat(fmt: string) {
  return ["mp4", "webm", "mov", "mkv", "m4v", "3gp", "flv", "avi"].includes(fmt.toLowerCase());
}

function isAudioFormat(fmt: string) {
  return ["mp3", "m4a", "aac", "ogg", "wav", "flac"].includes(fmt.toLowerCase());
}

function formatDuration(secs?: number | null): string {
  if (!secs) return "";
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── REAL MEDIA SHARE ─────────────────────────────────────────────────────────
async function shareRealMedia(
  mediaUrl: string,
  filename: string,
  format: string,
  title: string,
  toast: ReturnType<typeof useToast>["toast"],
  setSharing: (v: boolean) => void
) {
  setSharing(true);
  try {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;

    // Try native file sharing (mobile/desktop that supports it)
    if (typeof navigator !== "undefined" && "share" in navigator) {
      // Fetch the actual file as blob
      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const blob = await resp.blob();
      const mimeType = getMime(format);
      const file = new File([blob], filename, { type: mimeType });

      // Check if browser supports sharing files
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }

      // Fallback: share just the title + text (no file)
      if (navigator.canShare && navigator.canShare({ title, text: title })) {
        await navigator.share({ title, text: `Download: ${title}` });
        return;
      }
    }

    // Final fallback: trigger direct download of the real file
    const a = document.createElement("a");
    a.href = `/api/proxy?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "Sharing not supported — file downloaded instead" });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return; // user cancelled
    toast({ title: "Share failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
  } finally {
    setSharing(false);
  }
}

// ─── FEED CARD ────────────────────────────────────────────────────────────────
function FeedCard({
  item,
  adminToken,
  onHide,
  onPin,
}: {
  item: FeedItem;
  adminToken?: string;
  onHide?: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
}) {
  const { toast } = useToast();
  const [playing, setPlaying] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const media = item.mediaItems?.[selectedIdx] || item.mediaItems?.[0];
  if (!media) return null;

  const isVid = isVideoFormat(media.format);
  const isAud = isAudioFormat(media.format);
  const filename = `${(item.title || item.platform || "media").replace(/[^a-zA-Z0-9\s_-]/g, "").trim().slice(0, 40) || "media"}.${media.format}`;
  const proxyDl = `/api/proxy?url=${encodeURIComponent(media.url)}&filename=${encodeURIComponent(filename)}`;

  const PlatIcon = PLATFORM_ICONS[item.platform] || Globe;
  const platColor = PLATFORM_COLORS[item.platform] || "#888";

  const copyLink = async () => {
    setCopying(true);
    const shareLink = `${window.location.origin}/status/${item.jobId}`;
    try { await navigator.clipboard.writeText(shareLink); toast({ title: "Page link copied!" }); }
    catch { toast({ title: "Could not copy", variant: "destructive" }); }
    setTimeout(() => setCopying(false), 2000);
  };

  const handleShare = () => shareRealMedia(media.url, filename, media.format, item.title || item.platform, toast, setSharing);

  return (
    <div className={`glass-card rounded-2xl overflow-hidden border ${item.pinned ? "border-amber-500/40" : "border-white/8"} relative group`}>
      {item.pinned && (
        <div className="absolute top-2 left-2 z-20">
          <Badge className="text-[10px] h-5 bg-amber-500/80 text-white border-0 gap-1">
            <Pin className="w-2.5 h-2.5" />Pinned
          </Badge>
        </div>
      )}

      {/* Media preview */}
      <div className="relative aspect-video bg-black/50">
        {isVid ? (
          playing ? (
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                src={media.url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain bg-black"
                onError={() => {
                  // Fallback to proxy stream
                  if (videoRef.current) videoRef.current.src = proxyDl;
                }}
              />
              <button onClick={() => setPlaying(false)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-white z-10 hover:bg-black">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {item.thumbnail
                ? <img src={item.thumbnail} alt={item.title || ""} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center bg-black/30"><Film className="w-10 h-10 text-white/20" /></div>
              }
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors cursor-pointer" onClick={() => setPlaying(true)}>
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all">
                  <Play className="w-6 h-6 text-white ml-0.5" />
                </div>
              </div>
            </>
          )
        ) : isAud ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-purple-900/40 to-blue-900/40 p-4">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <Headphones className="w-8 h-8 text-white/60" />
            </div>
            {item.thumbnail && <img src={item.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />}
            <audio src={media.url} controls className="w-full max-w-[240px] rounded-lg" />
          </div>
        ) : (
          <img src={media.url} alt={item.title || "media"} className="w-full h-full object-cover" />
        )}

        {/* Platform badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className="w-6 h-6 rounded-full flex items-center justify-center bg-black/60 backdrop-blur">
            <PlatIcon style={{ color: platColor }} className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Duration */}
        {item.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-[10px] text-white font-mono">
            {formatDuration(item.duration)}
          </div>
        )}
      </div>

      {/* Quality selector */}
      {item.mediaItems.length > 1 && (
        <div className="px-3 pt-2 flex gap-1 flex-wrap">
          {item.mediaItems.map((m, i) => (
            <button key={i} onClick={() => setSelectedIdx(i)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${selectedIdx === i ? "bg-primary/20 border-primary/40 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
              {m.label || m.quality || m.format}
            </button>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="p-3 space-y-2.5">
        <div>
          {item.title && <p className="text-sm font-semibold line-clamp-1">{item.title}</p>}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-muted-foreground capitalize">{item.platform}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(item.createdAt)}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground uppercase">{media.format}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5">
          {/* Download real file */}
          <a href={proxyDl} download={filename} className="flex-1">
            <Button size="sm" className="w-full h-8 gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />Save
            </Button>
          </a>

          {/* Share REAL media file */}
          <Button size="sm" variant="outline" className="h-8 px-2.5 gap-1 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={handleShare} disabled={sharing} title="Share real media file">
            {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
          </Button>

          {/* Copy page link */}
          <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={copyLink} title="Copy shareable link">
            {copying ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>

        {/* Admin controls */}
        {adminToken && (
          <div className="flex gap-1.5 pt-1 border-t border-white/5">
            <Button size="sm" variant="ghost" className={`h-7 px-2 text-[11px] gap-1 flex-1 ${item.pinned ? "text-amber-400" : "text-muted-foreground"}`}
              onClick={() => onPin?.(item.jobId, !item.pinned)}>
              <Pin className="w-3 h-3" />{item.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] gap-1 flex-1 text-red-400 hover:bg-red-500/10"
              onClick={() => onHide?.(item.jobId)}>
              <EyeOff className="w-3 h-3" />Hide
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DOWNLOADER BAR ───────────────────────────────────────────────────────────
function DownloaderBar() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = url.trim();
    if (!t) return;
    setLoading(true);
    setProgress("Submitting…");
    try {
      const resp = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: t, quality: "hd", format: "auto" }),
      });
      const job = await resp.json() as { jobId?: string; error?: string };
      if (!resp.ok || !job.jobId) throw new Error(job.error || "Submission failed");
      setProgress("Processing…");

      let attempts = 0;
      await new Promise<void>((resolve, reject) => {
        const iv = setInterval(async () => {
          attempts++;
          try {
            const pr = await fetch(`/api/download/${job.jobId}`);
            const pd = await pr.json() as { status?: string; error?: string };
            if (pd.status === "ready") { clearInterval(iv); resolve(); }
            else if (pd.status === "failed" || attempts >= 30) { clearInterval(iv); reject(new Error(pd.error || "Timed out")); }
            else setProgress(`Processing… (${attempts * 1.5}s)`);
          } catch (err) { clearInterval(iv); reject(err); }
        }, 1500);
      });

      toast({ title: "Download added to feed!", description: "Scroll down to see it" });
      setUrl("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Unknown", variant: "destructive" });
    } finally { setLoading(false); setProgress(""); }
  };

  return (
    <div className="glass-card rounded-2xl p-4 border border-white/8 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Radio className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold">Add to Public Feed</span>
        <Badge variant="outline" className="text-[10px] h-4 ml-auto border-green-500/30 text-green-400">Public</Badge>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="Paste TikTok, YouTube, Instagram, Twitter, Facebook URL…"
          className="flex-1 h-11" disabled={loading} />
        <Button type="submit" className="h-11 gap-2 px-5 whitespace-nowrap" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? progress : "Download"}
        </Button>
      </form>
      <div className="flex gap-1.5 flex-wrap">
        {[
          { name: "TikTok", icon: SiTiktok, c: "#ff0050" },
          { name: "YouTube", icon: SiYoutube, c: "#ff0000" },
          { name: "Instagram", icon: SiInstagram, c: "#e4405f" },
          { name: "Twitter/X", icon: SiTwitter, c: "#1da1f2" },
          { name: "Facebook", icon: SiFacebook, c: "#1877f2" },
          { name: "Pinterest", icon: SiPinterest, c: "#e60023" },
          { name: "Spotify", icon: SiSpotify, c: "#1db954" },
        ].map(p => (
          <span key={p.name} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-white/5 rounded-full px-2.5 py-1">
            <p.icon style={{ color: p.c }} className="w-3 h-3" />{p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const PLATFORMS = ["all", "tiktok", "youtube", "instagram", "twitter", "facebook", "pinterest", "spotify"];

export default function StatusHub() {
  const { toast } = useToast();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [platform, setPlatform] = useState("all");
  const [search, setSearch] = useState("");
  const adminToken = localStorage.getItem("ns-admin-token") || "";
  const LIMIT = 20;

  const loadFeed = useCallback(async (reset = false) => {
    const newOffset = reset ? 0 : offset;
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const platformParam = platform !== "all" ? `&platform=${platform}` : "";
      const resp = await fetch(`/api/public-feed?limit=${LIMIT}&offset=${newOffset}${platformParam}`);
      if (!resp.ok) throw new Error("Failed to load feed");
      const data = await resp.json() as { items: FeedItem[]; hasMore: boolean };
      setItems(prev => reset ? data.items : [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setOffset(newOffset + LIMIT);
    } catch (err) {
      toast({ title: "Could not load feed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setLoading(false); setLoadingMore(false); }
  }, [platform, offset, toast]);

  useEffect(() => { loadFeed(true); }, [platform]); // eslint-disable-line

  // Poll for new items every 15s
  useEffect(() => {
    const iv = setInterval(() => loadFeed(true), 15000);
    return () => clearInterval(iv);
  }, [platform]); // eslint-disable-line

  const handleHide = async (jobId: string) => {
    if (!adminToken) return;
    try {
      await fetch(`/api/admin/feed/${jobId}`, { method: "DELETE", headers: { "x-admin-token": adminToken } });
      setItems(prev => prev.filter(i => i.jobId !== jobId));
      toast({ title: "Item hidden from feed" });
    } catch { toast({ title: "Failed to hide", variant: "destructive" }); }
  };

  const handlePin = async (jobId: string, pinned: boolean) => {
    if (!adminToken) return;
    try {
      await fetch(`/api/admin/feed/${jobId}/pin`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": adminToken }, body: JSON.stringify({ pinned }) });
      setItems(prev => prev.map(i => i.jobId === jobId ? { ...i, pinned } : i));
      toast({ title: pinned ? "Item pinned to top" : "Item unpinned" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const filtered = search.trim()
    ? items.filter(i => (i.title || "").toLowerCase().includes(search.toLowerCase()) || i.platform.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Layout page="home">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center neon-glow">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold">Public Feed</h1>
              <p className="text-xs text-muted-foreground">Every download — available to everyone</p>
            </div>
          </div>
        </div>

        {/* Download bar */}
        <DownloaderBar />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search feed…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {PLATFORMS.map(p => {
              const Ic = PLATFORM_ICONS[p];
              return (
                <button key={p} onClick={() => { setPlatform(p); setOffset(0); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${platform === p ? "bg-primary/20 border-primary/40 text-primary" : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"}`}>
                  {Ic ? <Ic style={{ color: PLATFORM_COLORS[p] }} className="w-3 h-3" /> : <Filter className="w-3 h-3" />}
                  <span className="capitalize">{p}</span>
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" onClick={() => loadFeed(true)} className="h-9 px-2.5 gap-1.5 text-muted-foreground ml-auto flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Feed grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl overflow-hidden border border-white/8 animate-pulse">
                <div className="aspect-video bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-white/5 rounded w-3/4" />
                  <div className="h-7 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border border-white/8">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-15" />
            <p className="font-semibold text-muted-foreground">No downloads yet</p>
            <p className="text-sm text-muted-foreground mt-1">Paste a URL above to add the first item to the public feed</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{filtered.length} items {search ? "matching" : "in feed"}</p>
              {adminToken && (
                <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 gap-1">
                  <Shield className="w-2.5 h-2.5" />Admin mode
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map(item => (
                <FeedCard
                  key={item.jobId}
                  item={item}
                  adminToken={adminToken}
                  onHide={handleHide}
                  onPin={handlePin}
                />
              ))}
            </div>
            {hasMore && !search && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => loadFeed(false)} disabled={loadingMore} className="gap-2 px-8">
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// Inline Shield icon (avoid extra import)
function Shield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
