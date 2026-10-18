import { serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
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
  siteId: integer("site_id"),
  evacuationDocPath: text("evacuation_doc_path"),
  evacuationDocName: text("evacuation_doc_name"),
  attendanceDocPath: text("attendance_doc_path"),
  attendanceDocName: text("attendance_doc_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const insertEvacuationSchema = createInsertSchema(evacuationsTable).omit({ id: true, createdAt: true });
export type InsertEvacuation = z.infer<typeof insertEvacuationSchema>;
export type Evacuation = typeof evacuationsTable.$inferSelect;
