import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conditionReportsTable = pgTable("condition_reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  severity: text("severity").notNull().default("low"),
  status: text("status").notNull().default("open"),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
  actionRequired: text("action_required"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConditionReportSchema = createInsertSchema(conditionReportsTable).omit({ id: true, createdAt: true, reportedAt: true });
export type InsertConditionReport = z.infer<typeof insertConditionReportSchema>;
export type ConditionReport = typeof conditionReportsTable.$inferSelect;
