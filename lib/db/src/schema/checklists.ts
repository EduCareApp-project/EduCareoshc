import { pgTable, serial, text, timestamp, integer, boolean, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";

export const checklistsTable = pgTable("checklists", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("general"),
  items: text("items").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checklistCompletionsTable = pgTable("checklist_completions", {
  id: serial("id").primaryKey(),
  checklistId: integer("checklist_id").notNull(),
  staffId: integer("staff_id"),
  notes: text("notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checklistTemplatesTable = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(), // daily | weekly | monthly | term | annual
  commencementMonth: integer("commencement_month"), // 1–12, annual only
  sections: jsonb("sections").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const checklistRoutinesTable = pgTable("checklist_routines", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => checklistTemplatesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  staffId: integer("staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  targetDate: date("target_date").notNull(),
  isRepeating: boolean("is_repeating").notNull().default(false),
  frequency: text("frequency"), // daily | weekly | fortnightly | monthly | term | annual
  sectionsSnapshot: jsonb("sections_snapshot").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChecklistSchema = createInsertSchema(checklistsTable).omit({ id: true, createdAt: true });
export type InsertChecklist = z.infer<typeof insertChecklistSchema>;
export type Checklist = typeof checklistsTable.$inferSelect;

export const insertChecklistCompletionSchema = createInsertSchema(checklistCompletionsTable).omit({ id: true, completedAt: true });
export type InsertChecklistCompletion = z.infer<typeof insertChecklistCompletionSchema>;
export type ChecklistCompletion = typeof checklistCompletionsTable.$inferSelect;

export type ChecklistTemplate = typeof checklistTemplatesTable.$inferSelect;
export type ChecklistRoutine = typeof checklistRoutinesTable.$inferSelect;
