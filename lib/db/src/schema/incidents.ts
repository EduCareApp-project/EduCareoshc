import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  childId: integer("child_id").notNull(),
  incidentDate: date("incident_date").notNull(),
  location: text("location"),
  injuryDescription: text("injury_description"),
  actionTaken: text("action_taken"),
  status: text("status").notNull().default("open"),
  parentNotifiedAt: timestamp("parent_notified_at", { withTimezone: true }),
  directorNotifiedAt: timestamp("director_notified_at", { withTimezone: true }),
  deptNotifiedAt: timestamp("dept_notified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ id: true, createdAt: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
