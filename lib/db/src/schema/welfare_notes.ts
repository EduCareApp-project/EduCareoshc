import { serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const welfareNotesTable = pgTable("welfare_notes", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  staffId: integer("staff_id"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  concerns: text("concerns").notNull(),
  riskFactors: text("risk_factors").notNull(),
  evidence: text("evidence"),
  mandatoryReportRequired: boolean("mandatory_report_required").notNull().default(false),
  mandatoryReportNotes: text("mandatory_report_notes"),
  cissThresholdMet: boolean("ciss_threshold_met").notNull().default(false),
  cissNotes: text("ciss_notes"),
  fvissThresholdMet: boolean("fviss_threshold_met").notNull().default(false),
  fvissNotes: text("fviss_notes"),
  confidentialNotes: text("confidential_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWelfareNoteSchema = createInsertSchema(welfareNotesTable).omit({ id: true, createdAt: true });
export type InsertWelfareNote = z.infer<typeof insertWelfareNoteSchema>;
export type WelfareNote = typeof welfareNotesTable.$inferSelect;
