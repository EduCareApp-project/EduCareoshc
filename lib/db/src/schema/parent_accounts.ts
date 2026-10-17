import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { organisationTable } from "./organisation";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const parentAccountsTable = pgTable("parent_accounts", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  guardianEmail: text("guardian_email").notNull().unique(),
  username: text("username"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
}, (table) => [index("parent_accounts_organisation_idx").on(table.organisationId)]);

export const insertParentAccountSchema = createInsertSchema(parentAccountsTable).omit({ id: true, createdAt: true, organisationId: true });
export type InsertParentAccount = z.infer<typeof insertParentAccountSchema>;
export type ParentAccount = typeof parentAccountsTable.$inferSelect;
