import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fileCategoriesTable = pgTable("file_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFileCategorySchema = createInsertSchema(fileCategoriesTable).omit({ id: true, createdAt: true });
export type InsertFileCategory = z.infer<typeof insertFileCategorySchema>;
export type FileCategory = typeof fileCategoriesTable.$inferSelect;
