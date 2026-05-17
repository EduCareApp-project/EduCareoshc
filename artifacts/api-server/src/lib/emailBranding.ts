import { db, emailSettingsTable } from "@workspace/db";
import { logger } from "./logger";

export interface EmailBranding {
  senderName: string;
  logoUrl: string | null;
  templates: {
    passwordReset?: { subject?: string; intro?: string };
    loginInvite?: { subject?: string; intro?: string };
    loginResend?: { subject?: string; intro?: string };
    postNotification?: { subject?: string; intro?: string };
    contactEnquiry?: { subject?: string; intro?: string };
  };
}

function getBaseUrl(): string {
  const domains = (process.env.REPLIT_DOMAINS ?? process.env.REPLIT_DEV_DOMAIN ?? "localhost").split(",");
  return `https://${domains[0]}`;
}

const DEFAULT_LOGO_PATH = "/educare-logo-dark.png";

export async function getEmailBranding(): Promise<EmailBranding> {
  const fallbackLogoUrl = `${getBaseUrl()}${DEFAULT_LOGO_PATH}`;
  try {
    const [row] = await db.select().from(emailSettingsTable).limit(1);
    if (!row) return { senderName: "EduCare Portal", logoUrl: fallbackLogoUrl, templates: {} };

    const logoUrl = row.logoPath
      ? `${getBaseUrl()}/api/email-settings/logo`
      : fallbackLogoUrl;

    return {
      senderName: row.senderName,
      logoUrl,
      templates: (row.templates as EmailBranding["templates"]) ?? {},
    };
  } catch (err) {
    logger.warn({ err }, "Failed to fetch email branding settings — using defaults");
    return { senderName: "EduCare Portal", logoUrl: fallbackLogoUrl, templates: {} };
  }
}
