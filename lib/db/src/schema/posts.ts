import { pgTable, serial, text, timestamp, date, integer } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { childrenTable } from "./children";
import { staffTable } from "./staff";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  childId: integer("child_id").references(() => childrenTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  date: date("date"),
  staffId: integer("staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  images: text("images").array().notNull().default([]),
  description: text("description"),
  learning: text("learning"),
  opportunities: text("opportunities"),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
