/**
 * Returns the canonical public-facing URL for the portal.
 * Set APP_URL in environment to override (e.g. in dev).
 */
export function getAppUrl(): string {
  return process.env.APP_URL ?? "https://www.app.educareoshc.com.au";
}
