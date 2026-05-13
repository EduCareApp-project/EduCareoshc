import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const policiesTable = pgTable("policies", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  version: text("version"),
  lastReviewedAt: date("last_reviewed_at"),
  requiresAcknowledgment: text("requires_acknowledgment").notNull().default("yes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policyAcknowledgmentsTable = pgTable("policy_acknowledgments", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").notNull(),
  staffId: integer("staff_id").notNull(),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPolicySchema = createInsertSchema(policiesTable).omit({ id: true, createdAt: true });
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policiesTable.$inferSelect;

export const insertPolicyAcknowledgmentSchema = createInsertSchema(policyAcknowledgmentsTable).omit({ id: true, acknowledgedAt: true });
export type InsertPolicyAcknowledgment = z.infer<typeof insertPolicyAcknowledgmentSchema>;
export type PolicyAcknowledgment = typeof policyAcknowledgmentsTable.$inferSelect;
