import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Loader2, CheckCircle2, XCircle, Sparkles, Layers,
  Copy, Check, Share2, Scissors, Zap, ArrowRight, Music, ImageIcon,
  Video, ListMusic, Trash2, ExternalLink
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SiTiktok, SiYoutube, SiPinterest, SiSpotify } from "react-icons/si";
import { FaWhatsapp, FaTelegram, FaXTwitter, FaFacebook } from "react-icons/fa6";

type Platform = "tiktok" | "youtube" | "pinterest" | "spotify" | "unknown";
type Quality = "auto" | "720p" | "1080p" | "4k" | "audio_only";
type JobStatus = "pending" | "processing" | "ready" | "failed";

interface MediaItem { url: string; quality: string; format: string; label: string; fileSize?: number | null }
interface DownloadJob {
  jobId: string; status: JobStatus; url: string; platform: Platform;
  contentType: string; title?: string | null; thumbnail?: string | null;
  author?: string | null; duration?: number | null; mediaItems: MediaItem[];
  error?: string | null; createdAt: string; completedAt?: string | null;
  retryCount: number; apiUsed?: string | null;
}
interface BulkEntry { id: string; url: string; job: DownloadJob | null; status: "pending" | "processing" | "ready" | "failed" }

const PLATFORMS: Record<string, { label: string; color: string; Icon: React.ElementType; bg: string }> = {
  tiktok:    { label: "TikTok",    color: "#ff0050", Icon: SiTiktok,    bg: "from-pink-600/20 to-red-600/20" },
  youtube:   { label: "YouTube",   color: "#ff0000", Icon: SiYoutube,   bg: "from-red-600/20 to-red-800/20" },
  pinterest: { label: "Pinterest", color: "#e60023", Icon: SiPinterest, bg: "from-red-500/20 to-pink-600/20" },
  spotify:   { label: "Spotify",   color: "#1db954", Icon: SiSpotify,   bg: "from-green-600/20 to-emerald-600/20" },
};

const QUALITY_OPTIONS: { value: Quality; label: string; desc: string }[] = [
  { value: "auto",       label: "Auto",       desc: "Best available" },
  { value: "720p",       label: "HD 720p",    desc: "Balanced" },
  { value: "1080p",      label: "FHD 1080p",  desc: "High quality" },
  { value: "4k",         label: "4K / Max",   desc: "Highest quality" },
  { value: "audio_only", label: "Audio Only", desc: "MP3 extract" },
];

function detectPlatformFromUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) return "tiktok";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("pinterest.com") || url.includes("pin.it")) return "pinterest";
  if (url.includes("spotify.com") || url.includes("open.spotify.com")) return "spotify";
  return null;
}

function buildProxyUrl(mediaUrl: string, filename: string): string {
  return `/api/proxy?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(filename)}`;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMediaIcon(format: string, contentType?: string) {
  if (format === "mp3" || contentType === "audio" || contentType === "song") return <Music className="w-4 h-4" />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(format)) return <ImageIcon className="w-4 h-4" />;
  if (contentType === "playlist") return <ListMusic className="w-4 h-4" />;
  return <Video className="w-4 h-4" />;
}

function SharePanel({ mediaUrl, proxyUrl, title }: { mediaUrl: string; proxyUrl?: string; title?: string | null }) {
  const [copied, setCopied] = useState(false);
  // Use proxy URL for sharing actual file, not raw CDN URL (which may expire)
  const shareableUrl = proxyUrl ? `${window.location.origin}${proxyUrl}` : mediaUrl;
  const text = encodeURIComponent((title || "Check this out!") + " — via NOVAsavex");
  const enc = encodeURIComponent(shareableUrl);
  const shares = [
    { label: "WhatsApp",  Icon: FaWhatsapp,  href: `https://wa.me/?text=${text}%20${enc}`,                                         color: "text-green-400 hover:bg-green-400/10" },
    { label: "Telegram",  Icon: FaTelegram,  href: `https://t.me/share/url?url=${enc}&text=${text}`,                               color: "text-blue-400 hover:bg-blue-400/10"  },
    { label: "Twitter/X", Icon: FaXTwitter,  href: `https://twitter.com/intent/tweet?url=${enc}&text=${text}`,                     color: "text-sky-400 hover:bg-sky-400/10"    },
    { label: "Facebook",  Icon: FaFacebook,  href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,                         color: "text-blue-600 hover:bg-blue-600/10"  },
  ];

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || "Media", url: shareableUrl });
        return;
      } catch { /* fallback to copy */ }
    }
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-white/8">
      <span className="text-xs text-muted-foreground">Share:</span>
      {shares.map(({ label, Icon, href, color }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className={`h-7 px-2 gap-1 text-xs ${color}`}>
            <Icon className="w-3 h-3" /><span className="hidden sm:inline">{label}</span>
          </Button>
        </a>
      ))}
      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:bg-white/5"
        onClick={handleNativeShare}>
        {copied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></> : <><Copy className="w-3 h-3" />Copy link</>}
      </Button>
    </div>
  );
}

