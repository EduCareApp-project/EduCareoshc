import { serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nqsAreasTable = pgTable("nqs_areas", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("not_started"),
  notes: text("notes"),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("nqs_areas_org_number_unique").on(table.organisationId, table.number)]);

export const insertNqsAreaSchema = createInsertSchema(nqsAreasTable).omit({ id: true });
export type InsertNqsArea = z.infer<typeof insertNqsAreaSchema>;
export type NqsArea = typeof nqsAreasTable.$inferSelect;
