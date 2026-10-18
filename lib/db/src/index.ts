import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { tenantPool } from "./tenant-context";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
/** Privileged handle: membership/credential routing, control plane and development setup only. */
export const systemDb = drizzle(pool, { schema, logger: process.env.NODE_ENV !== "production" });
export const tenantConnectionPool = tenantPool(pool);
export const db = drizzle(tenantConnectionPool, { schema, logger: process.env.NODE_ENV !== "production" });

export * from "./schema";
export { withOrganisationContext, currentOrganisationId, TENANT_DATABASE_ROLE } from "./tenant-context";
