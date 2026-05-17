import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  read: boolean("read").notNull().default(false),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  dedupeKey: text("dedupe_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;

export const notificationSettingsTable = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  advanceDays: integer("advance_days").default(14),
});

export type NotificationSetting = typeof notificationSettingsTable.$inferSelect;
