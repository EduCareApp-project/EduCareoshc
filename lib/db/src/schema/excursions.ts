import { pgTable, serial, integer, text, date, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { childrenTable } from "./children";
import { parentAccountsTable } from "./parent_accounts";
import { staffTable } from "./staff";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const excursionsTable = pgTable("excursions", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "restrict" }),
  heading: text("heading").notNull(),
  excursionDate: date("excursion_date", { mode: "string" }).notNull(),
  description: text("description").notNull().default(""),
  venue: text("venue").notNull().default(""),
  riskAssessmentPath: text("risk_assessment_path"),
  riskAssessmentName: text("risk_assessment_name"),
  purpose: text("purpose").notNull().default(""),
  cost: text("cost").notNull().default(""),
  departureTime: text("departure_time").notNull().default(""),
  arrivalTime: text("arrival_time").notNull().default(""),
  arrivalAtVenue: text("arrival_at_venue").notNull().default(""),
  departureFromVenue: text("departure_from_venue").notNull().default(""),
  maximumChildren: text("maximum_children").notNull().default(""),
  transportMethod: text("transport_method").notNull().default(""),
  restraintsFitted: text("restraints_fitted").notNull().default(""),
  childToStaffRatio: text("child_to_staff_ratio").notNull().default(""),
  staffAttending: text("staff_attending").notNull().default(""),
  itemsToBring: text("items_to_bring").notNull().default(""),
  otherInformation: text("other_information").notNull().default(""),
  medicalAuthorisationText: text("medical_authorisation_text").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdByStaffId: integer("created_by_staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  siteDateIdx: index("excursions_site_date_idx").on(table.siteId, table.excursionDate),
}));

export const excursionRecipientsTable = pgTable("excursion_recipients", {
  id: serial("id").primaryKey(),
  excursionId: integer("excursion_id").notNull().references(() => excursionsTable.id, { onDelete: "cascade" }),
  guardianEmail: text("guardian_email").notNull(),
  guardianId: integer("guardian_id").references(() => parentAccountsTable.id, { onDelete: "set null" }),
  guardianNameSnapshot: text("guardian_name_snapshot").notNull(),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "restrict" }),
  childNameSnapshot: text("child_name_snapshot").notNull(),
  hiddenFromGuardianAt: timestamp("hidden_from_guardian_at", { withTimezone: true }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  decision: text("decision"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueAssignment: uniqueIndex("excursion_recipient_unique_idx").on(table.excursionId, table.guardianEmail, table.childId),
  excursionIdx: index("excursion_recipient_excursion_idx").on(table.excursionId),
  guardianIdx: index("excursion_recipient_guardian_idx").on(table.guardianEmail),
}));

export const excursionResponseLogsTable = pgTable("excursion_response_logs", {
  id: serial("id").primaryKey(),
  excursionId: integer("excursion_id").notNull().references(() => excursionsTable.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").references(() => excursionRecipientsTable.id, { onDelete: "set null" }),
  guardianEmail: text("guardian_email"),
  event: text("event").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  excursionIdx: index("excursion_response_log_excursion_idx").on(table.excursionId, table.createdAt),
}));

export const excursionRiskAssessmentUploadsTable = pgTable("excursion_risk_assessment_uploads", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "restrict" }),
  uploadedByStaffId: integer("uploaded_by_staff_id").notNull().references(() => staffTable.id, { onDelete: "restrict" }),
  claimedExcursionId: integer("claimed_excursion_id").references(() => excursionsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  objectPathUnique: uniqueIndex("excursion_risk_upload_object_path_idx").on(table.objectPath),
  siteIdx: index("excursion_risk_upload_site_idx").on(table.siteId),
  claimedExcursionIdx: index("excursion_risk_upload_claimed_excursion_idx").on(table.claimedExcursionId),
}));

export const insertExcursionSchema = createInsertSchema(excursionsTable).omit({
  id: true, createdAt: true, updatedAt: true, sentAt: true, completedAt: true,
});
export type InsertExcursion = z.infer<typeof insertExcursionSchema>;
export type Excursion = typeof excursionsTable.$inferSelect;
export type ExcursionRecipient = typeof excursionRecipientsTable.$inferSelect;
export type ExcursionResponseLog = typeof excursionResponseLogsTable.$inferSelect;
export type ExcursionRiskAssessmentUpload = typeof excursionRiskAssessmentUploadsTable.$inferSelect;