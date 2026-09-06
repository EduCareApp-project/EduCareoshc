import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  senderName: text("sender_name").notNull().default("EduCare Portal"),
  logoPath: text("logo_path"),
  companyLogoPath: text("company_logo_path"),
  templates: jsonb("templates").$type<EmailTemplateMap>().notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailSettings = typeof emailSettingsTable.$inferSelect;
