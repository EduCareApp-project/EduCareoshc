import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const guardianLoginLogsTable = pgTable("guardian_login_logs", {
  id: serial("id").primaryKey(),
  guardianEmail: text("guardian_email").notNull(),
  loggedInAt: timestamp("logged_in_at", { withTimezone: true }).notNull().defaultNow(),
});
