import { serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffQualificationsTable } from "./staff_qualifications";

export const qualificationDocumentsTable = pgTable("qualification_documents", {
  id: serial("id").primaryKey(),
  qualificationId: integer("qualification_id").notNull().references(() => staffQualificationsTable.id, { onDelete: "cascade" }),
  documentPath: text("document_path").notNull(),
  documentName: text("document_name"),
  active: boolean("active").notNull().default(true),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQualificationDocumentSchema = createInsertSchema(qualificationDocumentsTable).omit({ id: true, uploadedAt: true });
export type InsertQualificationDocument = z.infer<typeof insertQualificationDocumentSchema>;
export type QualificationDocument = typeof qualificationDocumentsTable.$inferSelect;
