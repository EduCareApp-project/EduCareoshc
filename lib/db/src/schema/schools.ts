import { serial, integer, text, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";

export const schoolAccountsTable = pgTable("school_accounts", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().unique().references(() => sitesTable.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  passwordHash: text("password_hash"),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("school_accounts_org_username_unique").on(table.organisationId, table.username)]);

export const schoolVitalRecordsTable = pgTable("school_vital_records", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  recordType: text("record_type").notNull(),
  recordName: text("record_name").notNull(),
  provider: text("provider"),
  referenceNumber: text("reference_number"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  documentPath: text("document_path"),
  documentName: text("document_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vecraVisitsTable = pgTable("vecra_visits", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  visitDate: date("visit_date").notNull(),
  visitorName: text("visitor_name").notNull(),
  visitorOrganisation: text("visitor_organisation"),
  findings: text("findings"),
  actions: text("actions"),
  followUpDate: date("follow_up_date"),
  createdBy: integer("created_by").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SchoolAccount = typeof schoolAccountsTable.$inferSelect;
export type SchoolVitalRecord = typeof schoolVitalRecordsTable.$inferSelect;
export type VecraVisit = typeof vecraVisitsTable.$inferSelect;