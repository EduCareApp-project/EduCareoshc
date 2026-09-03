import { index, pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";

export const documentMergeUploadsTable = pgTable(
  "document_merge_uploads",
  {
    id: serial("id").primaryKey(),
    staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
    objectPath: text("object_path").notNull().unique(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("document_merge_uploads_created_at_idx").on(table.createdAt),
  }),
);

export const mergedDocumentsTable = pgTable("merged_documents", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sourceNames: text("source_names").array().notNull(),
  pageCount: integer("page_count").notNull(),
  objectPath: text("object_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentMergeUploadSchema = createInsertSchema(documentMergeUploadsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentMergeUpload = z.infer<typeof insertDocumentMergeUploadSchema>;
export type DocumentMergeUpload = typeof documentMergeUploadsTable.$inferSelect;

export const insertMergedDocumentSchema = createInsertSchema(mergedDocumentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMergedDocument = z.infer<typeof insertMergedDocumentSchema>;
export type MergedDocument = typeof mergedDocumentsTable.$inferSelect;