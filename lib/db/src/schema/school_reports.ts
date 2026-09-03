import { pgTable, serial, integer, text, date, timestamp, unique } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";

export const schoolReportTermsTable = pgTable("school_report_terms", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  termNumber: integer("term_number").notNull(),
  termStartDate: date("term_start_date").notNull(),
  termEndDate: date("term_end_date").notNull(),
  holidayStartDate: date("holiday_start_date"),
  holidayEndDate: date("holiday_end_date"),
  weekCount: integer("week_count").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  generatedById: integer("generated_by_id").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_school_report_term_site_number").on(table.siteId, table.termNumber),
]);

export const schoolReportRowsTable = pgTable("school_report_rows", {
  id: serial("id").primaryKey(),
  termId: integer("term_id").notNull().references(() => schoolReportTermsTable.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  weekBeginning: date("week_beginning").notNull(),
  serviceType: text("service_type").notNull(),
  monday: text("monday"),
  tuesday: text("tuesday"),
  wednesday: text("wednesday"),
  thursday: text("thursday"),
  friday: text("friday"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_school_report_row_term_week_service").on(table.termId, table.weekNumber, table.serviceType),
]);

export type SchoolReportTerm = typeof schoolReportTermsTable.$inferSelect;
export type SchoolReportRow = typeof schoolReportRowsTable.$inferSelect;