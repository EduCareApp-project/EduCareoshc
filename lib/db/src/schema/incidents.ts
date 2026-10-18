import { serial, text, timestamp, integer, date, boolean } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";
import { childrenTable } from "./children";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),

  // ── Tier 1 — Submitter ───────────────────────────────────────────────────
  incidentDatetime: timestamp("incident_datetime", { withTimezone: true }),
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  childId: integer("child_id").notNull().references(() => childrenTable.id, { onDelete: "cascade" }),
  respondentId: integer("respondent_id").references(() => staffTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  firstAidProvided: text("first_aid_provided"),
  attachmentPath: text("attachment_path"),

  // ── Tier 2 — Head Office ─────────────────────────────────────────────────
  reportPersonId: integer("report_person_id").references(() => staffTable.id, { onDelete: "set null" }),
  reportMethod: text("report_method"),
  reportMadeAt: timestamp("report_made_at", { withTimezone: true }),

  // ── Tier 3 — Regulatory Authority ───────────────────────────────────────
  regulatoryNotifyRequired: boolean("regulatory_notify_required"),
  regulatoryNotifiedAt: date("regulatory_notified_at"),
  notificationId: text("notification_id"),

  // ── Tier 4 — Review ──────────────────────────────────────────────────────
  reviewNotes: text("review_notes"),
  checkInFamily: text("check_in_family"),
  archived: boolean("archived").notNull().default(false),

  // ── Legacy / system ──────────────────────────────────────────────────────
  title: text("title"),
  status: text("status").notNull().default("open"),
  incidentDate: date("incident_date"),
  location: text("location"),
  injuryDescription: text("injury_description"),
  actionTaken: text("action_taken"),
  parentNotifiedAt: timestamp("parent_notified_at", { withTimezone: true }),
  directorNotifiedAt: timestamp("director_notified_at", { withTimezone: true }),
  deptNotifiedAt: timestamp("dept_notified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ id: true, createdAt: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
