import { serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { scopedTable as pgTable } from "./scoped-table";
import { organisationTable } from "./organisation";

export const guardianLoginLogsTable = pgTable("guardian_login_logs", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  guardianEmail: text("guardian_email").notNull(),
  loggedInAt: timestamp("logged_in_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("guardian_login_logs_org_email_idx").on(table.organisationId, table.guardianEmail)]);
