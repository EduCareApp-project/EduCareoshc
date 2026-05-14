import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const qipItemsTable = pgTable("qip_items", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id"),
  date: date("date"),
  qualityArea: text("quality_area").notNull(),          // "1" through "7"
  standardElement: text("standard_element"),
  source: text("source"),
  priority: text("priority").notNull().default("medium"), // low | medium | high
  issueIdentified: text("issue_identified"),
  outcomeGoal: text("outcome_goal"),
  howToAchieve: text("how_to_achieve"),
  successMeasure: text("success_measure"),
  dueDate: date("due_date"),
  progressNotes: text("progress_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const qipSourcesTable = pgTable("qip_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const qipStrengthsTable = pgTable("qip_strengths", {
  id: serial("id").primaryKey(),
  qualityArea: text("quality_area").notNull().unique(),  // "1" through "7"
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQipItemSchema = createInsertSchema(qipItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQipItem = z.infer<typeof insertQipItemSchema>;
export type QipItem = typeof qipItemsTable.$inferSelect;

export const insertQipSourceSchema = createInsertSchema(qipSourcesTable).omit({ id: true, createdAt: true });
export type InsertQipSource = z.infer<typeof insertQipSourceSchema>;
export type QipSource = typeof qipSourcesTable.$inferSelect;

export const insertQipStrengthSchema = createInsertSchema(qipStrengthsTable).omit({ id: true, updatedAt: true });
export type InsertQipStrength = z.infer<typeof insertQipStrengthSchema>;
export type QipStrength = typeof qipStrengthsTable.$inferSelect;
