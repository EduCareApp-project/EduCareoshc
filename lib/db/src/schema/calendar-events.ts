import { pgTable, serial, integer, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organisationTable } from "./organisation";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";

export const calendarEventsTable = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisationTable.id),
  // Null means organisation-wide; reserved for separate service calendars later.
  siteId: integer("site_id").references(() => sitesTable.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  createdBy: integer("created_by").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("calendar_events_org_dates_idx").on(table.organisationId, table.startDate, table.endDate),
]);

export const insertCalendarEventSchema = createInsertSchema(calendarEventsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEventsTable.$inferSelect;
