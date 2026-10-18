import { serial, date, boolean, text, timestamp, unique, integer } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { sitesTable } from "./sites";

export const rollSubmissionsTable = pgTable("roll_submissions", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id),
  submitted: boolean("submitted").notNull().default(false),
  accurate: boolean("accurate").notNull().default(false),
  notes: text("notes"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_roll_week_site").on(t.weekStart, t.siteId),
]);

export type RollSubmission = typeof rollSubmissionsTable.$inferSelect;
