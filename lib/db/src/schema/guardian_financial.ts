import { sql } from "drizzle-orm";
import { serial, text, timestamp, numeric, date, index, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { scopedTable as pgTable } from "./scoped-table";
import { organisationTable } from "./organisation";

/** Overall billing/financial status for a guardian. Created on first access (upsert). */
export const guardianFinancialAccountsTable = pgTable("guardian_financial_accounts", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  guardianEmail: text("guardian_email").notNull(),
  status: text("status").notNull().default("active"), // active | payment_plan | suspended
  reasoning: text("reasoning"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("guardian_financial_accounts_org_email_unique").on(table.organisationId, table.guardianEmail)]);

export type GuardianFinancialAccount = typeof guardianFinancialAccountsTable.$inferSelect;

/** Timestamped phone/communication log entries for a guardian. */
export const guardianCommunicationLogsTable = pgTable("guardian_communication_logs", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  guardianEmail: text("guardian_email").notNull(),
  note: text("note").notNull(),
  staffName: text("staff_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("guardian_communication_logs_created_at_id_idx")
    .on(table.createdAt.desc(), table.id.desc()),
  index("guardian_communication_logs_email_created_at_id_idx")
    .on(sql`lower(trim(${table.guardianEmail}))`, table.createdAt.desc(), table.id.desc()),
  index("guardian_communication_logs_org_email_idx").on(table.organisationId, table.guardianEmail),
]);

export type GuardianCommunicationLog = typeof guardianCommunicationLogsTable.$inferSelect;

/** Agreed payment plan records — one-off or recurring. */
export const guardianPaymentPlansTable = pgTable("guardian_payment_plans", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  guardianEmail: text("guardian_email").notNull(),
  type: text("type").notNull(), // one_off | recurring
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency"), // weekly | fortnightly | monthly — null for one_off
  description: text("description"),
  expectedDate: date("expected_date"), // for one_off plans: the expected payment date
  startDate: date("start_date"),       // plan start date
  endDate: date("end_date"),           // plan end date
  receivedAt: timestamp("received_at", { withTimezone: true }), // set when payment confirmed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("guardian_payment_plans_org_email_idx").on(table.organisationId, table.guardianEmail)]);

export type GuardianPaymentPlan = typeof guardianPaymentPlansTable.$inferSelect;
