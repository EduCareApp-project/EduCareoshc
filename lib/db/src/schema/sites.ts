import { pgTable, serial, integer, text, boolean, timestamp, date, uniqueIndex, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organisationTable } from "./organisation";

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  identifier: text("identifier"),
  serviceStartDate: date("service_start_date", { mode: "string" }),
  address: text("address"),
  grouping: text("grouping"),
  status: text("status").notNull().default("active"),
  isDoscel: boolean("is_doscel").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sites_organisation_idx").on(table.orgId),
  uniqueIndex("sites_identifier_unique").on(table.identifier),
  check("sites_identifier_format", sql`${table.identifier} ~ '^[A-Z0-9]{1,5}$'`),
]);

export const insertSiteSchema = createInsertSchema(sitesTable).omit({ id: true, createdAt: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;
