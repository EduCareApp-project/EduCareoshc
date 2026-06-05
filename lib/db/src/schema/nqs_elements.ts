import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nqsElementsTable = pgTable("nqs_elements", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  isHeader: boolean("is_header").notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
});

export const insertNqsElementSchema = createInsertSchema(nqsElementsTable).omit({ id: true });
export type InsertNqsElement = z.infer<typeof insertNqsElementSchema>;
export type NqsElement = typeof nqsElementsTable.$inferSelect;
