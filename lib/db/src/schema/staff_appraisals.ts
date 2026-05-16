import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffAppraisalsTable = pgTable("staff_appraisals", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id").references(() => staffTable.id, { onDelete: "set null" }),
  period: text("period").notNull(),
  status: text("status").notNull().default("draft"),
  scheduledDate: date("scheduled_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  managerRating: text("manager_rating"),
  managerStrengths: text("manager_strengths"),
  managerDevelopment: text("manager_development"),
  managerComments: text("manager_comments"),
  selfRating: text("self_rating"),
  selfStrengths: text("self_strengths"),
  selfDevelopment: text("self_development"),
  selfComments: text("self_comments"),
  agreedGoals: text("agreed_goals"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffAppraisalSchema = createInsertSchema(staffAppraisalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaffAppraisal = z.infer<typeof insertStaffAppraisalSchema>;
export type StaffAppraisal = typeof staffAppraisalsTable.$inferSelect;
