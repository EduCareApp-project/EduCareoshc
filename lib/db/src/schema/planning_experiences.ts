import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planningExperiencesTable = pgTable("planning_experiences", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  outcomeIds: integer("outcome_ids").array().notNull().default([]),
  childIds: integer("child_ids").array().notNull().default([]),
  ageGroups: text("age_groups").array().notNull().default([]),
  stage: text("stage").notNull().default("brainstorm"),
  startDate: date("start_date"),
  programId: integer("program_id"),
  evaluationNotes: text("evaluation_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanningExperienceSchema = createInsertSchema(planningExperiencesTable).omit({ id: true, createdAt: true });
export type InsertPlanningExperience = z.infer<typeof insertPlanningExperienceSchema>;
export type PlanningExperience = typeof planningExperiencesTable.$inferSelect;
