import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffTable = pgTable("staff", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("educator"),
  qualifications: text("qualifications").notNull(),
  status: text("status").notNull().default("active"),
  phone: text("phone"),
  wwccNumber: text("wwcc_number"),
  bio: text("bio"),
  profilePicturePath: text("profile_picture_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