function DownloadCard({ job, onTransferToStudio }: { job: DownloadJob; onTransferToStudio: (url: string, filename: string, mode?: string) => void }) {
  const p = PLATFORMS[job.platform];
  const PlatformIcon = p?.Icon;
  const [expandedShare, setExpandedShare] = useState<number | null>(null);
  const baseName = (job.title || "media").replace(/[^a-zA-Z0-9\s_-]/g, "").trim().slice(0, 60) || "media";

  return (
    <div className={`glass-card rounded-2xl overflow-hidden border border-white/8 bg-gradient-to-br ${p?.bg || "from-purple-900/20 to-blue-900/20"}`}>
      {/* Header */}
      <div className="flex gap-4 p-5">
        {job.thumbnail && (
          <div className="relative flex-shrink-0">
            <img src={job.thumbnail} alt="thumb" className="w-24 h-16 object-cover rounded-xl border border-white/10" />
            {job.duration && <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded font-mono">{formatDuration(job.duration)}</span>}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {PlatformIcon && <PlatformIcon style={{ color: p?.color }} className="w-4 h-4 flex-shrink-0" />}
            <span className="text-xs text-muted-foreground font-medium">{p?.label || job.platform}</span>
            {job.contentType && <Badge variant="outline" className="text-[10px] h-4">{job.contentType}</Badge>}
          </div>
          {job.title && <p className="font-semibold text-sm leading-snug line-clamp-2 mb-1">{job.title}</p>}
          {job.author && <p className="text-xs text-muted-foreground">by {job.author}</p>}
        </div>
        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
      </div>

      {/* Media items */}
      <div className="px-5 pb-5 space-y-3">
        {job.mediaItems.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">No downloadable media found</p>
        )}
        {job.mediaItems.map((item, idx) => {
          const filename = `${baseName}_${item.quality || idx}.${item.format}`;
          const proxyUrl = buildProxyUrl(item.url, filename);
          const isVideo = ["mp4", "mov", "webm", "mkv"].includes(item.format);
          const isAudio = ["mp3", "m4a", "aac", "wav"].includes(item.format);
          return (
            <div key={idx} className="bg-black/25 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground flex-shrink-0">{getMediaIcon(item.format, job.contentType)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.format.toUpperCase()}{item.fileSize ? ` · ${formatBytes(item.fileSize)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                  {/* Save to device */}
                  <a href={proxyUrl} download={filename}>
                    <Button size="sm" className="h-8 px-3 gap-1.5 bg-primary hover:bg-primary/90 text-white font-medium text-xs">
                      <Download className="w-3.5 h-3.5" />Save
                    </Button>
                  </a>
                  {/* Trim / Studio */}
                  {(isVideo || isAudio) && (
                    <Button size="sm" variant="outline" className="h-8 px-2 gap-1 border-purple-500/40 text-purple-400 hover:bg-purple-500/10 text-xs"
                      onClick={() => onTransferToStudio(item.url, filename, "trim")}>
                      <Scissors className="w-3.5 h-3.5" />Trim
                    </Button>
                  )}
                  {/* Boost quality */}
                  {(isVideo || isAudio) && (
                    <Button size="sm" variant="outline" className="h-8 px-2 gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10 text-xs"
                      onClick={() => onTransferToStudio(item.url, filename, "enhance")}>
                      <Zap className="w-3.5 h-3.5" />Boost
                    </Button>
                  )}
                  {/* Share */}
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setExpandedShare(expandedShare === idx ? null : idx)}>
                    <Share2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {expandedShare === idx && <SharePanel mediaUrl={item.url} proxyUrl={proxyUrl} title={job.title} />}
            </div>
          );
        })}

        {/* Quick row */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[80px]">
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground gap-1">
              <ExternalLink className="w-3 h-3" />Original
            </Button>
          </a>
          <Button variant="ghost" size="sm" className="flex-1 min-w-[100px] h-7 text-xs text-purple-400 gap-1"
            onClick={() => {
              const v = job.mediaItems.find(m => ["mp4","mov","webm"].includes(m.format));
              const any = v || job.mediaItems[0];
              if (any) onTransferToStudio(any.url, `${baseName}.${any.format}`, "split");
            }}>
            <Scissors className="w-3 h-3" />Open in Studio
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 min-w-[100px] h-7 text-xs text-blue-400 gap-1"
            onClick={() => {
              const v = job.mediaItems.find(m => ["mp4","mov","webm"].includes(m.format));
              const any = v || job.mediaItems[0];
              if (any) onTransferToStudio(any.url, `${baseName}_boosted.${any.format}`, "enhance");
            }}>
            <Zap className="w-3 h-3" />Boost Quality
          </Button>
        </div>
      </div>
    </div>
  );
}

async function apiSubmit(url: string, quality: string, format: string): Promise<DownloadJob> {
  const resp = await fetch("/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, quality, format }),
  });
  const data = await resp.json() as DownloadJob & { error?: string };
  if (!resp.ok) throw new Error((data as { error?: string }).error || "Submit failed");
  return data;
}

async function apiPollJob(jobId: string): Promise<DownloadJob> {
  const resp = await fetch(`/api/download/${jobId}`);
  return resp.json() as Promise<DownloadJob>;
}

function usePollJob(jobId: string | null, onDone: (job: DownloadJob) => void) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const job = await apiPollJob(jobId);
        if (!active) return;
        if (job.status === "ready" || job.status === "failed") {
          clearInterval(interval);
          doneRef.current(job);
        }
      } catch { /* ignore transient poll errors */ }
    }, 1500);
    return () => { active = false; clearInterval(interval); };
  }, [jobId]);
}

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("auto");
  const [loading, setLoading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [completedJobs, setCompletedJobs] = useState<DownloadJob[]>(() => {
    try {
      const saved = localStorage.getItem("novasave_jobs");
      return saved ? (JSON.parse(saved) as DownloadJob[]) : [];
    } catch { return []; }
  });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkQueue, setBulkQueue] = useState<BulkEntry[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  const detected = detectPlatformFromUrl(url);

  useEffect(() => {
    try {
      localStorage.setItem("novasave_jobs", JSON.stringify(completedJobs.slice(0, 50)));
    } catch { /* ignore */ }
  }, [completedJobs]);

  const handleJobDone = useCallback((job: DownloadJob) => {
    setLoading(false);
    setCurrentJobId(null);
    if (job.status === "ready") {
      setCompletedJobs(prev => [job, ...prev]);
      toast({ title: "✓ Ready to download", description: job.title || job.url });
    } else {
      toast({ title: "Download failed", description: job.error || "Unknown error", variant: "destructive" });
    }
  }, [toast]);

  usePollJob(currentJobId, handleJobDone);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = url.trim();
    if (!t) return;
    setLoading(true);
    try {
      const job = await apiSubmit(t, quality, "auto");
      if (job.status === "ready") { handleJobDone(job); }
      else setCurrentJobId(job.jobId);
    } catch (err) {
      setLoading(false);
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  }

  async function handleBulkSubmit() {
    const urls = bulkText.split("\n").map(u => u.trim()).filter(Boolean);
    if (!urls.length) return;
    setBulkRunning(true);
    const entries: BulkEntry[] = urls.map(u => ({ id: Math.random().toString(36).slice(2), url: u, job: null, status: "pending" }));
    setBulkQueue(entries);

    for (const entry of entries) {
      setBulkQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: "processing" } : e));
      try {
        let job = await apiSubmit(entry.url, quality, "auto");
        while (job.status === "pending" || job.status === "processing") {
          await new Promise(r => setTimeout(r, 2000));
          job = await apiPollJob(job.jobId);
        }
        setBulkQueue(prev => prev.map(e => e.id === entry.id ? { ...e, job, status: job.status as "ready" | "failed" } : e));
        if (job.status === "ready") setCompletedJobs(prev => [job, ...prev]);
      } catch {
        setBulkQueue(prev => prev.map(e => e.id === entry.id ? { ...e, status: "failed" } : e));
      }
    }
    setBulkRunning(false);
  }

  function handleTransferToStudio(mediaUrl: string, filename: string, mode = "trim") {
    sessionStorage.setItem("novasave_studio", JSON.stringify({ mediaUrl, filename, mode }));
    navigate("/studio");
  }


  return (
    <Layout>
      {/* Hero */}
      <div className="text-center mb-10 pt-4">
        <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-xs text-primary mb-4 border border-primary/20">
          <Sparkles className="w-3.5 h-3.5" />
          TikTok · YouTube · Pinterest · Spotify — No watermark, no limits
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gradient mb-3">Download Anything</h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-base">
          Paste any link. Save to your device instantly in the highest available quality.
        </p>
      </div>

      {/* Mode */}
      <div className="max-w-2xl mx-auto mb-4 flex gap-2">
        <Button variant={!bulkMode ? "default" : "ghost"} size="sm" className="h-8 gap-1.5" onClick={() => setBulkMode(false)}>
          <Download className="w-3.5 h-3.5" />Single URL
        </Button>
        <Button variant={bulkMode ? "default" : "ghost"} size="sm" className="h-8 gap-1.5" onClick={() => setBulkMode(true)}>
          <Layers className="w-3.5 h-3.5" />Bulk Download
        </Button>
      </div>

      {/* Main input card */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="glass-card rounded-2xl p-5 border border-white/8">
          {!bulkMode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="Paste TikTok, YouTube, Pinterest or Spotify link…"
                  className="h-12 pr-10 text-sm bg-black/20 border-white/10 focus:border-primary/40 rounded-xl"
                  disabled={loading} />
                {detected && PLATFORMS[detected] && (() => {
                  const pp = PLATFORMS[detected];
                  return <pp.Icon style={{ color: pp.color }} className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />;
                })()}
              </div>
              <div className="flex items-center gap-3">
                {/* Quality */}
                <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
                  <SelectTrigger className="h-9 w-[155px] border-white/10 bg-black/20 text-sm gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-popover/95 backdrop-blur-xl min-w-[200px]">
                    {QUALITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{opt.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={loading || !url.trim()}
                  className="flex-1 h-9 gap-2 font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : <><Download className="w-4 h-4" />Download</>}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                disabled={bulkRunning}
                placeholder={"Paste multiple links — one per line:\nhttps://www.tiktok.com/...\nhttps://www.youtube.com/...\nhttps://open.spotify.com/track/..."}
                className="w-full h-40 bg-black/20 border border-white/10 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary/40 font-mono placeholder:text-muted-foreground/50" />
              {bulkQueue.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {bulkQueue.map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-xs bg-black/20 rounded-lg px-3 py-2">
                      {e.status === "pending"    && <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" />}
                      {e.status === "processing" && <Loader2 className="w-3 h-3 animate-spin text-blue-400 flex-shrink-0" />}
                      {e.status === "ready"      && <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />}
                      {e.status === "failed"     && <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                      <span className="truncate text-muted-foreground flex-1">{e.url}</span>
                      <span className={`capitalize flex-shrink-0 font-medium ${e.status === "ready" ? "text-green-400" : e.status === "failed" ? "text-red-400" : e.status === "processing" ? "text-blue-400" : "text-muted-foreground"}`}>{e.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
                  <SelectTrigger className="h-9 w-[155px] border-white/10 bg-black/20 text-sm gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-popover/95 backdrop-blur-xl min-w-[200px]">
                    {QUALITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{opt.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleBulkSubmit} disabled={bulkRunning || !bulkText.trim()}
                  className="flex-1 h-9 gap-2 font-semibold bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0">
                  {bulkRunning ? <><Loader2 className="w-4 h-4 animate-spin" />Downloading…</> : <><Layers className="w-4 h-4" />Download All</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {completedJobs.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Downloaded ({completedJobs.length})</h2>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCompletedJobs([])}>
              <Trash2 className="w-3 h-3 mr-1" />Clear all
            </Button>
          </div>
          {completedJobs.map(job => (
            <DownloadCard key={job.jobId} job={job} onTransferToStudio={handleTransferToStudio} />
          ))}
        </div>
      )}

      {/* Supported platforms */}
      <div className="max-w-2xl mx-auto mt-12 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(PLATFORMS).map(([key, p]) => (
          <div key={key} className={`glass-card rounded-xl p-4 text-center bg-gradient-to-br ${p.bg} border border-white/8`}>
            <p.Icon style={{ color: p.color }} className="w-6 h-6 mx-auto mb-2" />
            <p className="text-xs font-medium">{p.label}</p>
          </div>
        ))}
      </div>

      {/* Studio CTA banner */}
      <div className="max-w-2xl mx-auto mt-4 mb-10">
        <div className="glass-card rounded-2xl p-5 border border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-blue-900/20 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Scissors className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-sm">Video Studio</span>
              <Badge className="text-[10px] h-4 bg-purple-500/20 text-purple-300 border-0">New</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Trim, split, boost quality, extract audio — all with FFmpeg precision.</p>
          </div>
          <a href="/studio">
            <Button size="sm" variant="outline" className="gap-1.5 border-purple-500/40 text-purple-400 hover:bg-purple-500/10 flex-shrink-0">
              Open Studio<ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>
      </div>
    </Layout>
  );
}
