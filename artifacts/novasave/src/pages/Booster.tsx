import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Zap, TrendingUp, Heart, Eye, Users, MessageCircle, Loader2, CheckCircle2, Share2 } from "lucide-react";
import { SiTiktok, SiInstagram, SiYoutube } from "react-icons/si";

type Platform = "tiktok" | "instagram" | "youtube";
type BoostType = "views" | "likes" | "followers" | "shares" | "comments" | "saves" | "subscribers";

interface PlatformConfig {
  id: Platform;
  label: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
  types: { id: BoostType; label: string; icon: React.ElementType }[];
  placeholder: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "tiktok", label: "TikTok", icon: SiTiktok,
    color: "text-pink-400", gradient: "from-pink-600 to-red-600",
    types: [
      { id: "views", label: "Views", icon: Eye },
      { id: "likes", label: "Likes", icon: Heart },
      { id: "followers", label: "Followers", icon: Users },
      { id: "shares", label: "Shares", icon: Share2 },
      { id: "comments", label: "Comments", icon: MessageCircle },
      { id: "saves", label: "Saves / Favorites", icon: TrendingUp },
    ],
    placeholder: "Paste TikTok video URL or @username",
  },
  {
    id: "instagram", label: "Instagram", icon: SiInstagram,
    color: "text-pink-500", gradient: "from-pink-500 to-orange-500",
    types: [
      { id: "likes", label: "Likes", icon: Heart },
      { id: "followers", label: "Followers", icon: Users },
      { id: "views", label: "Reel Views", icon: Eye },
      { id: "comments", label: "Comments", icon: MessageCircle },
    ],
    placeholder: "Paste Instagram post or reel URL",
  },
  {
    id: "youtube", label: "YouTube", icon: SiYoutube,
    color: "text-red-400", gradient: "from-red-600 to-rose-600",
    types: [
      { id: "views", label: "Views", icon: Eye },
      { id: "likes", label: "Likes", icon: Heart },
      { id: "subscribers", label: "Subscribers", icon: Users },
      { id: "comments", label: "Comments", icon: MessageCircle },
    ],
    placeholder: "Paste YouTube video URL",
  },
];

const BOOST_AMOUNTS = [100, 500, 1000, 5000, 10000, 50000];

export default function Booster() {
  const { toast } = useToast();
  const [activePlatform, setActivePlatform] = useState<Platform>("tiktok");
  const [activeType, setActiveType] = useState<BoostType>("views");
  const [url, setUrl] = useState("");
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const platform = PLATFORMS.find(p => p.id === activePlatform)!;
  const platformTypes = platform.types;

  const handleBoost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) { toast({ title: "URL or username required", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const resp = await fetch(`/api/boost/${activePlatform}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), type: activeType, amount }),
      });
      const data = await resp.json() as { success?: boolean; message?: string; error?: string };
      if (data.success || resp.ok) {
        setResult({ success: true, message: data.message || `${activeType} boost initiated for ${amount.toLocaleString()} engagements!` });
        toast({ title: "Boost initiated!", description: `Your ${activeType} boost is being processed.` });
      } else {
        setResult({ success: false, message: data.error || "Boost failed" });
        toast({ title: "Boost failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center neon-glow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Social Booster</h1>
          </div>
          <p className="text-muted-foreground">Boost your social media presence with real engagement</p>
        </div>

        {/* Platform selector */}
        <div className="grid grid-cols-3 gap-3">
          {PLATFORMS.map(p => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => { setActivePlatform(p.id); setActiveType(p.types[0].id); setResult(null); }}
                className={`glass-card rounded-xl p-4 flex flex-col items-center gap-2 transition-all border ${activePlatform === p.id ? "border-primary/50 bg-primary/10" : "border-white/8 hover:border-white/20"}`}
              >
                <Icon className={`w-6 h-6 ${p.color}`} />
                <span className="text-sm font-medium">{p.label}</span>
                {activePlatform === p.id && <Badge variant="default" className="text-[10px] h-4">Selected</Badge>}
              </button>
            );
          })}
        </div>

        {/* Boost type selector */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">What do you want to boost?</h3>
          <div className="grid grid-cols-3 gap-2">
            {platformTypes.map(type => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-all border ${
                    activeType === type.id
                      ? `bg-gradient-to-br ${platform.gradient} text-white border-transparent`
                      : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {type.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* URL + amount + submit */}
        <form onSubmit={handleBoost} className="glass-card rounded-2xl p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">{platform.label} URL or Username</label>
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={platform.placeholder}
              className="h-11"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Boost Amount</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {BOOST_AMOUNTS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  className={`py-2 rounded-lg text-sm font-medium transition-all border ${
                    amount === a ? "bg-primary text-white border-primary" : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground"
                  }`}
                >
                  {a.toLocaleString()}
                </button>
              ))}
            </div>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(parseInt(e.target.value) || 0)}
              min={100}
              max={100000}
              className="h-9 text-sm"
              placeholder="Custom amount"
            />
          </div>

          <Button
            type="submit"
            className={`w-full h-11 gap-2 bg-gradient-to-r ${platform.gradient} text-white font-semibold`}
            disabled={loading || !url.trim()}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? "Processing..." : `Boost ${amount.toLocaleString()} ${activeType}`}
          </Button>
        </form>

        {/* Result */}
        {result && (
          <div className={`glass-card rounded-2xl p-4 flex items-start gap-3 border ${result.success ? "border-green-500/30 bg-green-900/10" : "border-red-500/30 bg-red-900/10"}`}>
            {result.success
              ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              : <Zap className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-medium ${result.success ? "text-green-300" : "text-red-300"}`}>
                {result.success ? "Boost Initiated!" : "Boost Failed"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{result.message}</p>
              {result.success && (
                <p className="text-xs text-muted-foreground mt-2">Processing may take 10–60 minutes. Check your account analytics.</p>
              )}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400" />How It Works</h3>
          <div className="space-y-2">
            {[
              "Paste your social media post or profile URL",
              "Select what type of engagement to boost",
              "Choose your boost amount and submit",
              "Engagement is delivered within minutes to hours",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">{i + 1}</span>
                <p className="text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
