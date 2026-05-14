import { pgTable, serial, text, timestamp, integer, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const policiesTable = pgTable("policies", {
  id: serial("id").primaryKey(),
  policyNumber: integer("policy_number"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  content: text("content"),             // HTML body
  documentPath: text("document_path"),  // object-storage path for PDF
  documentName: text("document_name"),
  fileUrl: text("file_url"),            // legacy
  version: text("version"),             // legacy text label
  versionNumber: integer("version_number").notNull().default(1),
  lastReviewedAt: date("last_reviewed_at"),
  requiresAcknowledgment: text("requires_acknowledgment").notNull().default("yes"),
  notifyRoles: text("notify_roles"),    // comma-separated: educational_leader,coordinator,educator
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policyAcknowledgmentsTable = pgTable("policy_acknowledgments", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").notNull(),
  staffId: integer("staff_id").notNull(),
  policyVersion: integer("policy_version").notNull().default(1),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPolicySchema = createInsertSchema(policiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policiesTable.$inferSelect;

export const insertPolicyAcknowledgmentSchema = createInsertSchema(policyAcknowledgmentsTable).omit({ id: true, acknowledgedAt: true });
export type InsertPolicyAcknowledgment = z.infer<typeof insertPolicyAcknowledgmentSchema>;
export type PolicyAcknowledgment = typeof policyAcknowledgmentsTable.$inferSelect;
