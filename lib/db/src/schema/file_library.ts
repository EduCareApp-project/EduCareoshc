import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fileLibraryTable = pgTable("file_library", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id"),
  siteId: integer("site_id"),
  name: text("name").notNull(),
  documentPath: text("document_path").notNull(),
  documentName: text("document_name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFileLibrarySchema = createInsertSchema(fileLibraryTable).omit({ id: true, createdAt: true });
export type InsertFileLibrary = z.infer<typeof insertFileLibrarySchema>;
export type FileLibraryItem = typeof fileLibraryTable.$inferSelect;
