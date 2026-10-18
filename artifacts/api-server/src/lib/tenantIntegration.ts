import { db, tenantIntegrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/** No global-credential fallback. Only a trusted, company-owned binding can
 * resolve a workspace secret name; tenant request bodies cannot choose names. */
export async function tenantIntegration(provider: "kidsoft" | "clickup") {
  const [binding] = await db.select({ secretName: tenantIntegrationsTable.secretName, resourceId: tenantIntegrationsTable.resourceId })
    .from(tenantIntegrationsTable).where(eq(tenantIntegrationsTable.provider, provider)).limit(1);
  return binding ? { secret: process.env[binding.secretName] || undefined, resourceId: binding.resourceId } : undefined;
}
export async function tenantIntegrationSecret(provider: "kidsoft" | "clickup"): Promise<string | undefined> {
  return (await tenantIntegration(provider))?.secret;
}
