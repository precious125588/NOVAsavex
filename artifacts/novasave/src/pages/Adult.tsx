import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Lock, Eye, EyeOff, AlertTriangle, Key, X, Download, Loader2, ExternalLink } from "lucide-react";

const PIN_STORAGE_KEY = "novasavex_adult_pin";
const ACCESS_STORAGE_KEY = "novasavex_adult_access";
const ACCESS_DURATION = 30 * 60 * 1000;

function getStoredPin(): string | null {
  try { return localStorage.getItem(PIN_STORAGE_KEY); } catch { return null; }
}

function isAccessValid(): boolean {
  try {
    const ts = parseInt(localStorage.getItem(ACCESS_STORAGE_KEY) || "0", 10);
    return Date.now() - ts < ACCESS_DURATION;
  } catch { return false; }
}

function setAccessGranted() {
  try { localStorage.setItem(ACCESS_STORAGE_KEY, String(Date.now())); } catch { /* ignore */ }
}

interface ContentItem {
  id: string;
  title: string;
  thumbnail?: string;
  url?: string;
  type: string;
  tags?: string[];
}

function SetupPin({ onSet }: { onSet: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) { toast({ title: "PIN must be at least 4 digits", variant: "destructive" }); return; }
    if (pin !== confirm) { toast({ title: "PINs do not match", variant: "destructive" }); return; }
    try { localStorage.setItem(PIN_STORAGE_KEY, pin); } catch { /* ignore */ }
    onSet(pin);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-pink-600 flex items-center justify-center mx-auto mb-4">
            <Key className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold">Set Your PIN</h2>
          <p className="text-sm text-muted-foreground mt-1">Create a PIN to protect this section</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={show ? "text" : "password"}
              placeholder="Create PIN (min 4 digits)"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="pl-10 pr-10 h-11 font-mono tracking-widest"
              inputMode="numeric"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={show ? "text" : "password"}
              placeholder="Confirm PIN"
              value={confirm}
              onChange={e => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="pl-10 h-11 font-mono tracking-widest"
              inputMode="numeric"
            />
          </div>
          <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700">Set PIN & Continue</Button>
        </form>
      </div>
    </div>
  );
}

function EnterPin({ onUnlock, onReset }: { onUnlock: () => void; onReset: () => void }) {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stored = getStoredPin();
    if (pin === stored) {
      setAccessGranted();
      onUnlock();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin("");
      toast({ title: `Wrong PIN (${newAttempts}/5 attempts)`, variant: "destructive" });
      if (newAttempts >= 5) {
        toast({ title: "Too many attempts", description: "PIN protection activated", variant: "destructive" });
      }
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-pink-600 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold">Enter PIN</h2>
          <p className="text-sm text-muted-foreground mt-1">This section is protected by your personal PIN</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type={show ? "text" : "password"}
              placeholder="Enter your PIN"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="pl-10 pr-10 h-11 font-mono tracking-widest text-center text-xl"
              inputMode="numeric"
              autoFocus
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k, i) => (
              <button
                key={i}
                type="button"
                className={`flex-1 h-12 rounded-lg text-lg font-medium transition-all ${k ? "bg-white/10 hover:bg-white/20 active:scale-95" : "bg-transparent cursor-default"} ${k === "⌫" ? "text-red-400" : ""}`}
                onClick={() => {
                  if (k === "⌫") setPin(p => p.slice(0, -1));
                  else if (k) setPin(p => p.length < 8 ? p + k : p);
                }}
              >{k}</button>
            ))}
          </div>
          <Button type="submit" className="w-full h-11 bg-red-600 hover:bg-red-700" disabled={pin.length < 4}>Unlock</Button>
        </form>
        <button onClick={onReset} className="w-full text-xs text-muted-foreground hover:text-foreground text-center">Forgot PIN? Reset it</button>
      </div>
    </div>
  );
}

function AgeWarning({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md space-y-6 border border-red-500/30">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-xl bg-red-600/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-red-400">Adults Only</h2>
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-left space-y-2">
            <p className="text-sm font-semibold">Content Warning</p>
            <p className="text-sm text-muted-foreground">This section contains adult content that may be inappropriate for some users. You must be 18 or older to access this section.</p>
            <p className="text-xs text-red-400/80 mt-2">By continuing, you confirm that:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>You are 18 years or older</li>
              <li>You are not accessing this from a restricted location</li>
              <li>You consent to viewing adult content</li>
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onDecline} className="h-11">
            <X className="w-4 h-4 mr-2" />I am under 18
          </Button>
          <Button onClick={onAccept} className="h-11 bg-red-600 hover:bg-red-700">
            <Shield className="w-4 h-4 mr-2" />I am 18+
          </Button>
        </div>
      </div>
    </div>
  );
}

const ADULT_SITES = [
  { id: "xnxx", label: "XNXX" },
  { id: "xvideos", label: "XVideos" },
  { id: "pornhub", label: "PornHub" },
  { id: "eporner", label: "EPorner" },
  { id: "redtube", label: "RedTube" },
  { id: "youporn", label: "YouPorn" },
  { id: "spankbang", label: "SpankBang" },
  { id: "rule34", label: "Rule34" },
];

