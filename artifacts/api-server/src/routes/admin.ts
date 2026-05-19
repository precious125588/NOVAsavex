import { Router } from "express";
import crypto from "crypto";
import {
  getAdminStats,
  getAdminLogs,
  getActiveJobs,
  getAppConfig,
  updateAppConfig,
} from "../lib/downloadEngine.js";
import {
  getSiteSettings,
  updateSiteSettings,
  getNotifications,
  getActiveNotificationsForTarget,
  createNotification,
  updateNotification,
  deleteNotification,
} from "../lib/siteStore.js";
import { logger } from "../lib/logger.js";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "080205";
const OTP_SECRET = process.env.OTP_SECRET || crypto.createHash("sha256").update(ADMIN_PASSWORD + "novasavex-otp-2024").digest("hex");
const adminTokens = new Map<string, number>();
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

// ─── AUTH HELPERS ─────────────────────────────────────────────────────────────
function generateToken(): string { return crypto.randomBytes(32).toString("hex"); }

function isValidToken(token: string): boolean {
  const exp = adminTokens.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { adminTokens.delete(token); return false; }
  return true;
}

function requireAuth(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const token = req.headers["x-admin-token"] as string;
  if (!token || !isValidToken(token)) { res.status(401).json({ error: "Unauthorized. Invalid or expired admin token." }); return; }
  next();
}

function generateOTP(windowSecs = 300): string {
  const w = Math.floor(Date.now() / 1000 / windowSecs);
  const hmac = crypto.createHmac("sha256", OTP_SECRET);
  hmac.update(String(w));
  return String(parseInt(hmac.digest("hex").slice(0, 8), 16) % 1000000).padStart(6, "0");
}

function verifyOTP(code: string, windowSecs = 300): boolean {
  const cur = generateOTP(windowSecs);
  const prevW = Math.floor(Date.now() / 1000 / windowSecs) - 1;
  const hmacP = crypto.createHmac("sha256", OTP_SECRET);
  hmacP.update(String(prevW));
  const prev = String(parseInt(hmacP.digest("hex").slice(0, 8), 16) % 1000000).padStart(6, "0");
  return code === cur || code === prev;
}

function getIp(req: import("express").Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.socket?.remoteAddress || "unknown";
}

function checkBrute(ip: string): { blocked: boolean; remainingSeconds?: number } {
  const now = Date.now();
  const e = failedAttempts.get(ip);
  if (e && now < e.lockedUntil) return { blocked: true, remainingSeconds: Math.ceil((e.lockedUntil - now) / 1000) };
  return { blocked: false };
}

function recordFail(ip: string): void {
  const now = Date.now();
  const e = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (now > e.lockedUntil) e.count = 0;
  e.count++;
  if (e.count >= 5) e.lockedUntil = now + 15 * 60 * 1000;
  failedAttempts.set(ip, e);
}

// ─── PUBLIC: notifications for users ─────────────────────────────────────────
router.get("/notifications", (req, res) => {
  const target = (req.query.target as string) || "all";
  res.json({ notifications: getActiveNotificationsForTarget(target) });
});

