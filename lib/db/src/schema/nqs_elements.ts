import { serial, text, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nqsElementsTable = pgTable("nqs_elements", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  descriptor: text("descriptor"),
  isHeader: boolean("is_header").notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
}, (table) => [uniqueIndex("nqs_elements_org_code_unique").on(table.organisationId, table.code)]);

export const insertNqsElementSchema = createInsertSchema(nqsElementsTable).omit({ id: true });
export type InsertNqsElement = z.infer<typeof insertNqsElementSchema>;
export type NqsElement = typeof nqsElementsTable.$inferSelect;
