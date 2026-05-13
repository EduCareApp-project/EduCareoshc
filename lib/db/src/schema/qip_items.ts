import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const qipItemsTable = pgTable("qip_items", {
  id: serial("id").primaryKey(),
  qualityArea: text("quality_area").notNull(),
  goal: text("goal").notNull(),
  strategy: text("strategy").notNull(),
  successMeasure: text("success_measure"),
  timeline: text("timeline"),
  status: text("status").notNull().default("in_progress"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQipItemSchema = createInsertSchema(qipItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQipItem = z.infer<typeof insertQipItemSchema>;
export type QipItem = typeof qipItemsTable.$inferSelect;
