import { db, emailSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

export async function getEmailBranding(organisationId: number | null): Promise<EmailBranding> {
  const fallbackLogoUrl = `${getBaseUrl()}${DEFAULT_LOGO_PATH}`;
  // null is reserved for public, platform-level messages. It never means "the
  // first company". Portal messages must supply the verified owner explicitly.
  if (organisationId === null) return { senderName: "EduCare Portal", logoUrl: fallbackLogoUrl, templates: {} };
  if (!Number.isSafeInteger(organisationId) || organisationId <= 0) throw new Error("Email organisation is required");
  const [row] = await db.select().from(emailSettingsTable)
    .where(eq(emailSettingsTable.organisationId, organisationId)).limit(1);
  if (!row) return { senderName: "EduCare Portal", logoUrl: fallbackLogoUrl, templates: {} };

  const logoUrl = row.logoPath
    ? `${getBaseUrl()}/api/email-settings/logo?organisationId=${organisationId}`
    : fallbackLogoUrl;

  return {
    senderName: row.senderName,
    logoUrl,
    templates: (row.templates as EmailBranding["templates"]) ?? {},
  };
}
