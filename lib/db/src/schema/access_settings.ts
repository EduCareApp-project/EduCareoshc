import { serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantTable as pgTable } from "./tenant-table";

export const accessSettingsTable = pgTable("access_settings", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  disabledHrefs: text("disabled_hrefs").array().notNull().default([]),
}, (table) => [uniqueIndex("access_settings_org_role_unique").on(table.organisationId, table.role)]);

export type AccessSetting = typeof accessSettingsTable.$inferSelect;
