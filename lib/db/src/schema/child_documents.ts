import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const childDocumentsTable = pgTable("child_documents", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull(),
  documentPath: text("document_path").notNull(),
  documentName: text("document_name"),
  category: text("category"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChildDocumentSchema = createInsertSchema(childDocumentsTable).omit({ id: true, uploadedAt: true });
export type InsertChildDocument = z.infer<typeof insertChildDocumentSchema>;
export type ChildDocument = typeof childDocumentsTable.$inferSelect;
