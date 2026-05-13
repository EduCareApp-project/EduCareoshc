import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evacuationsTable = pgTable("evacuations", {
  id: serial("id").primaryKey(),
  drillType: text("drill_type").notNull().default("evacuation"),
  conductedAt: timestamp("conducted_at", { withTimezone: true }).notNull(),
  nextDueAt: timestamp("next_due_at", { withTimezone: true }),
  participantCount: integer("participant_count"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  conductedBy: text("conducted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEvacuationSchema = createInsertSchema(evacuationsTable).omit({ id: true, createdAt: true });
export type InsertEvacuation = z.infer<typeof insertEvacuationSchema>;
export type Evacuation = typeof evacuationsTable.$inferSelect;
