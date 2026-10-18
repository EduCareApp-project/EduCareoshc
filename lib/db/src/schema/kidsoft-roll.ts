import { integer, text, date, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { sitesTable } from "./sites";

export type KidsoftRollBooking = {
  bookingId: string;
  childId: string;
  childName: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  absent: boolean;
};

export const kidsoftServiceMappingsTable = pgTable("kidsoft_service_mappings", {
  siteId: integer("site_id").primaryKey().references(() => sitesTable.id, { onDelete: "cascade" }),
  serviceId: text("service_id").notNull(),
  serviceName: text("service_name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("kidsoft_service_mappings_org_service_unique").on(table.organisationId, table.serviceId)]);

export const kidsoftRollSnapshotsTable = pgTable("kidsoft_roll_snapshots", {
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  rollDate: date("roll_date").notNull(),
  serviceId: text("service_id").notNull(),
  bookings: jsonb("bookings").$type<KidsoftRollBooking[]>().notNull(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [unique("kidsoft_roll_site_date_unique").on(table.siteId, table.rollDate)]);
