import { useState, useEffect, useCallback } from "react";
import { X, Info, CheckCircle2, AlertTriangle, AlertCircle, ExternalLink } from "lucide-react";

interface SiteNotification {
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

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: React.ElementType; text: string; iconColor: string }> = {
  info:    { bg: "bg-blue-950/80",   border: "border-blue-500/40",   icon: Info,          text: "text-blue-100",   iconColor: "text-blue-400" },
  success: { bg: "bg-green-950/80",  border: "border-green-500/40",  icon: CheckCircle2,  text: "text-green-100",  iconColor: "text-green-400" },
  warning: { bg: "bg-amber-950/80",  border: "border-amber-500/40",  icon: AlertTriangle, text: "text-amber-100",  iconColor: "text-amber-400" },
  error:   { bg: "bg-red-950/80",    border: "border-red-500/40",    icon: AlertCircle,   text: "text-red-100",    iconColor: "text-red-400" },
};

function BannerItem({ notif, onDismiss }: { notif: SiteNotification; onDismiss: (id: string) => void }) {
  const style = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
  const Icon = style.icon;
  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 backdrop-blur-sm border-b ${style.bg} ${style.border} ${style.text} text-sm`}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${style.iconColor}`} />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{notif.title}</span>
        {notif.message && <span className="ml-1.5 opacity-90">{notif.message}</span>}
      </div>
      {notif.dismissible && (
        <button onClick={() => onDismiss(notif.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-2">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function AnnouncementBar({ banner }: { banner: AnnouncementBanner }) {
  const [dismissed, setDismissed] = useState(false);
  if (!banner.active || !banner.text || dismissed) return null;
  const style = TYPE_STYLES[banner.type] || TYPE_STYLES.info;
  const Icon = style.icon;
  return (
    <div className={`flex items-center gap-3 px-4 py-2 backdrop-blur-sm border-b ${style.bg} ${style.border} ${style.text} text-sm`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${style.iconColor}`} />
      <span className="flex-1 min-w-0">{banner.text}</span>
      {banner.link && (
        <a href={banner.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline underline-offset-2 hover:opacity-80 flex-shrink-0 text-xs font-medium">
          {banner.linkText || "Learn more"} <ExternalLink className="w-3 h-3" />
        </a>
      )}
      <button onClick={() => setDismissed(true)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function NotificationBanner({ page = "all" }: { page?: string }) {
  const [notifications, setNotifications] = useState<SiteNotification[]>([]);
  const [banner, setBanner] = useState<AnnouncementBanner | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("ns-dismissed") || "[]") as string[]); }
    catch { return new Set(); }
  });

  const saveDismissed = useCallback((ids: Set<string>) => {
    try { sessionStorage.setItem("ns-dismissed", JSON.stringify([...ids])); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [notifResp, settingsResp] = await Promise.allSettled([
          fetch(`/api/notifications?target=${encodeURIComponent(page)}`),
          fetch("/api/site-settings"),
        ]);
        if (notifResp.status === "fulfilled" && notifResp.value.ok) {
          const data = await notifResp.value.json() as { notifications: SiteNotification[] };
          setNotifications((data.notifications || []).filter(n => !dismissed.has(n.id)));
        }
        if (settingsResp.status === "fulfilled" && settingsResp.value.ok) {
          const data = await settingsResp.value.json() as { announcementBanner?: AnnouncementBanner };
          if (data.announcementBanner) setBanner(data.announcementBanner);
        }
      } catch { /* silent */ }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [page, dismissed, saveDismissed]);

  const handleDismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    saveDismissed(next);
  }, [dismissed, saveDismissed]);

  if (!banner?.active && notifications.length === 0) return null;

  return (
    <div className="w-full z-40">
      {banner && <AnnouncementBar banner={banner} />}
      {notifications.map(n => (
        <BannerItem key={n.id} notif={n} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
