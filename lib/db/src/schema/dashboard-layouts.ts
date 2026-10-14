import { pgTable, serial, integer, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organisationTable } from "./organisation";
import { staffTable } from "./staff";

export const dashboardLayoutsTable = pgTable("dashboard_layouts", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisationTable.id),
  dashboard: text("dashboard").notNull(),
  items: jsonb("items").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("dashboard_layout_org_view").on(table.organisationId, table.dashboard)]);

export const dashboardLayoutDraftsTable = pgTable("dashboard_layout_drafts", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organisationTable.id),
  dashboard: text("dashboard").notNull(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  items: jsonb("items").notNull(),
  revision: integer("revision").notNull().default(1),
  baseRevision: integer("base_revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("dashboard_layout_draft_org_view_staff").on(table.organisationId, table.dashboard, table.staffId),
]);
