import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const wellbeingReportsTable = pgTable("wellbeing_reports", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  reportType: text("report_type").notNull(),
  description: text("description").notNull(),
  actionTaken: text("action_taken"),
  reportedAt: date("reported_at").notNull(),
  referredTo: text("referred_to"),
  referralDate: date("referral_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWellbeingReportSchema = createInsertSchema(wellbeingReportsTable).omit({ id: true, createdAt: true });
export type InsertWellbeingReport = z.infer<typeof insertWellbeingReportSchema>;
export type WellbeingReport = typeof wellbeingReportsTable.$inferSelect;
