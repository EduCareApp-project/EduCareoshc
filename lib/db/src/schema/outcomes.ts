import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const outcomesTable = pgTable("outcomes", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  subOutcomes: text("sub_outcomes").array().notNull().default([]),
});

export const insertOutcomeSchema = createInsertSchema(outcomesTable).omit({ id: true });
export type InsertOutcome = z.infer<typeof insertOutcomeSchema>;
export type Outcome = typeof outcomesTable.$inferSelect;
