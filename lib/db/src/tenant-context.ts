import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";

const context = new AsyncLocalStorage<{ organisationId: number }>();
export const TENANT_DATABASE_ROLE = "portal_tenant";

export function currentOrganisationId(): number {
  const id = context.getStore()?.organisationId;
  if (!Number.isSafeInteger(id) || !id || id <= 0) throw new Error("Verified organisation context is required for database access");
  return id;
}

export function withOrganisationContext<T>(organisationId: number, work: () => T): T {
  if (!Number.isSafeInteger(organisationId) || organisationId <= 0) throw new Error("Invalid organisation context");
  return context.run({ organisationId }, work);
}

/** Restrict every borrowed connection, including Drizzle transaction connections. */
export function tenantPool(pool: Pool): Pool {
  async function borrow(): Promise<PoolClient> {
    const id = currentOrganisationId();
    const client = await pool.connect();
    try {
      await client.query("SELECT set_config('portal.organisation_id', $1, false)", [String(id)]);
      await client.query(`SET ROLE ${TENANT_DATABASE_ROLE}`);
    } catch (error) {
      client.release(true);
      throw error;
    }
    const release = client.release.bind(client);
    let released = false;
    client.release = (error?: Error | boolean) => {
      if (released) return;
      released = true;
      // Do not return the connection to the pool until its session is clean.
      void (async () => {
        try {
          await client.query("RESET ROLE");
          await client.query("SELECT set_config('portal.organisation_id', '', false)");
          release(error);
        } catch { release(true); }
      })();
    };
    return client;
  }
  return new Proxy(pool, {
    get(target, key) {
      if (key === "connect") return borrow;
      if (key === "query") return async (...args: unknown[]) => {
        const client = await borrow();
        try { return await (client.query as (...values: unknown[]) => Promise<unknown>)(...args); }
        finally { client.release(); }
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
