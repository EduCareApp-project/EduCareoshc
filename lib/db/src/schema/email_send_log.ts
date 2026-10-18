import { serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";

/**
 * Lightweight deduplication log for scheduled transactional emails.
 * A row is inserted (with ON CONFLICT DO NOTHING) before each send.
 * If the insert produces 0 rows the email was already sent for this key
 * and should be skipped. Keys should be stable within the intended
 * dedup window, e.g. `medication_expiry_email:{medicationId}:{YYYY-MM}:{email}`.
 */
export const emailSendLogTable = pgTable("email_send_log", {
  id: serial("id").primaryKey(),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("email_send_log_org_dedupe_unique").on(table.organisationId, table.dedupeKey)]);
