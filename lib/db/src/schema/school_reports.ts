import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, date, timestamp, boolean, unique, jsonb } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";

export const schoolReportTermsTable = pgTable("school_report_terms", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  reportYear: integer("report_year").notNull().default(sql`extract(year from current_date)::integer`),
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
  unique("uq_school_report_term_site_year_number").on(table.siteId, table.reportYear, table.termNumber),
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
  mondayPupilFree: boolean("monday_pupil_free").notNull().default(false),
  tuesdayPupilFree: boolean("tuesday_pupil_free").notNull().default(false),
  wednesdayPupilFree: boolean("wednesday_pupil_free").notNull().default(false),
  thursdayPupilFree: boolean("thursday_pupil_free").notNull().default(false),
  fridayPupilFree: boolean("friday_pupil_free").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_school_report_row_term_week_service").on(table.termId, table.weekNumber, table.serviceType),
]);

export type SchoolReportStatistics = {
  periodLabel: string;
  termNumbers: number[];
  dateRange: { start: string; end: string };
  weekdayAverages: Array<{ day: string; bsc: number; asc: number; pupilFree: number }>;
  weeklyAverages: Array<{ label: string; bsc: number; asc: number; pupilFree: number }>;
  holidayWeekdayAverages: Array<{ day: string; value: number }>;
  holidayWeeklyAverages: Array<{ label: string; value: number }>;
};

export type SchoolReportObligations = {
  learningPlayProgramHighlights: string;
  teamServiceLeadership: string;
  policyPracticeUpdates: string;
  childSafetyWellbeing: string;
  communityFeedbackResolution: string;
  focusForFuture: string;
};

export const schoolReportSummariesTable = pgTable("school_report_summaries", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  reportYear: integer("report_year").notNull(),
  frequency: text("frequency").notNull(),
  period: text("period").notNull(),
  periodLabel: text("period_label").notNull(),
  statistics: jsonb("statistics").$type<SchoolReportStatistics>().notNull(),
  reportingObligations: jsonb("reporting_obligations").$type<SchoolReportObligations>().notNull(),
  status: text("status").notNull().default("draft"),
  createdById: integer("created_by_id").references(() => staffTable.id, { onDelete: "set null" }),
  finalizedById: integer("finalized_by_id").references(() => staffTable.id, { onDelete: "set null" }),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("uq_school_report_summary_site_year_period").on(
    table.siteId,
    table.reportYear,
    table.frequency,
    table.period,
  ),
]);

export type SchoolReportTerm = typeof schoolReportTermsTable.$inferSelect;
export type SchoolReportRow = typeof schoolReportRowsTable.$inferSelect;
export type SchoolReportSummary = typeof schoolReportSummariesTable.$inferSelect;