import { serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { scopedTable as pgTable } from "./scoped-table";
import { organisationTable } from "./organisation";

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  accountId: integer("account_id"),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  userType: text("user_type").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
