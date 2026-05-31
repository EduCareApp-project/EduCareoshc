import { pgTable, serial, text, timestamp, date, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  enrollmentDate: date("enrollment_date").notNull(),
  status: text("status").notNull().default("active"),
  guardianName: text("guardian_name").notNull(),
  guardianEmail: text("guardian_email").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  guardian2Name: text("guardian2_name"),
  guardian2Email: text("guardian2_email"),
  guardian2Phone: text("guardian2_phone"),
  medicalNotes: text("medical_notes"),
  likes: text("likes"),
  dislikes: text("dislikes"),
  temperament: text("temperament"),
  background: text("background"),
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  profilePicturePath: text("profile_picture_path"),
  photoRestriction: boolean("photo_restriction").notNull().default(false),
  hasMedicalCondition: boolean("has_medical_condition").notNull().default(false),
  medicalRiskPlan: jsonb("medical_risk_plan"),
  communicationPlan: jsonb("communication_plan"),
  approvedPickups: jsonb("approved_pickups"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({ id: true, createdAt: true });
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
