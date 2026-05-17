import { pgTable, serial, date, boolean, text, timestamp, unique } from "drizzle-orm/pg-core";

export const rollSubmissionsTable = pgTable("roll_submissions", {
  id: serial("id").primaryKey(),
  // Monday of the service week (YYYY-MM-DD)
  weekStart: date("week_start").notNull(),
  submitted: boolean("submitted").notNull().default(false),
  accurate: boolean("accurate").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_roll_week_start").on(t.weekStart),
]);

export type RollSubmission = typeof rollSubmissionsTable.$inferSelect;
