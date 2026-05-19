import { pgTable, text, serial, integer, timestamp, real, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const downloadsTable = pgTable("downloads", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(),
  url: text("url").notNull(),
  platform: text("platform").notNull(),
  contentType: text("content_type").notNull(),
  status: text("status").notNull().default("pending"),
  title: text("title"),
  thumbnail: text("thumbnail"),
  author: text("author"),
  duration: integer("duration"),
  mediaItems: jsonb("media_items").$type<Array<{url: string; quality: string; format: string; label: string; fileSize?: number | null}>>(),
  error: text("error"),
  apiUsed: text("api_used"),
  retryCount: integer("retry_count").notNull().default(0),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const errorLogsTable = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  logId: text("log_id").notNull().unique(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  error: text("error").notNull(),
  apiUsed: text("api_used").notNull(),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiStatsTable = pgTable("api_stats", {
  id: serial("id").primaryKey(),
  apiName: text("api_name").notNull(),
  platform: text("platform").notNull(),
  totalCalls: integer("total_calls").notNull().default(0),
  successCalls: integer("success_calls").notNull().default(0),
  failureCalls: integer("failure_calls").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const appConfigTable = pgTable("app_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDownloadSchema = createInsertSchema(downloadsTable).omit({ id: true });
export const insertErrorLogSchema = createInsertSchema(errorLogsTable).omit({ id: true });

export type Download = typeof downloadsTable.$inferSelect;
export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type ErrorLog = typeof errorLogsTable.$inferSelect;
export type ApiStat = typeof apiStatsTable.$inferSelect;
