import { serial, text, date, integer, timestamp } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffQualificationsTable = pgTable("staff_qualifications", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("current"),
  referenceNumber: text("reference_number"),
  expiryDate: date("expiry_date"),
  documentPath: text("document_path"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffQualificationSchema = createInsertSchema(staffQualificationsTable).omit({ id: true, createdAt: true });
export type InsertStaffQualification = z.infer<typeof insertStaffQualificationSchema>;
export type StaffQualification = typeof staffQualificationsTable.$inferSelect;
