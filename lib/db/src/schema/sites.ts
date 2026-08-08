import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id"),
  name: text("name").notNull(),
  address: text("address"),
  grouping: text("grouping"),
  status: text("status").notNull().default("active"),
  isDoscel: boolean("is_doscel").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSiteSchema = createInsertSchema(sitesTable).omit({ id: true, createdAt: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;
