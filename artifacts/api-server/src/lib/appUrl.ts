/**
 * Returns the canonical public-facing URL for the portal.
 *
 * Resolution order:
 * 1. APP_URL env var — explicit override (highest priority)
 * 2. REPLIT_DOMAINS — first entry is the deployed app's public domain
 * 3. Hard-coded fallback for environments where neither is set
 */
export function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const first = replitDomains.split(",")[0].trim();
    if (first) return `https://${first}`;
  }

  return "https://app.educareoshc.com.au";
}
