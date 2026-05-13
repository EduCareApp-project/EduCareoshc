import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

export const insertChecklistSchema = createInsertSchema(checklistsTable).omit({ id: true, createdAt: true });
export type InsertChecklist = z.infer<typeof insertChecklistSchema>;
export type Checklist = typeof checklistsTable.$inferSelect;

export const insertChecklistCompletionSchema = createInsertSchema(checklistCompletionsTable).omit({ id: true, completedAt: true });
export type InsertChecklistCompletion = z.infer<typeof insertChecklistCompletionSchema>;
export type ChecklistCompletion = typeof checklistCompletionsTable.$inferSelect;
