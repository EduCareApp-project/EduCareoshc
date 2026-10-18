import { serial, text, timestamp, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { scopedTable as pgTable } from "./scoped-table";
import { sql } from "drizzle-orm";
import { organisationTable } from "./organisation";

export interface EmailTemplateOverride {
  subject?: string;
  intro?: string;
}

export interface EmailTemplateMap {
  passwordReset?: EmailTemplateOverride;
  loginInvite?: EmailTemplateOverride;
  loginResend?: EmailTemplateOverride;
  postNotification?: EmailTemplateOverride;
  contactEnquiry?: EmailTemplateOverride;
}

export const emailSettingsTable = pgTable("email_settings", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").references(() => organisationTable.id, { onDelete: "restrict" }),
  senderName: text("sender_name").notNull().default("EduCare Portal"),
  logoPath: text("logo_path"),
  companyLogoPath: text("company_logo_path"),
  templates: jsonb("templates").$type<EmailTemplateMap>().notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("email_settings_organisation_unique").on(table.organisationId)]);

export type EmailSettings = typeof emailSettingsTable.$inferSelect;
