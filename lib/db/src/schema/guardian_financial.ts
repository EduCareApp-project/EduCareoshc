import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";

/** Overall billing/financial status for a guardian. Created on first access (upsert). */
export const guardianFinancialAccountsTable = pgTable("guardian_financial_accounts", {
  id: serial("id").primaryKey(),
  guardianEmail: text("guardian_email").notNull().unique(),
  status: text("status").notNull().default("active"), // active | payment_plan | suspended
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuardianFinancialAccount = typeof guardianFinancialAccountsTable.$inferSelect;

/** Timestamped phone/communication log entries for a guardian. */
export const guardianCommunicationLogsTable = pgTable("guardian_communication_logs", {
  id: serial("id").primaryKey(),
  guardianEmail: text("guardian_email").notNull(),
  note: text("note").notNull(),
  staffName: text("staff_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuardianCommunicationLog = typeof guardianCommunicationLogsTable.$inferSelect;

/** Agreed payment plan records — one-off or recurring. */
export const guardianPaymentPlansTable = pgTable("guardian_payment_plans", {
  id: serial("id").primaryKey(),
  guardianEmail: text("guardian_email").notNull(),
  type: text("type").notNull(), // one_off | recurring
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency"), // weekly | fortnightly | monthly — null for one_off
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuardianPaymentPlan = typeof guardianPaymentPlansTable.$inferSelect;
