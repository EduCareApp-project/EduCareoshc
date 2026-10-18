import { serial, text, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";

export const guardianNotificationsTable = pgTable("guardian_notifications", {
  id: serial("id").primaryKey(),
  guardianEmail: text("guardian_email").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href").notNull(),
  read: boolean("read").notNull().default(false),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("guardian_notifications_dedupe_idx").on(table.organisationId, table.dedupeKey),
  index("guardian_notifications_guardian_idx").on(table.organisationId, table.guardianEmail, table.createdAt),
]);

export type GuardianNotification = typeof guardianNotificationsTable.$inferSelect;
export type InsertGuardianNotification = typeof guardianNotificationsTable.$inferInsert;