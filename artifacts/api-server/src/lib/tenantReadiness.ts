import { pool } from "@workspace/db";

export async function assertTenantIsolationReady(): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.TENANT_ISOLATION_RELEASE_APPROVED !== "reviewed") {
    throw new Error("Release blocked: company isolation production preparation has not been reviewed");
  }
  const { rows: [role] } = await pool.query(
    "SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname='portal_tenant'",
  );
  if (!role || role.rolsuper || role.rolbypassrls || role.rolcanlogin) {
    throw new Error("Release blocked: the restricted company database role is not ready");
  }
  const { rows: [functions] } = await pool.query(
    "SELECT to_regprocedure('portal_record_references_owned(text,jsonb)') IS NOT NULL AS ready",
  );
  if (!functions.ready) throw new Error("Release blocked: company reference policies are not provisioned");
  const { rows: tables } = await pool.query(`SELECT c.relname,c.relrowsecurity,
    EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='portal_company_boundary') AS policy
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN('session','super_admin_orgs')`);
  for (const table of tables) {
    if (!table.relrowsecurity || !table.policy) throw new Error(`Release blocked: company policy missing on ${table.relname}`);
    const owner = table.relname === "organisation" ? "id" : table.relname === "sites" ? "org_id" : "organisation_id";
    const name = `"${table.relname.replaceAll('"', '""')}"`;
    const unassigned = await pool.query(`SELECT 1 FROM ${name} WHERE "${owner}" IS NULL LIMIT 1`);
    if (unassigned.rowCount) throw new Error(`Release blocked: unassigned company records in ${table.relname}`);
  }
}
