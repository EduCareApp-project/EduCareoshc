import { pgTable, serial, text, timestamp, date, integer, unique } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyReviewsTable = pgTable("weekly_reviews", {
  id: serial("id").primaryKey(),
  weekStart: date("week_start").notNull(),
  siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  completedById: integer("completed_by_id").notNull().references(() => staffTable.id, { onDelete: "restrict" }),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  weeklySummary: text("weekly_summary"),
  goalsAchieved: text("goals_achieved"),
  environmentChanges: text("environment_changes"),
  weekQuality: text("week_quality"),
  professionalEnquiry: text("professional_enquiry"),
  childEngagement: text("child_engagement"),
  jottingsCount: integer("jottings_count").notNull().default(0),
  observationsCount: integer("observations_count").notNull().default(0),
  postsCount: integer("posts_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_weekly_review_site_week").on(t.siteId, t.weekStart),
]);

export const insertWeeklyReviewSchema = createInsertSchema(weeklyReviewsTable).omit({
  id: true, createdAt: true, updatedAt: true, completedAt: true,
  jottingsCount: true, observationsCount: true, postsCount: true,
});
export type InsertWeeklyReview = z.infer<typeof insertWeeklyReviewSchema>;
export type WeeklyReview = typeof weeklyReviewsTable.$inferSelect;
