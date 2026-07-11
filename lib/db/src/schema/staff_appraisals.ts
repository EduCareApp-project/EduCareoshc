import { pgTable, serial, text, timestamp, integer, date, jsonb } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const staffAppraisalsTable = pgTable("staff_appraisals", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("educator_appraisal"),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id").references(() => staffTable.id, { onDelete: "set null" }),
  createdBy: integer("created_by").references(() => staffTable.id, { onDelete: "set null" }),
  dueDate: date("due_date").notNull(),
  absencesCount: integer("absences_count"),
  // Status: stage1 → stage2 → stage3 → completed
  status: text("status").notNull().default("stage1"),
  // Stage 1: employee and reviewer fill independently
  employeeStage1: jsonb("employee_stage1"),
  employeeStage1SubmittedAt: timestamp("employee_stage1_submitted_at", { withTimezone: true }),
  reviewerStage1: jsonb("reviewer_stage1"),
  reviewerStage1SubmittedAt: timestamp("reviewer_stage1_submitted_at", { withTimezone: true }),
  // Stage 2: employee fills upward appraisal alone
  stage2Data: jsonb("stage2_data"),
  stage2SubmittedAt: timestamp("stage2_submitted_at", { withTimezone: true }),
  // Stage 3: joint meeting (educator) OR leadership summary (coordinator, assessor-only)
  stage3Data: jsonb("stage3_data"),
  // Stage 3 coordinator: leadership summary (assessor-only) — advances to stage4
  coordLeadershipData: jsonb("coord_leadership_data"),
  coordLeadershipSubmittedAt: timestamp("coord_leadership_submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appraisalGoalNotesTable = pgTable("appraisal_goal_notes", {
  id: serial("id").primaryKey(),
  appraisalId: integer("appraisal_id").notNull().references(() => staffAppraisalsTable.id, { onDelete: "cascade" }),
  goalId: text("goal_id").notNull(),
  note: text("note").notNull(),
  createdBy: integer("created_by").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StaffAppraisal = typeof staffAppraisalsTable.$inferSelect;
export type InsertStaffAppraisal = typeof staffAppraisalsTable.$inferInsert;
export type AppraisalGoalNote = typeof appraisalGoalNotesTable.$inferSelect;