function AdultContent({ onLock }: { onLock: () => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTag, setActiveTag] = useState("trending");
  const [activeSite, setActiveSite] = useState("xnxx");
  const [downloading, setDownloading] = useState<string | null>(null);

  const categories = ["trending", "popular", "hentai", "anime", "real", "teens", "milf", "asian", "bbw", "lesbian", "amateur", "creampie"];

  const fetchContent = async (searchQuery: string, site = activeSite) => {
    setLoading(true);
    setContent([]);
    try {
      const q = searchQuery || activeTag;
      const resp = await fetch(`/api/adult/search?q=${encodeURIComponent(q)}&site=${encodeURIComponent(site)}`);
      if (!resp.ok) throw new Error("API error");
      const data = await resp.json() as { results?: ContentItem[] };
      const items = data.results || [];
      setContent(items.length ? items : []);
      if (!items.length) toast({ title: "No content found", description: "Try a different category or site" });
    } catch {
      toast({ title: "Content unavailable", description: "Service is temporarily unavailable", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContent(activeTag, activeSite); }, [activeTag, activeSite]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (query.trim()) fetchContent(query); };

  const handleDownload = async (item: ContentItem) => {
    if (!item.url) { toast({ title: "No URL available", variant: "destructive" }); return; }
    setDownloading(item.id || item.url);
    try {
      const resp = await fetch(`/api/adult/download?url=${encodeURIComponent(item.url)}&site=${encodeURIComponent(activeSite)}`);
      const data = await resp.json() as { downloadUrl?: string; qualities?: Array<{ label: string; url: string }> };
      const dlUrl = data.downloadUrl || (data.qualities && data.qualities[0]?.url);
      if (dlUrl) {
        const a = document.createElement("a");
        a.href = `/api/proxy?url=${encodeURIComponent(dlUrl)}&filename=${encodeURIComponent(item.title || "video")}.mp4`;
        a.download = `${(item.title || "adult_video").slice(0, 60)}.mp4`;
        a.click();
        toast({ title: "Download started" });
      } else {
        if (item.url) window.open(item.url, "_blank");
        toast({ title: "Opening in browser", description: "Direct download unavailable" });
      }
    } catch {
      if (item.url) window.open(item.url, "_blank");
      toast({ title: "Opening in browser", description: "Download link unavailable" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">18+</Badge>
          <h2 className="font-bold">Adult Content</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onLock} className="text-muted-foreground gap-1">
          <Lock className="w-3.5 h-3.5" />Lock
        </Button>
      </div>

      {/* Site selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {ADULT_SITES.map(site => (
          <button
            key={site.id}
            onClick={() => { setActiveSite(site.id); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${activeSite === site.id ? "bg-red-600 text-white border-red-600" : "bg-white/5 text-muted-foreground hover:bg-white/10 border-white/10"}`}
          >
            {site.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${ADULT_SITES.find(s => s.id === activeSite)?.label || ""}...`} className="flex-1 h-10" />
        <Button type="submit" size="sm" className="h-10 bg-red-600 hover:bg-red-700">Search</Button>
      </form>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTag(cat)}
            className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all ${activeTag === cat ? "bg-red-600 text-white" : "bg-white/10 text-muted-foreground hover:bg-white/20"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && content.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Content unavailable at this time</p>
          <p className="text-xs mt-1">Try a different category or search term</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {content.map((item, i) => (
          <div key={item.id || i} className="glass-card rounded-xl overflow-hidden group cursor-pointer">
            <div className="relative aspect-video bg-black/40">
              {item.thumbnail && <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
                <div className="flex gap-2">
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <Button size="icon" variant="secondary" className="h-8 w-8"><ExternalLink className="w-3.5 h-3.5" /></Button>
                    </a>
                  )}
                  {item.url && (
                    <Button size="icon" className="h-8 w-8 bg-red-600 hover:bg-red-700" onClick={() => handleDownload(item)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-2">
              <p className="text-xs font-medium line-clamp-2">{item.title || "Untitled"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Adult() {
  const [ageConfirmed, setAgeConfirmed] = useState(() => {
    try { return localStorage.getItem("novasavex_age_confirmed") === "yes"; } catch { return false; }
  });
  const [pinSetup, setPinSetup] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [step, setStep] = useState<"age" | "setup" | "pin" | "content">("age");

  useEffect(() => {
    if (ageConfirmed) {
      const hasPin = Boolean(getStoredPin());
      if (!hasPin) {
        setStep("setup");
      } else if (isAccessValid()) {
        setStep("content");
        setUnlocked(true);
      } else {
        setStep("pin");
      }
    }
  }, [ageConfirmed]);

  const handleAgeAccept = () => {
    try { localStorage.setItem("novasavex_age_confirmed", "yes"); } catch { /* ignore */ }
    setAgeConfirmed(true);
    const hasPin = Boolean(getStoredPin());
    setStep(hasPin ? "pin" : "setup");
  };

  const handleAgeDecline = () => { window.location.href = "/"; };

  const handlePinSet = (_pin: string) => {
    setAccessGranted();
    setPinSetup(true);
    setUnlocked(true);
    setStep("content");
  };

  const handleUnlock = () => {
    setUnlocked(true);
    setStep("content");
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(PIN_STORAGE_KEY);
      localStorage.removeItem(ACCESS_STORAGE_KEY);
      localStorage.removeItem("novasavex_age_confirmed");
    } catch { /* ignore */ }
    setStep("age");
    setAgeConfirmed(false);
    setUnlocked(false);
  };

  const handleLock = () => {
    try { localStorage.removeItem(ACCESS_STORAGE_KEY); } catch { /* ignore */ }
    setUnlocked(false);
    setStep("pin");
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {step === "age" && <AgeWarning onAccept={handleAgeAccept} onDecline={handleAgeDecline} />}
        {step === "setup" && <SetupPin onSet={handlePinSet} />}
        {step === "pin" && <EnterPin onUnlock={handleUnlock} onReset={handleReset} />}
        {step === "content" && unlocked && <AdultContent onLock={handleLock} />}
      </div>
    </Layout>
  );
}
