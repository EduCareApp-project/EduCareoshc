import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id"),
  name: text("name").notNull(),
  identifier: text("identifier"),
  address: text("address"),
  grouping: text("grouping"),
  status: text("status").notNull().default("active"),
  isDoscel: boolean("is_doscel").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("sites_identifier_unique").on(table.identifier),
  check("sites_identifier_format", sql`${table.identifier} ~ '^[A-Z0-9]{1,5}$'`),
]);

export const insertSiteSchema = createInsertSchema(sitesTable).omit({ id: true, createdAt: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;
