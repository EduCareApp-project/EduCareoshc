/**
 * Development only. Fixtures and all attempted mutations are rolled back.
 * Tests the actual restricted PostgreSQL role, not a mocked query builder.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { describe, expect, it } from "vitest";
import { pool, db, systemDb, staffTable, withOrganisationContext } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const enabled = process.env.RUN_TENANT_DB_TESTS === "1" && process.env.NODE_ENV !== "production";
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const parents: Record<string, string> = {
  child_id: "children", staff_id: "staff", site_id: "sites", program_id: "programs",
  administered_by_id: "staff", witness_id: "staff", reviewer_id: "staff", respondent_id: "staff",
  report_person_id: "staff", completed_by_id: "staff", completed_by_staff_id: "staff",
  sent_by_staff_id: "staff", set_by_staff_id: "staff", updated_by_id: "staff",
  created_by_id: "staff", created_by_staff_id: "staff", generated_by_id: "staff",
  finalized_by_id: "staff", archived_by_id: "staff", uploaded_by_staff_id: "staff",
  category_id: "file_categories", medication_id: "child_medications", qualification_id: "staff_qualifications",
  appraisal_id: "staff_appraisals", term_id: "school_report_terms", routine_id: "checklist_routines",
  checklist_id: "checklists", template_id: "checklist_templates", observation_id: "observations",
  planning_experience_id: "planning_experiences", post_id: "posts", policy_id: "policies",
  excursion_id: "excursions", recipient_id: "excursion_recipients",
  claimed_excursion_id: "excursions", guardian_id: "parent_accounts",
};
type Column = { table_name: string; column_name: string; data_type: string; column_default: string | null; is_nullable: string };
type Fixture = Record<string, Record<string, any>>;

describe.skipIf(!enabled)("tenant database isolation", () => {
  it("requires a company and keeps concurrent pooled connections isolated", async () => {
    await expect(db.select({ id: staffTable.id }).from(staffTable)).rejects.toMatchObject({
      cause: expect.objectContaining({ message: expect.stringContaining("organisation context") }),
    });
    const [existing] = await systemDb.select({ id: staffTable.organisationId }).from(staffTable)
      .where(sql`${staffTable.organisationId} IS NOT NULL`).limit(1);
    expect(existing?.id).toBeTruthy();
    const expected = await systemDb.select({ id: staffTable.id }).from(staffTable)
      .where(eq(staffTable.organisationId, existing.id!));
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      withOrganisationContext(index % 2 ? 2147483000 : existing.id!, async () => {
        const rows = await db.select({ id: staffTable.id }).from(staffTable);
        return { index, count: rows.length };
      })));
    for (const result of results) expect(result.count).toBe(result.index % 2 ? 0 : expected.length);
    const role = await pool.query("SELECT current_user AS name");
    expect(role.rows[0].name).not.toBe("portal_tenant");
  });

  it("protects every portal table, foreign key, child array and private file reference", async () => {
    const client = await pool.connect();
    await client.query("BEGIN");
    try {
      const suffix = randomUUID();
      const owners = (await client.query(
        "INSERT INTO organisation(name,organisation_id) VALUES($1,$2),($3,$4) RETURNING *",
        [`Isolation A ${suffix}`, `ISO-A-${suffix}`, `Isolation B ${suffix}`, `ISO-B-${suffix}`],
      )).rows;
      const columns = (await client.query<Column>(
        `SELECT table_name,column_name,data_type,column_default,is_nullable FROM information_schema.columns
         WHERE table_schema='public' AND table_name NOT IN ('session','super_admin_orgs')
         ORDER BY table_name,ordinal_position`,
      )).rows;
      const tables = [...new Set(columns.map((column) => column.table_name))];
      const foreignKeys = (await client.query(
        `SELECT c.conrelid::regclass::text AS source,a.attname AS col,ft.relname AS parent,fa.attname AS target
         FROM pg_constraint c JOIN pg_class ft ON ft.oid=c.confrelid
         JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
         JOIN pg_attribute fa ON fa.attrelid=c.confrelid AND fa.attnum=c.confkey[1]
         WHERE c.contype='f' AND array_length(c.conkey,1)=1`,
      )).rows;
      const fixtures: Fixture[] = owners.map((owner) => ({ organisation: owner }));
      for (const [index, owner] of owners.entries()) {
        fixtures[index].tenant_files = (await client.query(
          "INSERT INTO tenant_files(object_path,organisation_id) VALUES($1,$2) RETURNING *",
          [`/objects/isolation-${index}-${suffix}`, owner.id],
        )).rows[0];
      }
      const pending = tables.filter((table) => !["organisation", "tenant_files"].includes(table));
      let attempts = pending.length * 2;
      while (pending.length && attempts-- > 0) {
        const table = pending.shift()!;
        const required = columns.filter((column) => column.table_name === table && column.is_nullable === "NO" && column.column_default === null);
        const refs = new Map(foreignKeys.filter((fk) => fk.source === table).map((fk) => [fk.col, { parent: fk.parent, target: fk.target }]));
        for (const column of required) if (parents[column.column_name] && !refs.has(column.column_name)) {
          refs.set(column.column_name, { parent: parents[column.column_name], target: "id" });
        }
        if (required.some((column) => refs.has(column.column_name) && !fixtures[0][refs.get(column.column_name)!.parent])) {
          pending.push(table); continue;
        }
        for (const [index, owner] of owners.entries()) {
          const ownerKey = table === "sites" ? "org_id" : "organisation_id";
          const values: Record<string, unknown> = { [ownerKey]: owner.id };
          for (const column of required) {
            const key = column.column_name;
            if (key === ownerKey) continue;
            const ref = refs.get(key);
            if (ref) { values[key] = fixtures[index][ref.parent][ref.target]; continue; }
            if (column.data_type === "ARRAY") values[key] = [];
            else if (["integer", "bigint", "smallint", "numeric", "real", "double precision"].includes(column.data_type)) values[key] = 1;
            else if (column.data_type === "boolean") values[key] = false;
            else if (column.data_type.includes("timestamp")) values[key] = key.includes("end") ? "2026-01-02T00:00:00Z" : "2026-01-01T00:00:00Z";
            else if (column.data_type === "date") values[key] = "2026-01-01";
            else if (column.data_type === "jsonb" || column.data_type === "json") values[key] = {};
            else if (/path$/.test(key)) values[key] = fixtures[index].tenant_files.object_path;
            else if (/email/.test(key)) values[key] = `shared-${suffix}@example.invalid`;
            else values[key] = `fixture-${index}-${suffix}`;
          }
          const keys = Object.keys(values);
          fixtures[index][table] = (await client.query(
            `INSERT INTO ${quote(table)}(${keys.map(quote).join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
            Object.values(values),
          )).rows[0];
        }
      }
      expect(pending, "Every table must have representative fixtures").toEqual([]);
      const policies = (await client.query("SELECT tablename,qual,with_check FROM pg_policies WHERE policyname='portal_company_boundary'")).rows;
      for (const table of tables) {
        const policy = policies.find((item) => item.tablename === table);
        expect(Boolean(policy?.qual?.includes("portal.organisation_id")), `${table}: read policy`).toBe(true);
        expect(Boolean(policy?.with_check?.includes("portal_record_references_owned")), `${table}: reference policy`).toBe(true);
      }
      await client.query("UPDATE sites SET identifier='SHARE' WHERE org_id=ANY($1::int[])", [owners.map((owner) => owner.id)]);
      const sharedCodes = await client.query("SELECT count(*)::integer AS n FROM sites WHERE org_id=ANY($1::int[]) AND identifier='SHARE'", [owners.map((owner) => owner.id)]);
      expect(sharedCodes.rows[0].n).toBe(2);
      await client.query("SELECT set_config('portal.organisation_id',$1,true)", [String(owners[1].id)]);
      await client.query("SET LOCAL ROLE portal_tenant");
      await client.query("SAVEPOINT duplicate_service_code");
      await expect(client.query("INSERT INTO sites(name,identifier,org_id) VALUES('Duplicate','SHARE',$1)", [owners[1].id]))
        .rejects.toMatchObject({ code: "23505" });
      await client.query("ROLLBACK TO SAVEPOINT duplicate_service_code");
      await client.query("RELEASE SAVEPOINT duplicate_service_code");
      const denied = async (statement: string, values: unknown[], label: string) => {
        await client.query("SAVEPOINT tampered");
        let rejected = false;
        try { await client.query(statement, values); } catch { rejected = true; }
        await client.query("ROLLBACK TO SAVEPOINT tampered");
        await client.query("RELEASE SAVEPOINT tampered");
        expect(rejected, label).toBe(true);
      };
      const accountKinds = [
        { kind: "staff", table: "staff", emailColumn: "email" },
        { kind: "guardian", table: "parent_accounts", emailColumn: "guardian_email" },
        { kind: "school", table: "school_accounts", emailColumn: "username" },
      ];
      const newPassword = `updated-${suffix}`;
      const newHash = await bcrypt.hash(newPassword, 4);
      for (const account of accountKinds) {
        const ownAccount = fixtures[1][account.table];
        const foreignAccount = fixtures[0][account.table];
        const token = randomUUID();
        const issued = await client.query(`INSERT INTO password_reset_tokens
          (organisation_id,account_id,token,email,user_type,expires_at)
          VALUES($1,$2,$3,$4,$5,now()+interval '1 hour') RETURNING id`,
          [owners[1].id, ownAccount.id, token, ownAccount[account.emailColumn], account.kind]);
        expect(issued.rowCount, `${account.kind}: restricted-role token issuance`).toBe(1);
        await denied(`INSERT INTO password_reset_tokens
          (organisation_id,account_id,token,email,user_type,expires_at)
          VALUES($1,$2,$3,$4,$5,now()+interval '1 hour')`,
          [owners[1].id, foreignAccount.id, randomUUID(), foreignAccount[account.emailColumn], account.kind],
          `${account.kind}: foreign account token`);
        const claimed = await client.query(`UPDATE password_reset_tokens SET used_at=now()
          WHERE token=$1 AND used_at IS NULL AND expires_at>now() RETURNING *`, [token]);
        expect(claimed.rowCount, `${account.kind}: token consumption`).toBe(1);
        expect(claimed.rows[0].user_type).toBe(account.kind);
        const updated = await client.query(`UPDATE ${quote(account.table)} SET password_hash=$1
          WHERE id=$2 AND organisation_id=$3 AND ${quote(account.emailColumn)}=$4 RETURNING password_hash`,
          [newHash, claimed.rows[0].account_id, claimed.rows[0].organisation_id, claimed.rows[0].email]);
        expect(updated.rowCount, `${account.kind}: password update`).toBe(1);
        expect(await bcrypt.compare(newPassword, updated.rows[0].password_hash)).toBe(true);
        const replay = await client.query(`UPDATE password_reset_tokens SET used_at=now()
          WHERE token=$1 AND used_at IS NULL AND expires_at>now() RETURNING id`, [token]);
        expect(replay.rowCount, `${account.kind}: single-use token`).toBe(0);
        await client.query("DELETE FROM password_reset_tokens WHERE id=$1", [issued.rows[0].id]);
      }
      for (const table of tables) {
        const ownerKey = table === "organisation" ? "id" : table === "sites" ? "org_id" : "organisation_id";
        const name = quote(table);
        const foreign = await client.query(`SELECT count(*)::integer AS n FROM ${name} WHERE ${quote(ownerKey)}=$1`, [owners[0].id]);
        expect(foreign.rows[0].n, `${table}: foreign reads`).toBe(0);
        const own = await client.query(`SELECT count(*)::integer AS n FROM ${name} WHERE ${quote(ownerKey)}=$1`, [owners[1].id]);
        expect(own.rows[0].n, `${table}: own reads`).toBe(1);
        if (["organisation", "tenant_integrations"].includes(table)) {
          await denied(`DELETE FROM ${name} WHERE ${quote(ownerKey)}=$1`, [owners[0].id], `${table}: control permissions`);
        } else {
          const changed = await client.query(`DELETE FROM ${name} WHERE ${quote(ownerKey)}=$1`, [owners[0].id]);
          expect(changed.rowCount, `${table}: foreign deletes`).toBe(0);
        }
        await denied(`UPDATE ${name} SET ${quote(ownerKey)}=$1 WHERE ${quote(ownerKey)}=$2`, [owners[0].id, owners[1].id], `${table}: owner tampering`);
        if (["organisation", "tenant_integrations", "tenant_files"].includes(table)) continue;
        for (const column of columns.filter((item) => item.table_name === table && item.column_name !== ownerKey && item.data_type === "integer")) {
          const ref = foreignKeys.find((fk) => fk.source === table && fk.col === column.column_name);
          const parent = ref?.parent ?? parents[column.column_name];
          const key = ref?.target ?? "id";
          if (!parent || !fixtures[0][parent]) continue;
          await denied(`UPDATE ${name} SET ${quote(column.column_name)}=$1 WHERE ${quote(ownerKey)}=$2`,
            [fixtures[0][parent][key], owners[1].id], `${table}.${column.column_name}: foreign reference`);
        }
        if (columns.some((column) => column.table_name === table && column.column_name === "child_ids")) {
          await denied(`UPDATE ${name} SET child_ids=$1 WHERE ${quote(ownerKey)}=$2`,
            [[fixtures[0].children.id], owners[1].id], `${table}: foreign child array`);
        }
        if (["planning_experiences", "programs"].includes(table)) {
          await denied(`UPDATE ${name} SET outcome_ids=$1 WHERE ${quote(ownerKey)}=$2`,
            [[fixtures[0].outcomes.id], owners[1].id], `${table}: foreign outcome array`);
        }
        const pathColumn = columns.find((column) => column.table_name === table && /^(document_path|profile_picture_path|logo_path)$/.test(column.column_name));
        if (pathColumn) await denied(`UPDATE ${name} SET ${quote(pathColumn.column_name)}=$1 WHERE ${quote(ownerKey)}=$2`,
          [fixtures[0].tenant_files.object_path, owners[1].id], `${table}: foreign file`);
      }
      await client.query("RESET ROLE");
      for (const account of accountKinds) {
        const unchanged = await client.query(`SELECT password_hash FROM ${quote(account.table)} WHERE id=$1`,
          [fixtures[0][account.table].id]);
        expect(unchanged.rows[0].password_hash, `${account.kind}: other company password unchanged`)
          .toBe(fixtures[0][account.table].password_hash);
      }
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }, 120_000);
});
