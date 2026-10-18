import { serial, text, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const outcomesTable = pgTable("outcomes", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  subOutcomes: text("sub_outcomes").array().notNull().default([]),
}, (table) => [uniqueIndex("outcomes_org_number_unique").on(table.organisationId, table.number)]);

export const insertOutcomeSchema = createInsertSchema(outcomesTable).omit({ id: true });
export type InsertOutcome = z.infer<typeof insertOutcomeSchema>;
export type Outcome = typeof outcomesTable.$inferSelect;
