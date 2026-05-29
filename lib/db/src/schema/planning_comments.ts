import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { planningExperiencesTable } from "./planning_experiences";
import { staffTable } from "./staff";

export const planningCommentsTable = pgTable("planning_comments", {
  id: serial("id").primaryKey(),
  planningExperienceId: integer("planning_experience_id").notNull().references(() => planningExperiencesTable.id, { onDelete: "cascade" }),
  staffId: integer("staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlanningComment = typeof planningCommentsTable.$inferSelect;
