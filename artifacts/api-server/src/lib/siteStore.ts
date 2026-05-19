// Central in-memory store for site settings, notifications, and feature flags.
// On Railway/production, wrap with Redis or a DB for persistence.

export interface SiteNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  target: "all" | "home" | "downloader" | "movies" | "anime" | "music" | "adult" | "admin";
  active: boolean;
  dismissible: boolean;
  createdAt: string;
  expiresAt?: string;
  createdBy?: string;
}

export interface SiteSettings {
  siteName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementBanner: {
    active: boolean;
    text: string;
    type: "info" | "success" | "warning" | "error";
    link?: string;
    linkText?: string;
  };
  featureFlags: {
    downloaders: boolean;
    movies: boolean;
    anime: boolean;
    music: boolean;
    adult: boolean;
    booster: boolean;
    videoStudio: boolean;
    tools: boolean;
    history: boolean;
    trending: boolean;
  };
  downloadLimits: {
    maxFileSizeMB: number;
    rateLimit: number; // requests per minute
    enabled: boolean;
  };
  updatedAt: string;
}

import crypto from "crypto";

let siteSettings: SiteSettings = {
  siteName: "NOVAsavex",
  maintenanceMode: false,
  maintenanceMessage: "We're upgrading the platform. Back shortly!",
  announcementBanner: {
    active: false,
    text: "",
    type: "info",
  },
  featureFlags: {
    downloaders: true,
    movies: true,
    anime: true,
    music: true,
    adult: true,
    booster: true,
    videoStudio: true,
    tools: true,
    history: true,
    trending: true,
  },
  downloadLimits: {
    maxFileSizeMB: 500,
    rateLimit: 30,
    enabled: false,
  },
  updatedAt: new Date().toISOString(),
};

const notifications: SiteNotification[] = [];

export function getSiteSettings(): SiteSettings {
  return { ...siteSettings };
}

export function updateSiteSettings(patch: Partial<SiteSettings>): SiteSettings {
  siteSettings = { ...siteSettings, ...patch, updatedAt: new Date().toISOString() };
  return { ...siteSettings };
}

export function getNotifications(includeInactive = false): SiteNotification[] {
  const now = new Date().toISOString();
  return notifications.filter(n =>
    (includeInactive || n.active) &&
    (!n.expiresAt || n.expiresAt > now)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getActiveNotificationsForTarget(target: string): SiteNotification[] {
  const all = getNotifications(false);
  return all.filter(n => n.target === "all" || n.target === target);
}

export function createNotification(data: Omit<SiteNotification, "id" | "createdAt">): SiteNotification {
  const notif: SiteNotification = {
    ...data,
    id: crypto.randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(notif);
  if (notifications.length > 200) notifications.splice(200);
  return notif;
}

export function updateNotification(id: string, patch: Partial<SiteNotification>): SiteNotification | null {
  const idx = notifications.findIndex(n => n.id === id);
  if (idx === -1) return null;
  notifications[idx] = { ...notifications[idx], ...patch };
  return notifications[idx];
}

export function deleteNotification(id: string): boolean {
  const idx = notifications.findIndex(n => n.id === id);
  if (idx === -1) return false;
  notifications.splice(idx, 1);
  return true;
}

export function clearExpiredNotifications(): void {
  const now = new Date().toISOString();
  for (let i = notifications.length - 1; i >= 0; i--) {
    if (notifications[i].expiresAt && notifications[i].expiresAt! < now) {
      notifications.splice(i, 1);
    }
  }
}

setInterval(clearExpiredNotifications, 5 * 60 * 1000);

// ─── PUBLIC FEED METADATA ────────────────────────────────────────────────────
// Overlay metadata keyed by jobId – lets admin pin / hide items without touching the DB

export interface FeedMeta {
  jobId: string;
  pinned: boolean;
  hidden: boolean;
  hiddenAt?: string;
  pinnedAt?: string;
}

const feedMeta = new Map<string, FeedMeta>();

export function getFeedMeta(jobId: string): FeedMeta {
  return feedMeta.get(jobId) ?? { jobId, pinned: false, hidden: false };
}

export function setFeedMeta(jobId: string, patch: Partial<FeedMeta>): FeedMeta {
  const current = getFeedMeta(jobId);
  const updated: FeedMeta = { ...current, ...patch, jobId };
  feedMeta.set(jobId, updated);
  return updated;
}

export function hideFeedItem(jobId: string): FeedMeta {
  return setFeedMeta(jobId, { hidden: true, hiddenAt: new Date().toISOString() });
}

export function pinFeedItem(jobId: string, pinned: boolean): FeedMeta {
  return setFeedMeta(jobId, { pinned, pinnedAt: pinned ? new Date().toISOString() : undefined });
}

export function clearFeedMeta(): void {
  feedMeta.clear();
}

export function getHiddenJobIds(): string[] {
  return [...feedMeta.entries()].filter(([, v]) => v.hidden).map(([k]) => k);
}

export function getPinnedJobIds(): string[] {
  return [...feedMeta.entries()].filter(([, v]) => v.pinned).map(([k]) => k);
}
