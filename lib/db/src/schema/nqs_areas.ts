import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nqsAreasTable = pgTable("nqs_areas", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("not_started"),
  notes: text("notes"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
});

export const insertNqsAreaSchema = createInsertSchema(nqsAreasTable).omit({ id: true });
export type InsertNqsArea = z.infer<typeof insertNqsAreaSchema>;
export type NqsArea = typeof nqsAreasTable.$inferSelect;
