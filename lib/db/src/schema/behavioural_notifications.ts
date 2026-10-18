import { serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { childrenTable } from "./children";
import { staffTable } from "./staff";

export const behaviouralNotificationsTable = pgTable("behavioural_notifications", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  sentByStaffId: integer("sent_by_staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  behaviourDescription: text("behaviour_description").notNull(),
  supportRequest: text("support_request").notNull(),
  recipientEmails: text("recipient_emails").array().notNull().default([]),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BehaviouralNotification = typeof behaviouralNotificationsTable.$inferSelect;
export type InsertBehaviouralNotification = typeof behaviouralNotificationsTable.$inferInsert;
