import { pgTable, serial, text, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const observationsTable = pgTable("observations", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  staffId: integer("staff_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  observationDate: date("observation_date").notNull(),
  outcomeIds: integer("outcome_ids").array().notNull().default([]),
  programId: integer("program_id"),
  learningExtension: text("learning_extension"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertObservationSchema = createInsertSchema(observationsTable).omit({ id: true, createdAt: true });
export type InsertObservation = z.infer<typeof insertObservationSchema>;
export type Observation = typeof observationsTable.$inferSelect;
