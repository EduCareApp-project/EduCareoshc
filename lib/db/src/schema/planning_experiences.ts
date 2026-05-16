import { pgTable, serial, text, timestamp, integer, date, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";

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
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  collaborateExplore: text("collaborate_explore"),
  identifySkills: text("identify_skills"),
  researchIdeas: text("research_ideas"),
  frameworkLinks: text("framework_links"),
  qualityAreas: text("quality_areas"),
  additionalResources: text("additional_resources"),
  assessAndReview: text("assess_and_review"),
  learning: text("learning"),
  backgroundInformation: text("background_information"),
  preparedBy: text("prepared_by"),
  editedBy: text("edited_by"),
  documentPaths: text("document_paths").array().notNull().default([]),
  documentNames: text("document_names").array().notNull().default([]),
  assessmentDocumentPaths: text("assessment_document_paths").array().notNull().default([]),
  assessmentDocumentNames: text("assessment_document_names").array().notNull().default([]),
  isTemplate: boolean("is_template").notNull().default(false),
  assessmentData: jsonb("assessment_data"),
  weeklyPlanData: jsonb("weekly_plan_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPlanningExperienceSchema = createInsertSchema(planningExperiencesTable).omit({ id: true, createdAt: true });
export type InsertPlanningExperience = z.infer<typeof insertPlanningExperienceSchema>;
export type PlanningExperience = typeof planningExperiencesTable.$inferSelect;
