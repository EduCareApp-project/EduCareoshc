import { pgTable, serial, text, timestamp, date, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

export const conditionReportsTable = pgTable("condition_reports", {
  id: serial("id").primaryKey(),
  reportedDate: date("reported_date").notNull(),
  staffId: integer("staff_id").notNull(),
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  immediateActionRequired: boolean("immediate_action_required").notNull().default(false),
  actionTaken: text("action_taken"),
  evidenceDocumentPath: text("evidence_document_path"),
  evidenceDocumentName: text("evidence_document_name"),
  leadershipNotes: text("leadership_notes"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConditionReportSchema = createInsertSchema(conditionReportsTable).omit({ id: true, createdAt: true });
export type InsertConditionReport = z.infer<typeof insertConditionReportSchema>;
export type ConditionReport = typeof conditionReportsTable.$inferSelect;
