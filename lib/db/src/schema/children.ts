import { pgTable, serial, text, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  enrollmentDate: date("enrollment_date").notNull(),
  ageGroup: text("age_group").notNull().default("preschool"),
  status: text("status").notNull().default("active"),
  guardianName: text("guardian_name").notNull(),
  guardianEmail: text("guardian_email").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  medicalNotes: text("medical_notes"),
  likes: text("likes"),
  dislikes: text("dislikes"),
  temperament: text("temperament"),
  background: text("background"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({ id: true, createdAt: true });
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof childrenTable.$inferSelect;
