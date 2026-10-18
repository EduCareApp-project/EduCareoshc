import { serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { observationsTable } from "./observations";
import { staffTable } from "./staff";

export const observationCommentsTable = pgTable("observation_comments", {
  id: serial("id").primaryKey(),
  observationId: integer("observation_id").notNull().references(() => observationsTable.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ObservationComment = typeof observationCommentsTable.$inferSelect;
