import { serial, text, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { scopedTable as pgTable } from "./scoped-table";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sitesTable } from "./sites";
import { organisationTable } from "./organisation";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  // Transitional nullable ownership: require only after each environment's legacy backfill.
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("educator"),
  qualifications: text("qualifications").notNull(),
  status: text("status").notNull().default("active"),
  phone: text("phone"),
  wwccNumber: text("wwcc_number"),
  bio: text("bio"),
  profilePicturePath: text("profile_picture_path"),
  employmentNotes: text("employment_notes"),
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  emergencyRecordHeadings: jsonb("emergency_record_headings").$type<Partial<Record<"evacuation" | "lockdown" | "shelter_in_place" | "other", boolean>>>(),
  recentObservationsCollapsed: boolean("recent_observations_collapsed").notNull().default(false),
}, (table) => [
  index("staff_organisation_idx").on(table.organisationId),
  uniqueIndex("staff_org_email_unique").on(table.organisationId, table.email),
  // Control-plane support accounts remain separate from portal memberships.
  uniqueIndex("staff_support_email_unique").on(table.email).where(sql`${table.isSuperAdmin} = true`),
]);

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true, organisationId: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
