import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const accessSettingsTable = pgTable("access_settings", {
  id: serial("id").primaryKey(),
  role: text("role").notNull().unique(),
  disabledHrefs: text("disabled_hrefs").array().notNull().default([]),
});

export type AccessSetting = typeof accessSettingsTable.$inferSelect;
