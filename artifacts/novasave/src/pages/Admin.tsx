import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Shield, Lock, TrendingUp, Download, AlertCircle, Server, Activity,
  List, CheckCircle2, Clock, Key, RefreshCw, Eye, EyeOff, Fingerprint, Bell,
  BellPlus, BellOff, Megaphone, ToggleLeft, ToggleRight, Trash2, Plus,
  Zap, Globe, BarChart2, X, Save, LogOut, Radio, Sliders, FileLock2,
  Pin, Video, Music, Image, Film, EyeIcon, Share2,
} from "lucide-react";

const CHART_COLORS = ["hsl(270,95%,65%)", "hsl(217,91%,63%)", "hsl(320,90%,63%)", "hsl(160,84%,55%)", "hsl(45,96%,65%)"];

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  target: string;
  active: boolean;
  dismissible: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface AnnouncementBanner {
  active: boolean;
  text: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
  linkText?: string;
}

interface FeatureFlags {
  downloaders: boolean; movies: boolean; anime: boolean; music: boolean;
  adult: boolean; booster: boolean; videoStudio: boolean; tools: boolean;
  history: boolean; trending: boolean;
}

interface SiteSettings {
  siteName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementBanner: AnnouncementBanner;
  featureFlags: FeatureFlags;
  downloadLimits: { maxFileSizeMB: number; rateLimit: number; enabled: boolean };
  updatedAt: string;
}