router.get("/site-settings", (_req, res) => {
  const s = getSiteSettings();
  res.json({
    siteName: s.siteName,
    maintenanceMode: s.maintenanceMode,
    maintenanceMessage: s.maintenanceMessage,
    announcementBanner: s.announcementBanner,
    featureFlags: s.featureFlags,
  });
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
const otpRateMap = new Map<string, number>();

router.get("/admin/current-otp", (req, res) => {
  const ip = getIp(req);
  if (Date.now() - (otpRateMap.get(ip) || 0) < 30000) {
    res.status(429).json({ error: "Wait 30 seconds between OTP requests" }); return;
  }
  otpRateMap.set(ip, Date.now());
  const windowSecs = 300;
  res.json({ otp: generateOTP(), refreshesInSeconds: windowSecs - (Math.floor(Date.now() / 1000) % windowSecs), hint: "Changes every 5 min" });
});

router.post("/admin/login", (req, res) => {
  const ip = getIp(req);
  const brute = checkBrute(ip);
  if (brute.blocked) { res.status(429).json({ error: `Too many attempts. Wait ${brute.remainingSeconds}s.` }); return; }
  const { password, otp } = req.body as { password: string; otp?: string };
  if (!password || password !== ADMIN_PASSWORD) { recordFail(ip); logger.warn({ ip }, "Admin login: bad password"); res.status(401).json({ error: "Invalid password" }); return; }
  if (!otp || !verifyOTP(otp)) { recordFail(ip); logger.warn({ ip }, "Admin login: bad OTP"); res.status(401).json({ error: "Invalid or expired OTP. Codes refresh every 5 minutes." }); return; }
  failedAttempts.delete(ip);
  const token = generateToken();
  adminTokens.set(token, Date.now() + 24 * 60 * 60 * 1000);
  logger.info({ ip }, "Admin login success");
  res.json({ token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
});

router.post("/admin/logout", requireAuth, (req, res) => {
  const token = req.headers["x-admin-token"] as string;
  adminTokens.delete(token);
  res.json({ success: true });
});

// ─── STATS / LOGS / JOBS ─────────────────────────────────────────────────────
router.get("/admin/stats", requireAuth, async (_req, res) => { res.json(await getAdminStats()); });
router.get("/admin/logs", requireAuth, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string || "50", 10), 200);
  res.json(await getAdminLogs(limit));
});
router.get("/admin/jobs", requireAuth, (_req, res) => { res.json(getActiveJobs()); });

// ─── DOWNLOAD ENGINE CONFIG ───────────────────────────────────────────────────
router.get("/admin/config", requireAuth, (_req, res) => { res.json(getAppConfig()); });
router.put("/admin/config", requireAuth, (req, res) => {
  try { res.json(updateAppConfig(req.body)); }
  catch { res.status(400).json({ error: "Invalid config update" }); }
});

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────
router.get("/admin/site-settings", requireAuth, (_req, res) => { res.json(getSiteSettings()); });

router.put("/admin/site-settings", requireAuth, (req, res) => {
  try {
    const updated = updateSiteSettings(req.body);
    logger.info({ settings: Object.keys(req.body) }, "Site settings updated");
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to update site settings");
    res.status(400).json({ error: "Invalid settings update" });
  }
});

// Convenience: toggle maintenance mode
router.post("/admin/maintenance", requireAuth, (req, res) => {
  const { enabled, message } = req.body as { enabled: boolean; message?: string };
  const updated = updateSiteSettings({
    maintenanceMode: enabled,
    ...(message ? { maintenanceMessage: message } : {}),
  });
  logger.info({ enabled }, "Maintenance mode toggled");
  res.json({ maintenanceMode: updated.maintenanceMode, message: updated.maintenanceMessage });
});

// Convenience: set announcement banner
router.post("/admin/announcement", requireAuth, (req, res) => {
  const { text, type, active, link, linkText } = req.body as {
    text: string; type: string; active: boolean; link?: string; linkText?: string;
  };
  const updated = updateSiteSettings({
    announcementBanner: {
      active: Boolean(active),
      text: text || "",
      type: (type as "info" | "success" | "warning" | "error") || "info",
      link,
      linkText,
    },
  });
  res.json(updated.announcementBanner);
});

// Convenience: toggle a feature flag
router.post("/admin/feature/:flag", requireAuth, (req, res) => {
  const flag = String(req.params.flag);
  const { enabled } = req.body as { enabled: boolean };
  const current = getSiteSettings();
  const featureFlags = { ...current.featureFlags } as unknown as Record<string, boolean>;
  featureFlags[flag] = Boolean(enabled);
  const updated = updateSiteSettings({ featureFlags: featureFlags as unknown as typeof current.featureFlags });
  logger.info({ flag, enabled }, "Feature flag toggled");
  res.json(updated.featureFlags);
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
router.get("/admin/notifications", requireAuth, (_req, res) => {
  res.json({ notifications: getNotifications(true) });
});

router.post("/admin/notifications", requireAuth, (req, res) => {
  const { title, message, type, target, active, dismissible, expiresAt } = req.body as {
    title: string; message: string;
    type?: "info" | "success" | "warning" | "error";
    target?: "all" | "home" | "downloader" | "movies" | "anime" | "music" | "adult" | "admin";
    active?: boolean; dismissible?: boolean; expiresAt?: string;
  };
  if (!title || !message) { res.status(400).json({ error: "Title and message are required" }); return; }
  const notif = createNotification({
    title,
    message,
    type: type || "info",
    target: target || "all",
    active: active !== false,
    dismissible: dismissible !== false,
    expiresAt,
  });
  logger.info({ id: notif.id, title }, "Notification created");
  res.status(201).json(notif);
});

router.put("/admin/notifications/:id", requireAuth, (req, res) => {
  const notif = updateNotification(String(req.params.id), req.body);
  if (!notif) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json(notif);
});

router.delete("/admin/notifications/:id", requireAuth, (req, res) => {
  const ok = deleteNotification(String(req.params.id));
  if (!ok) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json({ success: true });
});

// Broadcast a quick notification to all users
router.post("/admin/broadcast", requireAuth, (req, res) => {
  const { title, message, type, durationMinutes } = req.body as {
    title: string; message: string;
    type?: "info" | "success" | "warning" | "error";
    durationMinutes?: number;
  };
  if (!title || !message) { res.status(400).json({ error: "Title and message required" }); return; }
  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    : undefined;
  const notif = createNotification({
    title, message,
    type: type || "info",
    target: "all",
    active: true,
    dismissible: true,
    expiresAt,
  });
  logger.info({ id: notif.id }, "Broadcast notification created");
  res.json(notif);
});

// OTP info for authenticated admins
router.get("/admin/otp-info", requireAuth, (_req, res) => {
  const windowSecs = 300;
  res.json({ currentOTP: generateOTP(), refreshesInSeconds: windowSecs - (Math.floor(Date.now() / 1000) % windowSecs), windowSeconds: windowSecs });
});

export { router as adminRouter };
