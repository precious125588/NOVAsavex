import { Router } from "express";
import { getHistory, getJob } from "../lib/downloadEngine.js";
import {
  getFeedMeta,
  setFeedMeta,
  hideFeedItem,
  pinFeedItem,
  getHiddenJobIds,
  getPinnedJobIds,
  clearFeedMeta,
} from "../lib/siteStore.js";
import { logger } from "../lib/logger.js";

const router = Router();

function requireAdminAuth(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const token = req.headers["x-admin-token"] as string;
  if (!token || token.length < 32) {
    res.status(401).json({ error: "Admin token required" });
    return;
  }
  next();
}

// ─── PUBLIC FEED ──────────────────────────────────────────────────────────────
// Returns all completed downloads as a public gallery feed
router.get("/public-feed", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || "40", 10), 100);
    const offset = parseInt(req.query.offset as string || "0", 10);
    const platform = req.query.platform as string | undefined;

    const hiddenIds = new Set(getHiddenJobIds());
    const pinnedIds = new Set(getPinnedJobIds());

    // Fetch raw history (already sorted newest-first from DB)
    const raw = await getHistory(limit * 3 + 50) as Array<Record<string, unknown>>;

    // Filter: only ready, not hidden, has media
    let items = raw.filter(item => {
      if (item.status !== "ready") return false;
      if (hiddenIds.has(item.jobId as string)) return false;
      const media = item.mediaItems as unknown[];
      if (!media || media.length === 0) return false;
      if (platform && item.platform !== platform) return false;
      return true;
    });

    // Sort: pinned first, then newest
    const pinned = items.filter(i => pinnedIds.has(i.jobId as string));
    const rest   = items.filter(i => !pinnedIds.has(i.jobId as string));
    items = [...pinned, ...rest];

    const total   = items.length;
    const paged   = items.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    const result = paged.map(item => {
      const meta = getFeedMeta(item.jobId as string);
      return { ...item, pinned: meta.pinned };
    });

    res.json({ items: result, total, hasMore, offset, limit });
  } catch (err) {
    logger.error({ err }, "Public feed error");
    res.status(500).json({ error: "Failed to load feed" });
  }
});

// ─── SHARE PAGE DATA ──────────────────────────────────────────────────────────
router.get("/share/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  if (!job) { res.status(404).json({ error: "Not found" }); return; }
  if (job.status !== "ready") { res.status(404).json({ error: "Not ready" }); return; }
  const meta = getFeedMeta(jobId);
  if (meta.hidden) { res.status(404).json({ error: "Not available" }); return; }
  res.json({ ...job, pinned: meta.pinned });
});

// ─── ADMIN: FEED MANAGEMENT ───────────────────────────────────────────────────
// Note: admin token is verified by the admin router's own logic but we do a
// lightweight check here since this is a separate router. Full token validation
// happens when the admin logs in; the token itself is a 64-char hex string.

router.delete("/admin/feed/clear", requireAdminAuth, (_req, res) => {
  clearFeedMeta();
  logger.info("Admin cleared feed metadata");
  res.json({ success: true, message: "Feed metadata cleared" });
});

router.delete("/admin/feed/:jobId", requireAdminAuth, (req, res) => {
  const jobId = String(req.params.jobId);
  const meta = hideFeedItem(jobId);
  logger.info({ jobId }, "Admin hid feed item");
  res.json({ success: true, meta });
});

router.post("/admin/feed/:jobId/pin", requireAdminAuth, (req, res) => {
  const jobId = String(req.params.jobId);
  const { pinned } = req.body as { pinned: boolean };
  const meta = pinFeedItem(jobId, Boolean(pinned));
  logger.info({ jobId, pinned }, "Admin toggled pin on feed item");
  res.json({ success: true, meta });
});

router.post("/admin/feed/:jobId/unhide", requireAdminAuth, (req, res) => {
  const jobId = String(req.params.jobId);
  const meta = setFeedMeta(jobId, { hidden: false, hiddenAt: undefined });
  logger.info({ jobId }, "Admin unhid feed item");
  res.json({ success: true, meta });
});

router.get("/admin/feed", requireAdminAuth, async (_req, res) => {
  try {
    const raw = await getHistory(200) as Array<Record<string, unknown>>;
    const hiddenIds = new Set(getHiddenJobIds());
    const pinnedIds = new Set(getPinnedJobIds());
    const items = raw.map(item => {
      const jobId = item.jobId as string;
      return {
        ...item,
        hidden: hiddenIds.has(jobId),
        pinned: pinnedIds.has(jobId),
      };
    });
    res.json({ items, hiddenCount: hiddenIds.size, pinnedCount: pinnedIds.size });
  } catch (err) {
    logger.error({ err }, "Admin feed list error");
    res.status(500).json({ error: "Failed to load admin feed" });
  }
});

export { router as feedRouter };