// ─── AUTH HOOK ────────────────────────────────────────────────────────────────
function useAdminToken() {
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem("ns-admin-token");
    const exp = localStorage.getItem("ns-admin-token-exp");
    if (t && exp && Date.now() < parseInt(exp)) return t;
    localStorage.removeItem("ns-admin-token");
    localStorage.removeItem("ns-admin-token-exp");
    return null;
  });
  const save = (t: string, exp: string) => {
    localStorage.setItem("ns-admin-token", t);
    localStorage.setItem("ns-admin-token-exp", String(new Date(exp).getTime()));
    setToken(t);
  };
  const clear = () => {
    localStorage.removeItem("ns-admin-token");
    localStorage.removeItem("ns-admin-token-exp");
    setToken(null);
  };
  return { token, save, clear };
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function adminFetch(path: string, token: string, opts: RequestInit = {}) {
  const resp = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-token": token, ...(opts.headers || {}) },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, sub, color = "purple" }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
    blue:   "from-blue-500/20 to-blue-600/5 border-blue-500/20",
    green:  "from-green-500/20 to-green-600/5 border-green-500/20",
    amber:  "from-amber-500/20 to-amber-600/5 border-amber-500/20",
    pink:   "from-pink-500/20 to-pink-600/5 border-pink-500/20",
  };
  return (
    <div className={`glass-card rounded-xl p-4 bg-gradient-to-br border ${colors[color] || colors.purple}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── TOGGLE SWITCH ────────────────────────────────────────────────────────────
function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`flex items-center gap-2 transition-all ${enabled ? "text-green-400" : "text-muted-foreground"}`}
    >
      {enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

// ─── NOTIFICATION BADGE ───────────────────────────────────────────────────────
const TYPE_BADGE: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  success: "bg-green-500/20 text-green-400 border-green-500/30",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  error: "bg-red-500/20 text-red-400 border-red-500/30",
};

// ─── LOGIN FORM ───────────────────────────────────────────────────────────────
function AdminLoginForm({ onLogin }: { onLogin: (token: string, exp: string) => void }) {
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const fetchOtp = async () => {
    setOtpLoading(true);
    try {
      const resp = await fetch("/api/admin/current-otp");
      const data = await resp.json() as { otp?: string; refreshesInSeconds?: number; error?: string };
      if (data.error) { toast({ title: "Rate limited", description: data.error, variant: "destructive" }); setCountdown(30); return; }
      if (data.otp) { setOtp(data.otp); toast({ title: `OTP: ${data.otp}`, description: `Refreshes in ${data.refreshesInSeconds}s` }); setCountdown(30); }
    } catch { toast({ title: "Could not fetch OTP", variant: "destructive" }); }
    finally { setOtpLoading(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !otp) { toast({ title: "Both fields required", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, otp }) });
      const data = await resp.json() as { token?: string; expiresAt?: string; error?: string };
      if (!resp.ok || !data.token) { toast({ title: "Access denied", description: data.error, variant: "destructive" }); return; }
      onLogin(data.token, data.expiresAt!);
      toast({ title: "Access granted", description: "Welcome to the Admin Dashboard" });
    } catch { toast({ title: "Login failed", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm space-y-6 border border-purple-500/20">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mx-auto neon-glow">
            <Fingerprint className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Admin Access</h1>
            <p className="text-sm text-muted-foreground">Password + OTP required</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type={showPw ? "text" : "password"} placeholder="Admin password" value={password}
              onChange={e => setPassword(e.target.value)} className="pl-10 pr-10 h-11" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="text" placeholder="6-digit OTP" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="pl-10 h-11 font-mono tracking-widest text-lg" maxLength={6} />
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs gap-2 border-purple-500/30 text-purple-400"
              onClick={fetchOtp} disabled={otpLoading || countdown > 0}>
              {otpLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
              {countdown > 0 ? `Get OTP (${countdown}s)` : "Get OTP Code"}
            </Button>
          </div>

          <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {loading ? "Verifying..." : "Access Dashboard"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">OTP codes refresh every 5 minutes</p>
      </div>
    </div>
  );
}

// ─── ADMIN FEED TAB ───────────────────────────────────────────────────────────
interface FeedItemAdmin {
  jobId: string; title?: string | null; platform: string; contentType: string;
  thumbnail?: string | null; createdAt: string; status: string;
  mediaItems?: Array<{ url: string; format: string; quality: string; label: string }>;
  hidden?: boolean; pinned?: boolean;
}

function AdminFeedTab({ token, api, toast }: {
  token: string;
  api: (path: string, opts?: RequestInit) => Promise<unknown>;
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>["toast"];
}) {
  const [items, setItems] = useState<FeedItemAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, hidden: 0, pinned: 0 });
  const [filter, setFilter] = useState<"all" | "hidden" | "pinned">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/admin/feed") as { items: FeedItemAdmin[]; hiddenCount: number; pinnedCount: number };
      setItems(data.items || []);
      setStats({ total: (data.items || []).length, hidden: data.hiddenCount || 0, pinned: data.pinnedCount || 0 });
    } catch (err) { toast({ title: "Failed to load feed", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [api, toast]);

  useEffect(() => { load(); }, [load]);

  const hideItem = async (jobId: string) => {
    try {
      await fetch(`/api/admin/feed/${jobId}`, { method: "DELETE", headers: { "x-admin-token": token } });
      setItems(prev => prev.map(i => i.jobId === jobId ? { ...i, hidden: true } : i));
      toast({ title: "Item hidden" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const unhideItem = async (jobId: string) => {
    try {
      await fetch(`/api/admin/feed/${jobId}/unhide`, { method: "POST", headers: { "x-admin-token": token } });
      setItems(prev => prev.map(i => i.jobId === jobId ? { ...i, hidden: false } : i));
      toast({ title: "Item restored" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const pinItem = async (jobId: string, pinned: boolean) => {
    try {
      await fetch(`/api/admin/feed/${jobId}/pin`, { method: "POST", headers: { "Content-Type": "application/json", "x-admin-token": token }, body: JSON.stringify({ pinned }) });
      setItems(prev => prev.map(i => i.jobId === jobId ? { ...i, pinned } : i));
      toast({ title: pinned ? "Item pinned to top" : "Item unpinned" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const clearAll = async () => {
    if (!confirm("This clears all pin/hide settings. Items will reappear. Continue?")) return;
    try {
      await fetch("/api/admin/feed/clear", { method: "DELETE", headers: { "x-admin-token": token } });
      setItems(prev => prev.map(i => ({ ...i, hidden: false, pinned: false })));
      toast({ title: "Feed metadata cleared" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const filtered = items.filter(i => {
    if (filter === "hidden") return i.hidden;
    if (filter === "pinned") return i.pinned;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stats + controls */}
      <div className="glass-card rounded-xl p-4 border border-white/8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-sm">Public Feed Control</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={load} className="h-7 px-2.5 gap-1 text-muted-foreground">
              <RefreshCw className="w-3 h-3" />Refresh
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAll} className="h-7 px-2.5 gap-1 text-red-400 hover:bg-red-500/10">
              <Trash2 className="w-3 h-3" />Clear Meta
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            { label: "Total Items", value: stats.total, color: "text-foreground" },
            { label: "Hidden", value: stats.hidden, color: "text-red-400" },
            { label: "Pinned", value: stats.pinned, color: "text-amber-400" },
          ].map(s => (
            <div key={s.label} className="bg-black/20 rounded-lg p-2.5 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {(["all", "hidden", "pinned"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${filter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {f} {f === "hidden" ? `(${stats.hidden})` : f === "pinned" ? `(${stats.pinned})` : `(${stats.total})`}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="glass-card rounded-xl p-4 border border-white/8">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Radio className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No items {filter !== "all" ? `matching "${filter}"` : "in feed"}</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map(item => {
              const first = item.mediaItems?.[0];
              return (
                <div key={item.jobId} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${item.hidden ? "border-red-500/20 opacity-60" : item.pinned ? "border-amber-500/30" : "border-white/8"} hover:bg-white/3`}>
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    {item.thumbnail
                      ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          {["video","shorts","reels"].includes(item.contentType) ? <Video className="w-5 h-5 text-muted-foreground/40" /> : <Image className="w-5 h-5 text-muted-foreground/40" />}
                        </div>
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title || item.jobId}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-4 capitalize">{item.platform}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                      {first && <span className="text-[10px] text-muted-foreground uppercase">{first.format}</span>}
                      {item.hidden && <Badge variant="destructive" className="text-[10px] h-4">Hidden</Badge>}
                      {item.pinned && <span className="text-[10px] text-amber-400 font-medium">📌 Pinned</span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => pinItem(item.jobId, !item.pinned)}
                      className={`p-1.5 rounded-lg transition-colors ${item.pinned ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground hover:bg-white/5"}`}
                      title={item.pinned ? "Unpin" : "Pin to top"}>
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    {item.hidden ? (
                      <button onClick={() => unhideItem(item.jobId)} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors" title="Restore to feed">
                        <EyeIcon className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => hideItem(item.jobId)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Hide from feed">
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {first && (
                      <a href={`/api/proxy?url=${encodeURIComponent(first.url)}&filename=${encodeURIComponent((item.title || "media").slice(0,40))}.${first.format}`}
                        download className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TABS CONFIG ──────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",      label: "Overview",       icon: BarChart2 },
  { id: "notifications", label: "Notifications",  icon: Bell },
  { id: "feed",          label: "Public Feed",    icon: Radio },
  { id: "site",         label: "Site Control",    icon: Globe },
  { id: "features",     label: "Features",        icon: Sliders },
  { id: "api",          label: "API Control",     icon: Zap },
  { id: "logs",         label: "Logs",            icon: List },
  { id: "jobs",         label: "Jobs",            icon: Clock },
] as const;

type TabId = typeof TABS[number]["id"];

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab, setTab] = useState<TabId>("overview");
  const { toast } = useToast();

  // Data state
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<unknown[]>([]);
  const [jobs, setJobs] = useState<unknown[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const setLoad = (k: string, v: boolean) => setLoading(prev => ({ ...prev, [k]: v }));

  const api = useCallback((path: string, opts?: RequestInit) =>
    adminFetch(path, token, opts), [token]);

  const load = useCallback(async () => {
    setLoad("stats", true);
    try {
      const [s, l, j, c, ss, n] = await Promise.allSettled([
        api("/admin/stats"),
        api("/admin/logs?limit=50"),
        api("/admin/jobs"),
        api("/admin/config"),
        api("/admin/site-settings"),
        api("/admin/notifications"),
      ]);
      if (s.status === "fulfilled") setStats(s.value as Record<string, unknown>);
      if (l.status === "fulfilled") setLogs(Array.isArray(l.value) ? l.value : []);
      if (j.status === "fulfilled") setJobs(Array.isArray(j.value) ? j.value : []);
      if (c.status === "fulfilled") setConfig(c.value as Record<string, unknown>);
      if (ss.status === "fulfilled") setSiteSettings(ss.value as SiteSettings);
      if (n.status === "fulfilled") setNotifications((n.value as { notifications: Notification[] }).notifications || []);
    } catch { /* ignore */ }
    finally { setLoad("stats", false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // ── Overview ──
  const platformData = stats ? Object.entries((stats.platformBreakdown as Record<string, number>) || {}).map(([name, value]) => ({ name, value })) : [];
  const dailyData = ((stats?.dailyCounts as Array<{ date: string; count: number }>) || []).map(d => ({ ...d, date: d.date.slice(5) }));

  // ── Notifications ──
  const [newNotif, setNewNotif] = useState({ title: "", message: "", type: "info" as const, target: "all" as const, dismissible: true, durationMinutes: "" });
  const [editingNotif, setEditingNotif] = useState<string | null>(null);

  const createNotif = async () => {
    if (!newNotif.title || !newNotif.message) { toast({ title: "Title and message required", variant: "destructive" }); return; }
    setLoad("notif", true);
    try {
      const expiresAt = newNotif.durationMinutes
        ? new Date(Date.now() + parseInt(newNotif.durationMinutes) * 60000).toISOString()
        : undefined;
      await api("/admin/notifications", { method: "POST", body: JSON.stringify({ ...newNotif, expiresAt }) });
      setNewNotif({ title: "", message: "", type: "info", target: "all", dismissible: true, durationMinutes: "" });
      toast({ title: "Notification created" });
      const fresh = await api("/admin/notifications");
      setNotifications((fresh as { notifications: Notification[] }).notifications || []);
    } catch (err) { toast({ title: "Failed", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
    finally { setLoad("notif", false); }
  };

  const toggleNotif = async (n: Notification) => {
    try {
      await api(`/admin/notifications/${n.id}`, { method: "PUT", body: JSON.stringify({ active: !n.active }) });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, active: !x.active } : x));
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const deleteNotif = async (id: string) => {
    try {
      await api(`/admin/notifications/${id}`, { method: "DELETE" });
      setNotifications(prev => prev.filter(x => x.id !== id));
      toast({ title: "Deleted" });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
  };

  const broadcast = async () => {
    if (!newNotif.title || !newNotif.message) { toast({ title: "Title and message required", variant: "destructive" }); return; }
    setLoad("broadcast", true);
    try {
      const duration = newNotif.durationMinutes ? parseInt(newNotif.durationMinutes) : undefined;
      await api("/admin/broadcast", { method: "POST", body: JSON.stringify({ title: newNotif.title, message: newNotif.message, type: newNotif.type, durationMinutes: duration }) });
      setNewNotif({ title: "", message: "", type: "info", target: "all", dismissible: true, durationMinutes: "" });
      toast({ title: "Broadcast sent to all users!" });
      const fresh = await api("/admin/notifications");
      setNotifications((fresh as { notifications: Notification[] }).notifications || []);
    } catch (err) { toast({ title: "Broadcast failed", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
    finally { setLoad("broadcast", false); }
  };

  // ── Site Settings ──
  const saveSiteSettings = async (patch: Partial<SiteSettings>) => {
    if (!siteSettings) return;
    setLoad("site", true);
    try {
      const updated = await api("/admin/site-settings", { method: "PUT", body: JSON.stringify(patch) });
      setSiteSettings(updated as SiteSettings);
      toast({ title: "Site settings saved" });
    } catch (err) { toast({ title: "Failed", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
    finally { setLoad("site", false); }
  };

  const toggleMaintenance = async () => {
    if (!siteSettings) return;
    await saveSiteSettings({ maintenanceMode: !siteSettings.maintenanceMode });
  };

  const saveBanner = async () => {
    if (!siteSettings) return;
    await saveSiteSettings({ announcementBanner: siteSettings.announcementBanner });
  };

  // ── Features ──
  const toggleFeature = async (flag: keyof FeatureFlags) => {
    if (!siteSettings) return;
    setLoad(`feat-${flag}`, true);
    try {
      const current = siteSettings.featureFlags[flag];
      await api(`/admin/feature/${flag}`, { method: "POST", body: JSON.stringify({ enabled: !current }) });
      setSiteSettings(prev => prev ? { ...prev, featureFlags: { ...prev.featureFlags, [flag]: !current } } : prev);
      toast({ title: `${flag} ${!current ? "enabled" : "disabled"}` });
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setLoad(`feat-${flag}`, false); }
  };

  // ── API Config ──
  const toggleApiPlatform = async (platform: string) => {
    if (!config) return;
    const pCfg = (config[platform] as Record<string, unknown>) || {};
    const wasEnabled = pCfg.enabled !== false;
    try {
      const updated = await api("/admin/config", { method: "PUT", body: JSON.stringify({ [platform]: { ...pCfg, enabled: !wasEnabled } }) });
      setConfig(updated as Record<string, unknown>);
      toast({ title: `${platform} ${wasEnabled ? "disabled" : "enabled"}` });
    } catch { toast({ title: "Config update failed", variant: "destructive" }); }
  };

  // ── Logout ──
  const logout = async () => {
    try { await api("/admin/logout", { method: "POST" }); } catch { /* ignore */ }
    onLogout();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">NOVAsavex Control Center</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading.stats} className="gap-1.5 text-muted-foreground">
            <RefreshCw className={`w-3.5 h-3.5 ${loading.stats ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={logout} className="gap-1.5 text-muted-foreground hover:text-red-400">
            <LogOut className="w-3.5 h-3.5" />Sign out
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${tab === t.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
            {t.id === "notifications" && notifications.filter(n => n.active).length > 0 && (
              <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {notifications.filter(n => n.active).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {loading.stats && !stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Total Downloads" value={(stats?.totalDownloads as number) || 0} icon={Download} color="purple" />
              <StatCard label="Today" value={(stats?.todayDownloads as number) || 0} icon={TrendingUp} color="blue" />
              <StatCard label="Success Rate" value={`${Math.round(((stats?.successRate as number) || 0) * 100)}%`} icon={CheckCircle2} color="green" />
              <StatCard label="Active Jobs" value={jobs.length} icon={Activity} color="amber" />
              <StatCard label="Uptime" value={`${Math.floor(((stats?.serverUptime as number) || 0) / 3600)}h`} icon={Server} color="pink" />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            <div className="glass-card rounded-xl p-4 border border-white/8">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm"><Activity className="w-4 h-4 text-purple-400" />Downloads (7 days)</h3>
              {loading.stats && !stats ? <Skeleton className="h-40" /> : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dailyData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="hsl(270,95%,65%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="glass-card rounded-xl p-4 border border-white/8">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm"><TrendingUp className="w-4 h-4 text-blue-400" />Platform Breakdown</h3>
              {loading.stats && !stats ? <Skeleton className="h-40" /> : (
                platformData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={10}>
                        {platformData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0f0f14", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
              )}
            </div>
          </div>

          {/* API Health */}
          <div className="glass-card rounded-xl p-4 border border-white/8">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm"><Server className="w-4 h-4 text-green-400" />API Health</h3>
            {loading.stats && !stats ? <Skeleton className="h-32" /> : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {((stats?.apiHealth as Array<{ name: string; successRate: number; totalCalls: number; enabled: boolean }>) || []).map(api => (
                  <div key={api.name} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/5">
                    <span className="font-mono">{api.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{api.totalCalls} calls</span>
                      <span className={`font-semibold ${api.successRate > 0.8 ? "text-green-400" : api.successRate > 0.5 ? "text-amber-400" : "text-red-400"}`}>
                        {Math.round(api.successRate * 100)}%
                      </span>
                      <Badge variant={api.enabled ? "outline" : "destructive"} className="text-[10px] h-4 px-1.5">
                        {api.enabled ? "ON" : "OFF"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {!((stats?.apiHealth as unknown[]) || []).length && <p className="text-muted-foreground text-xs text-center py-6">No API calls recorded yet</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === "notifications" && (
        <div className="space-y-5">
          {/* Create form */}
          <div className="glass-card rounded-xl p-5 border border-white/8 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm"><BellPlus className="w-4 h-4 text-purple-400" />Create Notification</h3>
            <div className="grid gap-3">
              <Input placeholder="Title (e.g. Maintenance tonight)" value={newNotif.title} onChange={e => setNewNotif(p => ({ ...p, title: e.target.value }))} />
              <textarea placeholder="Message — shown to users on the site" value={newNotif.message} onChange={e => setNewNotif(p => ({ ...p, message: e.target.value }))}
                className="w-full h-20 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/40" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Type</label>
                  <select value={newNotif.type} onChange={e => setNewNotif(p => ({ ...p, type: e.target.value as "info" }))}
                    className="w-full h-9 bg-black/20 border border-white/10 rounded-lg px-2 text-sm focus:outline-none">
                    <option value="info">Info</option><option value="success">Success</option>
                    <option value="warning">Warning</option><option value="error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Target page</label>
                  <select value={newNotif.target} onChange={e => setNewNotif(p => ({ ...p, target: e.target.value as "all" }))}
                    className="w-full h-9 bg-black/20 border border-white/10 rounded-lg px-2 text-sm focus:outline-none">
                    <option value="all">All pages</option><option value="home">Home</option>
                    <option value="downloader">Downloader</option><option value="movies">Movies</option>
                    <option value="anime">Anime</option><option value="music">Music</option>
                    <option value="adult">Adult</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Expires (min)</label>
                  <Input type="number" placeholder="Never" value={newNotif.durationMinutes}
                    onChange={e => setNewNotif(p => ({ ...p, durationMinutes: e.target.value }))} className="h-9" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={newNotif.dismissible} onChange={e => setNewNotif(p => ({ ...p, dismissible: e.target.checked }))} className="accent-purple-500" />
                    Dismissible
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={createNotif} disabled={loading.notif} className="flex-1 gap-2">
                  {loading.notif ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create Notification
                </Button>
                <Button onClick={broadcast} disabled={loading.broadcast} variant="outline" className="flex-1 gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  {loading.broadcast ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                  Broadcast Now
                </Button>
              </div>
            </div>
          </div>

          {/* Existing notifications */}
          <div className="glass-card rounded-xl p-4 border border-white/8">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4 text-blue-400" />All Notifications
              <span className="ml-auto text-xs text-muted-foreground">{notifications.length} total</span>
            </h3>
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BellOff className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No notifications yet. Create one above.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {notifications.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${n.active ? "border-white/10 bg-white/3" : "border-white/5 opacity-50"}`}>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 mt-0.5 ${TYPE_BADGE[n.type] || TYPE_BADGE.info}`}>
                      {n.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">→ {n.target}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                        {n.expiresAt && <span className="text-[10px] text-amber-400">exp {new Date(n.expiresAt).toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => toggleNotif(n)} className={`p-1.5 rounded-lg transition-colors ${n.active ? "text-green-400 hover:bg-green-500/10" : "text-muted-foreground hover:bg-white/5"}`} title={n.active ? "Deactivate" : "Activate"}>
                        {n.active ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => deleteNotif(n.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PUBLIC FEED ── */}
      {tab === "feed" && <AdminFeedTab token={token} api={api} toast={toast} />}

      {/* ── SITE CONTROL ── */}
      {tab === "site" && (
        <div className="space-y-4">
          {!siteSettings ? <Skeleton className="h-48 rounded-xl" /> : (
            <>
              {/* Maintenance Mode */}
              <div className="glass-card rounded-xl p-5 border border-white/8 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm"><FileLock2 className="w-4 h-4 text-amber-400" />Maintenance Mode</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{siteSettings.maintenanceMode ? "🔴 ACTIVE — site shows maintenance page" : "🟢 Inactive — site is live"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enabling this blocks all user access with a maintenance message</p>
                  </div>
                  <Toggle enabled={siteSettings.maintenanceMode} onChange={toggleMaintenance} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Maintenance message</label>
                  <div className="flex gap-2">
                    <Input value={siteSettings.maintenanceMessage}
                      onChange={e => setSiteSettings(p => p ? { ...p, maintenanceMessage: e.target.value } : p)}
                      placeholder="We'll be back shortly…" className="flex-1" />
                    <Button size="sm" onClick={() => saveSiteSettings({ maintenanceMessage: siteSettings.maintenanceMessage })} className="gap-1.5">
                      <Save className="w-3.5 h-3.5" />Save
                    </Button>
                  </div>
                </div>
              </div>

              {/* Announcement Banner */}
              <div className="glass-card rounded-xl p-5 border border-white/8 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm"><Megaphone className="w-4 h-4 text-blue-400" />Announcement Banner</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{siteSettings.announcementBanner.active ? "🔵 Banner is visible to all users" : "Banner is hidden"}</p>
                  </div>
                  <Toggle enabled={siteSettings.announcementBanner.active}
                    onChange={v => { setSiteSettings(p => p ? { ...p, announcementBanner: { ...p.announcementBanner, active: v } } : p); }} />
                </div>
                <div className="grid gap-2">
                  <textarea placeholder="Banner text (shown at top of every page)"
                    value={siteSettings.announcementBanner.text}
                    onChange={e => setSiteSettings(p => p ? { ...p, announcementBanner: { ...p.announcementBanner, text: e.target.value } } : p)}
                    className="w-full h-16 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary/40" />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Banner type</label>
                      <select value={siteSettings.announcementBanner.type}
                        onChange={e => setSiteSettings(p => p ? { ...p, announcementBanner: { ...p.announcementBanner, type: e.target.value as "info" } } : p)}
                        className="w-full h-9 bg-black/20 border border-white/10 rounded-lg px-2 text-sm focus:outline-none">
                        <option value="info">Info</option><option value="success">Success</option>
                        <option value="warning">Warning</option><option value="error">Error</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Link URL (optional)</label>
                      <Input placeholder="https://…" value={siteSettings.announcementBanner.link || ""}
                        onChange={e => setSiteSettings(p => p ? { ...p, announcementBanner: { ...p.announcementBanner, link: e.target.value } } : p)}
                        className="h-9" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Link text</label>
                      <Input placeholder="Learn more" value={siteSettings.announcementBanner.linkText || ""}
                        onChange={e => setSiteSettings(p => p ? { ...p, announcementBanner: { ...p.announcementBanner, linkText: e.target.value } } : p)}
                        className="h-9" />
                    </div>
                  </div>
                  <Button onClick={saveBanner} disabled={loading.site} className="gap-2 w-fit">
                    {loading.site ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Banner Settings
                  </Button>
                </div>
              </div>

              {/* Site Name */}
              <div className="glass-card rounded-xl p-5 border border-white/8 space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-sm"><Globe className="w-4 h-4 text-green-400" />Site Identity</h3>
                <div className="flex gap-2">
                  <Input value={siteSettings.siteName} onChange={e => setSiteSettings(p => p ? { ...p, siteName: e.target.value } : p)} placeholder="Site name" className="flex-1" />
                  <Button size="sm" onClick={() => saveSiteSettings({ siteName: siteSettings.siteName })} className="gap-1.5">
                    <Save className="w-3.5 h-3.5" />Save
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FEATURES ── */}
      {tab === "features" && (
        <div className="glass-card rounded-xl p-5 border border-white/8 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-sm"><Sliders className="w-4 h-4 text-purple-400" />Feature Flags — toggle pages on/off for all users</h3>
          {!siteSettings ? <Skeleton className="h-48 rounded-xl" /> : (
            <div className="space-y-1">
              {Object.entries(siteSettings.featureFlags).map(([flag, enabled]) => (
                <div key={flag} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/3 transition-colors">
                  <div>
                    <p className="font-medium capitalize">{flag.replace(/([A-Z])/g, " $1").trim()}</p>
                    <p className="text-xs text-muted-foreground">{enabled ? "Accessible to all users" : "Hidden / disabled"}</p>
                  </div>
                  <Toggle enabled={enabled} onChange={() => toggleFeature(flag as keyof FeatureFlags)}
                    label={enabled ? "Enabled" : "Disabled"} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── API CONTROL ── */}
      {tab === "api" && (
        <div className="glass-card rounded-xl p-5 border border-white/8 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-sm"><Zap className="w-4 h-4 text-amber-400" />API Platform Control</h3>
          {!config ? <Skeleton className="h-48 rounded-xl" /> : (
            <div className="space-y-1">
              {Object.entries(config as Record<string, { enabled: boolean; apiPriority?: string[] }>)
                .filter(([k]) => !["enabled", "updatedAt"].includes(k))
                .map(([platform, pCfg]) => (
                <div key={platform} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium capitalize">{platform}</p>
                    <p className="text-xs text-muted-foreground truncate">{pCfg?.apiPriority?.slice(0, 3).join(" → ")}</p>
                  </div>
                  <button onClick={() => toggleApiPlatform(platform)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${pCfg?.enabled !== false ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" : "bg-red-500/15 text-red-400 hover:bg-red-500/25"}`}>
                    {pCfg?.enabled !== false ? "Enabled" : "Disabled"}
                  </button>
                </div>
              ))}
              {Object.keys(config).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No config loaded yet</p>}
            </div>
          )}
        </div>
      )}

      {/* ── LOGS ── */}
      {tab === "logs" && (
        <div className="glass-card rounded-xl p-4 border border-white/8">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-red-400" />Error Logs
            <span className="ml-auto text-xs text-muted-foreground">{logs.length} entries</span>
          </h3>
          {logs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No errors logged</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {logs.map((log, i) => {
                const l = log as Record<string, unknown>;
                return (
                  <div key={i} className="bg-black/30 rounded-xl p-3 text-xs space-y-1 border border-white/5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-[10px]">{String(l.platform)}</Badge>
                      <span className="text-muted-foreground font-mono">{new Date(String(l.timestamp)).toLocaleString()}</span>
                    </div>
                    <p className="text-red-400 font-medium">{String(l.error)}</p>
                    <p className="text-muted-foreground break-all">{String(l.url)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── JOBS ── */}
      {tab === "jobs" && (
        <div className="glass-card rounded-xl p-4 border border-white/8">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-blue-400" />Active Download Jobs
            <span className="ml-auto text-xs text-muted-foreground">{jobs.length} active</span>
          </h3>
          {jobs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No active jobs right now</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {jobs.map((job, i) => {
                const j = job as Record<string, unknown>;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 bg-black/30 rounded-xl text-xs border border-white/5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{String(j.platform)}</Badge>
                      <span className="text-muted-foreground truncate">{String(j.url)}</span>
                    </div>
                    <Badge variant={j.status === "processing" ? "default" : "outline"} className="text-[10px] flex-shrink-0">
                      {String(j.status)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const { token, save, clear } = useAdminToken();
  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {!token ? (
          <AdminLoginForm onLogin={save} />
        ) : (
          <AdminDashboard token={token} onLogout={clear} />
        )}
      </div>
    </Layout>
  );
}
