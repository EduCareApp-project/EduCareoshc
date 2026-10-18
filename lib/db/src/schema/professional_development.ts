import { serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const professionalDevelopmentTable = pgTable("professional_development", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  title: text("title").notNull(),
  provider: text("provider"),
  completedAt: date("completed_at").notNull(),
  hoursEarned: integer("hours_earned"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProfessionalDevelopmentSchema = createInsertSchema(professionalDevelopmentTable).omit({ id: true, createdAt: true });
export type InsertProfessionalDevelopment = z.infer<typeof insertProfessionalDevelopmentSchema>;
export type ProfessionalDevelopment = typeof professionalDevelopmentTable.$inferSelect;
