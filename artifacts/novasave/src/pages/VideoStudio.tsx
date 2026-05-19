import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Scissors, Layers, Zap, Music, Download, Play, Pause,
  Plus, Trash2, X, Loader2, CheckCircle2, FileVideo, Link2,
  ChevronRight, Info, Volume2, VolumeX,
} from "lucide-react";
import { FaWhatsapp, FaTelegram, FaXTwitter, FaFacebook } from "react-icons/fa6";
import { Copy, Check } from "lucide-react";

type StudioMode = "trim" | "split" | "enhance";

interface Segment { id: string; downloadId: string; filename: string; fileSize: number; startTime: number; endTime: number }
interface TrimResult { downloadId: string; filename: string; fileSize: number; duration: number }
interface EnhanceResult { downloadId: string; filename: string; fileSize: number }

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseTime(input: string): number {
  const parts = input.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(input) || 0;
}

function buildDownloadUrl(downloadId: string): string {
  return `/api/video/download/${downloadId}`;
}

function ShareResult({ url, filename }: { url: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(window.location.origin + url);
  const text = encodeURIComponent("Check out this video I processed with NovaSave!");
  const shares = [
    { label: "WhatsApp",  Icon: FaWhatsapp, href: `https://wa.me/?text=${text}%20${enc}`,                                color: "text-green-400 hover:bg-green-400/10" },
    { label: "Telegram",  Icon: FaTelegram, href: `https://t.me/share/url?url=${enc}&text=${text}`,                      color: "text-blue-400 hover:bg-blue-400/10"  },
    { label: "Twitter/X", Icon: FaXTwitter, href: `https://twitter.com/intent/tweet?url=${enc}&text=${text}`,            color: "text-sky-400 hover:bg-sky-400/10"    },
    { label: "Facebook",  Icon: FaFacebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,                 color: "text-blue-600 hover:bg-blue-600/10"  },
  ];
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {shares.map(({ label, Icon, href, color }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm" className={`h-7 px-2 gap-1 text-xs ${color}`}>
            <Icon className="w-3 h-3" /><span className="hidden sm:inline">{label}</span>
          </Button>
        </a>
      ))}
      <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs text-muted-foreground"
        onClick={() => { navigator.clipboard.writeText(window.location.origin + url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
        {copied ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></> : <><Copy className="w-3 h-3" />Copy</>}
      </Button>
    </div>
  );
}

export default function VideoStudio() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const autoLoadedRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<StudioMode>("trim");
  const [quality, setQuality] = useState("1080p");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimStartStr, setTrimStartStr] = useState("0:00");
  const [trimEndStr, setTrimEndStr] = useState("0:00");
  const [trimResult, setTrimResult] = useState<TrimResult | null>(null);

  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [splitResults, setSplitResults] = useState<Segment[]>([]);

  const [enhanceResult, setEnhanceResult] = useState<EnhanceResult | null>(null);

  const [showUrlLoad, setShowUrlLoad] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);
  const [loadedFromUrl, setLoadedFromUrl] = useState("");

  const handleFileChange = useCallback((f: File) => {
    setFile(f);
    setTrimResult(null); setSplitResults([]); setEnhanceResult(null);
    const src = URL.createObjectURL(f);
    setVideoSrc(src);
    setLoadedFromUrl("");
  }, []);

  const loadMediaFromUrl = useCallback(async (rawUrl: string) => {
    if (!rawUrl) return;
    setUrlLoading(true);
    setShowUrlLoad(true);
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(rawUrl)}&filename=studio_source`;
      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
      const blob = await resp.blob();
      const ext = rawUrl.split("?")[0].split(".").pop()?.slice(0, 4) || "mp4";
      const f = new File([blob], `source.${ext}`, { type: blob.type || "video/mp4" });
      handleFileChange(f);
      setShowUrlLoad(false);
      toast({ title: "Media loaded", description: "Ready to edit in Studio" });
    } catch (err) {
      toast({
        title: "Couldn't auto-load media",
        description: err instanceof Error ? err.message : "Try downloading the file first and uploading it manually",
        variant: "destructive",
      });
    } finally {
      setUrlLoading(false);
    }
  }, [handleFileChange, toast]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("novasave_studio");
      if (raw) {
        const { mediaUrl, filename, mode: m } = JSON.parse(raw) as { mediaUrl: string; filename: string; mode?: StudioMode };
        sessionStorage.removeItem("novasave_studio");
        setLoadedFromUrl(mediaUrl);
        if (m) setMode(m);
        toast({ title: "Transferred from Downloader", description: filename || "Loading media…" });
      }
    } catch { /* ignore */ }
  }, [toast]);

  useEffect(() => {
    if (loadedFromUrl && !file && !autoLoadedRef.current) {
      autoLoadedRef.current = true;
      loadMediaFromUrl(loadedFromUrl);
    }
  }, [loadedFromUrl, file, loadMediaFromUrl]);

  useEffect(() => {
    if (mode === "enhance" && quality === "copy") setQuality("1080p");
  }, [mode, quality]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  }, [handleFileChange]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoSrc) return;
    vid.src = videoSrc;
    vid.onloadedmetadata = () => {
      const d = vid.duration;
      setVideoDuration(d);
      setTrimStart(0); setTrimEnd(d);
      setTrimStartStr("0:00"); setTrimEndStr(formatTime(d));
    };
    vid.ontimeupdate = () => setCurrentTime(vid.currentTime);
    vid.onplay  = () => setIsPlaying(true);
    vid.onpause = () => setIsPlaying(false);
  }, [videoSrc]);

  function togglePlay() {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play(); else vid.pause();
  }

  function addSplitPoint() {
    const t = currentTime;
    if (!splitPoints.includes(t) && t > 0 && t < videoDuration)
      setSplitPoints(prev => [...prev, t].sort((a, b) => a - b));
  }

  function addSplitPointAt(value: number) {
    const t = Math.min(Math.max(value, 0), videoDuration);
    if (!splitPoints.includes(t)) setSplitPoints(prev => [...prev, t].sort((a, b) => a - b));
  }

  async function handleTrim() {
    if (!file) return;
    const start = parseTime(trimStartStr);
    const end = parseTime(trimEndStr);
    if (end <= start) { toast({ title: "Invalid times", description: "End must be after start", variant: "destructive" }); return; }
    setProcessing(true); setProgress("Trimming with FFmpeg…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("startTime", String(start));
      fd.append("endTime", String(end));
      fd.append("quality", quality);
      const resp = await fetch("/api/video/trim", { method: "POST", body: fd });
      const data = await resp.json() as TrimResult & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Trim failed");
      setTrimResult(data);
      toast({ title: "✂️ Trim complete!", description: `${data.filename} — ${formatBytes(data.fileSize)}` });
    } catch (err) {
      toast({ title: "Trim failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setProcessing(false); setProgress(""); }
  }

  async function handleSplit() {
    if (!file || splitPoints.length === 0) return;
    setProcessing(true); setProgress(`Splitting into ${splitPoints.length + 1} segments…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("splitPoints", splitPoints.join(","));
      fd.append("quality", quality);
      const resp = await fetch("/api/video/split", { method: "POST", body: fd });
      const data = await resp.json() as { segments: Segment[]; error?: string };
      if (!resp.ok) throw new Error(data.error || "Split failed");
      setSplitResults(data.segments);
      toast({ title: "✅ Split complete!", description: `${data.segments.length} segments ready` });
    } catch (err) {
      toast({ title: "Split failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setProcessing(false); setProgress(""); }
  }

  async function handleEnhance() {
    if (!file) return;
    const q = quality === "copy" ? "1080p" : quality;
    setProcessing(true);
    setProgress(`Boosting to ${q === "4k" ? "4K" : q} — this may take 1–3 min…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("quality", q);
      const resp = await fetch("/api/video/enhance", { method: "POST", body: fd });
      const data = await resp.json() as EnhanceResult & { error?: string };
      if (!resp.ok) throw new Error(data.error || "Enhance failed");
      setEnhanceResult(data);
      toast({ title: "⚡ Boost complete!", description: `${data.filename} — ${formatBytes(data.fileSize)}` });
    } catch (err) {
      toast({ title: "Boost failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setProcessing(false); setProgress(""); }
  }

  const timelinePercent = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;
  const trimStartPct   = videoDuration > 0 ? (trimStart   / videoDuration) * 100 : 0;
  const trimEndPct     = videoDuration > 0 ? (trimEnd     / videoDuration) * 100 : 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-16 px-4">
        <div className="text-center mb-8 pt-4">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-xs text-purple-400 mb-4 border border-purple-500/20">
            <Scissors className="w-3.5 h-3.5" />Video Studio — FFmpeg Powered
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gradient mb-2">Video Studio</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Trim, split, boost quality, and extract audio — processed server-side with FFmpeg.
          </p>
        </div>

        {!file ? (
          <div className="glass-card rounded-2xl border border-white/8 mb-6">
            {urlLoading ? (
              <div className="m-4 p-12 text-center border-2 border-dashed border-purple-500/30 rounded-xl bg-purple-500/5">
                <Loader2 className="w-10 h-10 text-purple-400 mx-auto mb-3 animate-spin" />
                <p className="font-semibold text-purple-300 mb-1">Loading media…</p>
                <p className="text-xs text-muted-foreground">Fetching and preparing your file — please wait</p>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-white/15 rounded-xl m-4 p-10 text-center cursor-pointer hover:border-purple-500/40 hover:bg-purple-500/5 transition-all"
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileVideo className="w-12 h-12 text-purple-400/60 mx-auto mb-3" />
                <p className="font-semibold mb-1">Drop a video or audio file here</p>
                <p className="text-xs text-muted-foreground mb-4">MP4, MOV, AVI, MKV, WebM, MP3, WAV — up to 500 MB</p>
                <Button variant="outline" size="sm" className="gap-2 border-purple-500/40 text-purple-400">
                  <Upload className="w-4 h-4" />Browse Files
                </Button>
                <input ref={fileInputRef} type="file" accept="video/*,audio/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
              </div>
            )}

            <div className="px-4 pb-4">
              <button
                className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                onClick={() => setShowUrlLoad(v => !v)}
              >
                <Link2 className="w-3.5 h-3.5" />
                Load from URL (or paste a direct media link)
                <ChevronRight className={`w-3.5 h-3.5 ml-auto transition-transform ${showUrlLoad ? "rotate-90" : ""}`} />
              </button>
              {showUrlLoad && (
                <div className="flex gap-2 mt-2">
                  <input
                    ref={urlInputRef}
                    type="url"
                    placeholder="https://… direct video/audio URL …"
                    defaultValue={loadedFromUrl}
                    className="flex-1 h-9 bg-black/20 border border-white/10 rounded-lg px-3 text-sm focus:outline-none focus:border-primary/40"
                  />
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 bg-purple-600 hover:bg-purple-500 text-white border-0"
                    onClick={() => loadMediaFromUrl(urlInputRef.current?.value?.trim() || "")}
                    disabled={urlLoading}
                  >
                    {urlLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Load
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Video player */}
            <div className="glass-card rounded-2xl border border-white/8 overflow-hidden">
              <div className="bg-black relative">
                {videoSrc && (
                  <video ref={videoRef} className="w-full max-h-72 object-contain" muted={muted} onClick={togglePlay} />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="ghost" className="w-8 h-8 p-0 text-white hover:bg-white/10" onClick={togglePlay}>
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <span className="text-xs text-white font-mono">{formatTime(currentTime)}</span>
                    <div
                      className="flex-1 relative h-1.5 bg-white/20 rounded-full cursor-pointer"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        if (videoRef.current) videoRef.current.currentTime = pct * videoDuration;
                      }}
                    >
                      <div className="absolute inset-y-0 left-0 bg-white/60 rounded-full" style={{ width: `${timelinePercent}%` }} />
                      {mode === "trim" && (
                        <div className="absolute inset-y-0 bg-purple-500/40 rounded-full"
                          style={{ left: `${trimStartPct}%`, right: `${100 - trimEndPct}%` }} />
                      )}
                      {mode === "split" && splitPoints.map((pt, i) => (
                        <div key={i} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-yellow-400 rounded-full"
                          style={{ left: `${(pt / videoDuration) * 100}%` }} />
                      ))}
                      <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full -translate-x-1/2 shadow"
                        style={{ left: `${timelinePercent}%` }} />
                    </div>
                    <span className="text-xs text-white font-mono">{formatTime(videoDuration)}</span>
                    <Button
                      size="sm" variant="ghost" className="w-8 h-8 p-0 text-white hover:bg-white/10"
                      onClick={() => { const nm = !muted; setMuted(nm); if (videoRef.current) videoRef.current.muted = nm; }}
                    >
                      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 border-t border-white/8">
                <FileVideo className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {formatTime(videoDuration)}</p>
                </div>
                <Button
                  size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground"
                  onClick={() => { setFile(null); setVideoSrc(null); setTrimResult(null); setSplitResults([]); setEnhanceResult(null); setSplitPoints([]); autoLoadedRef.current = false; }}
                >
                  <X className="w-3.5 h-3.5" />Change
                </Button>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-2">
              {([
                { key: "trim",    label: "Trim",         icon: Scissors },
                { key: "split",   label: "Split",        icon: Layers   },
                { key: "enhance", label: "Boost Quality", icon: Zap      },
              ] as const).map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={mode === key ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 gap-2 h-9 ${mode === key ? "bg-purple-600 hover:bg-purple-500 text-white border-0" : "border-white/10 text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setMode(key)}
                >
                  <Icon className="w-3.5 h-3.5" />{label}
                </Button>
              ))}
            </div>

            {/* ── TRIM MODE ── */}
            {mode === "trim" && (
              <div className="glass-card rounded-xl border border-white/8 p-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-1">Trim Clip</p>
                  <p className="text-xs text-muted-foreground">Set start and end points — the section between them is saved.</p>
                </div>

                <div className="relative h-8 bg-black/30 rounded-lg overflow-hidden cursor-pointer"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    if (videoRef.current) videoRef.current.currentTime = pct * videoDuration;
                  }}>
                  <div className="absolute inset-y-0 bg-purple-500/30 border-x-2 border-purple-500"
                    style={{ left: `${trimStartPct}%`, right: `${100 - trimEndPct}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${timelinePercent}%` }} />
                  <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                    <span className="text-[10px] text-purple-300 font-mono">{formatTime(trimStart)}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{formatTime(currentTime)}</span>
                    <span className="text-[10px] text-purple-300 font-mono">{formatTime(trimEnd)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Start time</label>
                    <div className="flex gap-2">
                      <input value={trimStartStr}
                        onChange={e => { setTrimStartStr(e.target.value); setTrimStart(parseTime(e.target.value)); }}
                        className="flex-1 h-9 bg-black/20 border border-white/10 rounded-lg px-3 text-sm font-mono focus:outline-none focus:border-purple-500/40" />
                      <Button size="sm" variant="outline" className="h-9 px-3 border-white/10 text-xs"
                        onClick={() => { setTrimStart(currentTime); setTrimStartStr(formatTime(currentTime)); }}>
                        Now
                      </Button>
                    </div>
                    <button className="mt-1 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      onClick={() => { if (videoRef.current) videoRef.current.currentTime = trimStart; }}>
                      <Play className="w-2.5 h-2.5" />Preview start
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">End time</label>
                    <div className="flex gap-2">
                      <input value={trimEndStr}
                        onChange={e => { setTrimEndStr(e.target.value); setTrimEnd(parseTime(e.target.value)); }}
                        className="flex-1 h-9 bg-black/20 border border-white/10 rounded-lg px-3 text-sm font-mono focus:outline-none focus:border-purple-500/40" />
                      <Button size="sm" variant="outline" className="h-9 px-3 border-white/10 text-xs"
                        onClick={() => { setTrimEnd(currentTime); setTrimEndStr(formatTime(currentTime)); }}>
                        Now
                      </Button>
                    </div>
                    <button className="mt-1 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      onClick={() => { if (videoRef.current) videoRef.current.currentTime = trimEnd; }}>
                      <Play className="w-2.5 h-2.5" />Preview end
                    </button>
                  </div>
                </div>

                {/* Quality row */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Output Quality</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "copy",  label: "Original" },
                      { value: "720p",  label: "HD 720p"  },
                      { value: "1080p", label: "FHD 1080p"},
                      { value: "audio", label: "MP3 Audio"},
                    ].map(opt => (
                      <button key={opt.value}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${quality === opt.value ? "border-purple-500/60 bg-purple-500/10 text-purple-300" : "border-white/10 hover:border-white/20 text-muted-foreground"}`}
                        onClick={() => setQuality(opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {trimEnd > trimStart && (
                  <div className="flex items-center gap-2 text-xs bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                    <Scissors className="w-3.5 h-3.5 text-purple-400" />
                    <span>Output: <strong className="text-purple-300">{formatTime(trimEnd - trimStart)}</strong></span>
                    <span className="ml-auto text-muted-foreground">{formatTime(trimStart)} → {formatTime(trimEnd)}</span>
                  </div>
                )}

                <Button
                  className="w-full h-10 gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 font-semibold"
                  onClick={handleTrim} disabled={processing || !file || trimEnd <= trimStart}
                >
                  {processing ? <><Loader2 className="w-4 h-4 animate-spin" />{progress}</> : <><Scissors className="w-4 h-4" />Trim Video</>}
                </Button>

                {trimResult && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="font-semibold text-sm text-green-400">Trim Complete!</span>
                      <Badge className="ml-auto text-[10px] bg-green-500/20 text-green-300 border-0">{formatBytes(trimResult.fileSize)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{trimResult.filename} · {formatTime(trimResult.duration)}</p>
                    <a href={buildDownloadUrl(trimResult.downloadId)} download={trimResult.filename}>
                      <Button className="w-full h-9 gap-2 bg-green-600 hover:bg-green-500 text-white border-0 font-semibold text-sm">
                        <Download className="w-4 h-4" />Save to Device
                      </Button>
                    </a>
                    <ShareResult url={buildDownloadUrl(trimResult.downloadId)} filename={trimResult.filename} />
                  </div>
                )}
              </div>
            )}

            {/* ── SPLIT MODE ── */}
            {mode === "split" && (
              <div className="glass-card rounded-xl border border-white/8 p-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-1">Split Into Segments</p>
                  <p className="text-xs text-muted-foreground">Add cut points — each segment downloads separately.</p>
                </div>

                <div className="relative h-8 bg-black/30 rounded-lg overflow-hidden cursor-pointer"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    if (videoRef.current) videoRef.current.currentTime = pct * videoDuration;
                  }}>
                  {splitPoints.map((pt, i) => (
                    <div key={i} className="absolute inset-y-0 w-0.5 bg-yellow-400 z-10"
                      style={{ left: `${(pt / videoDuration) * 100}%` }} />
                  ))}
                  <div className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `${timelinePercent}%` }} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] text-muted-foreground">Click timeline to position playhead, then Add Split Point</span>
                  </div>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  <Button size="sm" variant="outline" className="gap-2 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 h-9"
                    onClick={addSplitPoint} disabled={currentTime === 0 || currentTime >= videoDuration}>
                    <Plus className="w-3.5 h-3.5" />Add at {formatTime(currentTime)}
                  </Button>
                  <div className="flex gap-2 items-center flex-1 min-w-[200px]">
                    <input type="text" placeholder="Type time e.g. 1:30, press Enter"
                      className="flex-1 h-9 bg-black/20 border border-white/10 rounded-lg px-3 text-sm font-mono focus:outline-none focus:border-yellow-500/40"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          addSplitPointAt(parseTime((e.target as HTMLInputElement).value));
                          (e.target as HTMLInputElement).value = "";
                        }
                      }} />
                  </div>
                </div>

                {/* Quality */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "copy",  label: "Original" },
                    { value: "720p",  label: "HD 720p"  },
                    { value: "1080p", label: "FHD 1080p"},
                    { value: "audio", label: "MP3 Audio"},
                  ].map(opt => (
                    <button key={opt.value}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${quality === opt.value ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-300" : "border-white/10 hover:border-white/20 text-muted-foreground"}`}
                      onClick={() => setQuality(opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {splitPoints.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">{splitPoints.length + 1} segments:</p>
                    {[0, ...splitPoints, videoDuration].map((pt, i, arr) => {
                      if (i === arr.length - 1) return null;
                      return (
                        <div key={i} className="flex items-center gap-3 bg-black/20 rounded-lg px-3 py-2 text-xs">
                          <span className="font-medium text-yellow-400">Part {i + 1}</span>
                          <span className="text-muted-foreground font-mono">{formatTime(pt)} → {formatTime(arr[i + 1])}</span>
                          <span className="text-muted-foreground ml-auto">({formatTime(arr[i + 1] - pt)})</span>
                          {i > 0 && (
                            <Button size="sm" variant="ghost" className="w-6 h-6 p-0 text-muted-foreground hover:text-red-400"
                              onClick={() => setSplitPoints(prev => prev.filter(p => p !== splitPoints[i - 1]))}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    <button className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1"
                      onClick={() => setSplitPoints([])}>
                      <Trash2 className="w-3 h-3" />Clear all
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-white/10 rounded-xl">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No cut points yet — play the video and use "Add at" to mark cut points.
                  </div>
                )}

                <Button
                  className="w-full h-10 gap-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white border-0 font-semibold"
                  onClick={handleSplit} disabled={processing || !file || splitPoints.length === 0}
                >
                  {processing ? <><Loader2 className="w-4 h-4 animate-spin" />{progress}</> : <><Layers className="w-4 h-4" />Split Video</>}
                </Button>

                {splitResults.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="font-semibold text-sm text-green-400">{splitResults.length} Segments Ready!</span>
                    </div>
                    {splitResults.map((seg, i) => (
                      <div key={seg.downloadId} className="bg-black/20 border border-white/8 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className="text-[10px] bg-yellow-500/20 text-yellow-300 border-0">Part {i + 1}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">{formatTime(seg.startTime)} → {formatTime(seg.endTime)}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{formatBytes(seg.fileSize)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{seg.filename}</p>
                        <div className="flex gap-2 flex-wrap">
                          <a href={buildDownloadUrl(seg.downloadId)} download={seg.filename} className="flex-1">
                            <Button size="sm" className="w-full h-8 gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs">
                              <Download className="w-3.5 h-3.5" />Save Part {i + 1}
                            </Button>
                          </a>
                          <ShareResult url={buildDownloadUrl(seg.downloadId)} filename={seg.filename} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ENHANCE / BOOST MODE ── */}
            {mode === "enhance" && (
              <div className="glass-card rounded-xl border border-white/8 p-5 space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-1">Boost / Enhance Quality</p>
                  <p className="text-xs text-muted-foreground">
                    Re-encode your video at higher quality. FFmpeg uses Lanczos scaling + sharpening to make it crisp and clear.
                  </p>
                </div>

                <div className="grid gap-3">
                  {[
                    { value: "720p",  label: "HD 720p",      desc: "Good quality, fast & smaller file",          color: "text-blue-400",   icon: null },
                    { value: "1080p", label: "FHD 1080p",    desc: "Great quality — recommended for most videos", color: "text-purple-400", icon: null },
                    { value: "4k",    label: "4K Boost",     desc: "Upscale + Lanczos sharpen to ~2160p",         color: "text-yellow-400", icon: <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> },
                    { value: "audio", label: "MP3 320 kbps", desc: "Extract audio at highest quality",            color: "text-green-400",  icon: <Music className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left ${quality === opt.value ? "border-purple-500/60 bg-purple-500/10" : "border-white/8 hover:border-white/20 hover:bg-white/5"}`}
                      onClick={() => setQuality(opt.value)}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${quality === opt.value ? "border-purple-500 bg-purple-500" : "border-white/30"}`}>
                        {quality === opt.value && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          {opt.icon && <span className={opt.color}>{opt.icon}</span>}
                          <p className={`text-sm font-semibold ${opt.color}`}>{opt.label}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {quality === "4k" && (
                  <div className="flex items-start gap-2 text-xs text-yellow-400/80 bg-yellow-400/5 rounded-lg p-3 border border-yellow-400/10">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    4K upscales to 2160p height, auto-width (maintains aspect ratio). Processing takes 1–3 minutes depending on file length.
                  </div>
                )}

                <Button
                  className="w-full h-11 gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 font-semibold text-base"
                  onClick={handleEnhance} disabled={processing || !file}
                >
                  {processing
                    ? <><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">{progress}</span></>
                    : <><Zap className="w-5 h-5" />Boost Quality Now</>
                  }
                </Button>

                {enhanceResult && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span className="font-semibold text-sm text-blue-400">Boost Complete!</span>
                      <Badge className="ml-auto text-[10px] bg-blue-500/20 text-blue-300 border-0">{formatBytes(enhanceResult.fileSize)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{enhanceResult.filename}</p>
                    <a href={buildDownloadUrl(enhanceResult.downloadId)} download={enhanceResult.filename}>
                      <Button className="w-full h-9 gap-2 bg-blue-600 hover:bg-blue-500 text-white border-0 font-semibold text-sm">
                        <Download className="w-4 h-4" />Save Enhanced Video
                      </Button>
                    </a>
                    <ShareResult url={buildDownloadUrl(enhanceResult.downloadId)} filename={enhanceResult.filename} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
