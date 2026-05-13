import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jottingsTable = pgTable("jottings", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  childId: integer("child_id"),
  staffId: integer("staff_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const insertJottingSchema = createInsertSchema(jottingsTable).omit({ id: true, createdAt: true });
export type InsertJotting = z.infer<typeof insertJottingSchema>;
export type Jotting = typeof jottingsTable.$inferSelect;
