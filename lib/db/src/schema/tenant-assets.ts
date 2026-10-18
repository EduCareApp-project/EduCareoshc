import { text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantTable } from "./tenant-table";

export const tenantFilesTable = tenantTable("tenant_files", {
  objectPath: text("object_path").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** References workspace-managed secrets, never the credential values themselves.
 * Bindings are provisioned by the trusted control plane, not tenant-supplied env names. */
export const tenantIntegrationsTable = tenantTable("tenant_integrations", {
  provider: text("provider").notNull(),
  secretName: text("secret_name").notNull(),
  resourceId: text("resource_id"),
}, (table) => [
  uniqueIndex("tenant_integrations_org_provider_unique").on(table.organisationId, table.provider),
  uniqueIndex("tenant_integrations_provider_secret_unique").on(table.provider, table.secretName),
]);
