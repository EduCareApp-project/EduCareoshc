/**
 * Development-only isolation setup. Never invoked by the API or a deployment.
 * Production rollout/backfill/role provisioning needs separate review.
 */
import pg from "pg";

if (!process.argv.includes("--development") || process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Tenant setup is development-only; production requires a separately reviewed procedure");
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const role = "portal_tenant";
const setting = "nullif(current_setting('portal.organisation_id', true), '')::integer";
const direct = new Set([
  "staff", "children", "parent_accounts", "calendar_events", "dashboard_layouts", "dashboard_layout_drafts",
  "guardian_financial_accounts", "guardian_communication_logs", "guardian_payment_plans", "guardian_login_logs",
  "password_reset_tokens", "notices", "email_settings",
]);
const related = {
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
  claimed_excursion_id: "excursions", guardian_id: "parent_accounts", notification_id: "behavioural_notifications",
};
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows: organisations } = await client.query("SELECT id,name,organisation_id FROM organisation");
  const legacy = organisations.filter((org) => org.name.trim().toLowerCase() === "elysium oshc");
  if (legacy.length !== 1) throw new Error("The existing Elysium OSHC company must be identified explicitly");
  const legacyId = legacy[0].id;
  const { rows: unownedSites } = await client.query("SELECT 1 FROM sites WHERE org_id IS NULL LIMIT 1");
  if (unownedSites.length) {
    if (organisations.length !== 1) throw new Error("Unassigned service ownership requires an explicit backfill");
    await client.query("UPDATE sites SET org_id=$1 WHERE org_id IS NULL", [legacyId]);
  }
  await client.query("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS account_id integer");
  await client.query("ALTER TABLE super_admin_orgs ADD COLUMN IF NOT EXISTS portal_org_id integer REFERENCES organisation(id) ON DELETE RESTRICT");
  await client.query("UPDATE super_admin_orgs SET portal_org_id=$1 WHERE portal_org_id IS NULL AND lower(trim(name))='elysium oshc'", [legacyId]);
  const { rows: [registryType] } = await client.query("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='super_admin_orgs' AND column_name='portal_org_id'");
  if (registryType.data_type !== "integer") {
    const { rows: registry } = await client.query("SELECT id,portal_org_id FROM super_admin_orgs WHERE portal_org_id IS NOT NULL");
    for (const row of registry) {
      const value = String(row.portal_org_id).trim().toLowerCase();
      const matches = organisations.filter((org) => String(org.id) === value || org.organisation_id?.trim().toLowerCase() === value);
      if (matches.length !== 1) throw new Error("Control-plane company mapping requires explicit review");
      await client.query("UPDATE super_admin_orgs SET portal_org_id=$1 WHERE id=$2", [String(matches[0].id), row.id]);
    }
    await client.query("ALTER TABLE super_admin_orgs ALTER COLUMN portal_org_id TYPE integer USING portal_org_id::integer");
  }
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='super_admin_orgs'::regclass AND contype='f' AND confrelid='organisation'::regclass)
    THEN ALTER TABLE super_admin_orgs ADD CONSTRAINT super_admin_orgs_portal_org_id_fkey FOREIGN KEY(portal_org_id) REFERENCES organisation(id) ON DELETE RESTRICT;
    END IF; END $$`);
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS organisation_public_code_ci_unique ON organisation(lower(organisation_id))");
  await client.query(`CREATE TABLE IF NOT EXISTS tenant_files (
    object_path text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
    organisation_id integer REFERENCES organisation(id) ON DELETE RESTRICT DEFAULT ${setting})`);
  await client.query(`CREATE TABLE IF NOT EXISTS tenant_integrations (
    provider text NOT NULL, secret_name text NOT NULL,
    organisation_id integer REFERENCES organisation(id) ON DELETE RESTRICT DEFAULT ${setting})`);
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_org_provider_unique ON tenant_integrations(organisation_id,provider)");
  await client.query("ALTER TABLE tenant_integrations ADD COLUMN IF NOT EXISTS resource_id text");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_provider_secret_unique ON tenant_integrations(provider,secret_name)");
  const { rows: tableRows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('session','super_admin_orgs') ORDER BY tablename",
  );
  const tables = tableRows.map((row) => row.tablename);
  for (const table of tables) {
    if (table === "organisation" || table === "sites") continue;
    const name = quote(table);
    await client.query(`ALTER TABLE ${name} ADD COLUMN IF NOT EXISTS organisation_id integer REFERENCES organisation(id) ON DELETE RESTRICT`);
    if (!direct.has(table)) {
      await client.query(`ALTER TABLE ${name} ALTER COLUMN organisation_id SET DEFAULT ${setting}`);
    }
    const { rows: unassigned } = await client.query(`SELECT 1 FROM ${name} WHERE organisation_id IS NULL LIMIT 1`);
    if (unassigned.length) {
      if (organisations.length !== 1) throw new Error(`Unassigned ownership in ${table}: automatic legacy assignment is not safe with multiple companies`);
      await client.query(`UPDATE ${name} SET organisation_id=$1 WHERE organisation_id IS NULL`, [legacyId]);
    }
  }
  // Backfill file provenance only from stored, already-owned records. No client
  // endpoint can claim an arbitrary pre-existing object path.
  const pathsIn = (value, result = new Set()) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/(?:\/api\/storage)?\/(?:objects|public-objects)\/[A-Za-z0-9_./-]+/g)) {
        const path = match[0].replace(/^\/api\/storage/, "");
        if (!path.split("/").some((part) => part === ".." || part === ".")) result.add(path);
      }
    } else if (Array.isArray(value)) value.forEach((item) => pathsIn(item, result));
    else if (value && typeof value === "object") Object.values(value).forEach((item) => pathsIn(item, result));
    return result;
  };
  for (const table of tables.filter((name) => !["tenant_files", "tenant_integrations"].includes(name))) {
    const ownerKey = table === "organisation" ? "id" : table === "sites" ? "org_id" : "organisation_id";
    const { rows } = await client.query(`SELECT to_jsonb(t) AS record FROM ${quote(table)} t WHERE ${quote(ownerKey)} IS NOT NULL`);
    for (const { record } of rows) for (const objectPath of pathsIn(record)) {
      const { rows: existing } = await client.query("SELECT organisation_id FROM tenant_files WHERE object_path=$1", [objectPath]);
      if (existing.length && existing[0].organisation_id !== record[ownerKey]) {
        throw new Error("A stored object is referenced by more than one company; provenance must be resolved before release");
      }
      await client.query("INSERT INTO tenant_files(object_path,organisation_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [objectPath, record[ownerKey]]);
    }
  }
  for (const [provider, secretName] of [["kidsoft", "KIDSOFT_SERVICE_KEY"], ["clickup", "CLICKUP_API_TOKEN"]]) {
    await client.query("INSERT INTO tenant_integrations(provider,secret_name,organisation_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [provider, secretName, legacyId]);
  }
  await client.query("UPDATE tenant_integrations SET resource_id='901612753466' WHERE provider='clickup' AND organisation_id=$1 AND resource_id IS NULL", [legacyId]);
  await client.query(`
    CREATE OR REPLACE FUNCTION portal_object_paths(value jsonb) RETURNS SETOF text
    LANGUAGE plpgsql IMMUTABLE AS $$
    DECLARE part jsonb;
    BEGIN
      IF jsonb_typeof(value)='object' THEN
        FOR part IN SELECT v FROM jsonb_each(value) AS x(k,v) LOOP RETURN QUERY SELECT portal_object_paths(part); END LOOP;
      ELSIF jsonb_typeof(value)='array' THEN
        FOR part IN SELECT v FROM jsonb_array_elements(value) AS x(v) LOOP RETURN QUERY SELECT portal_object_paths(part); END LOOP;
      ELSIF jsonb_typeof(value)='string' THEN
        RETURN QUERY SELECT regexp_replace(m[1], '^/api/storage', '') FROM regexp_matches(value#>>'{}', '((?:/api/storage)?/(?:objects|public-objects)/[A-Za-z0-9_./-]+)', 'g') AS x(m);
      END IF;
    END $$`);
  await client.query(`
    CREATE OR REPLACE FUNCTION portal_record_references_owned(p_table text, value jsonb) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_catalog AS $$
    DECLARE ref record; linked boolean; path text; account_table text;
      manual jsonb := '${JSON.stringify(related)}'::jsonb;
    BEGIN
      FOR ref IN
        SELECT a.attname AS column_name, ft.relname AS parent_table, fa.attname AS parent_column,
          format_type(fa.atttypid, fa.atttypmod) AS parent_type
        FROM pg_constraint c JOIN pg_class ft ON ft.oid=c.confrelid
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
        JOIN pg_attribute fa ON fa.attrelid=c.confrelid AND fa.attnum=c.confkey[1]
        WHERE c.contype='f' AND c.conrelid=to_regclass(format('public.%I',p_table)) AND array_length(c.conkey,1)=1
        UNION ALL
        SELECT x.key,x.val,'id','integer' FROM jsonb_each_text(manual) x(key,val)
        WHERE jsonb_typeof(value->x.key)='number'
          AND NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_attribute a
            ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
            WHERE c.contype='f' AND c.conrelid=to_regclass(format('public.%I',p_table)) AND a.attname=x.key)
      LOOP
        IF value->>ref.column_name IS NOT NULL THEN
          EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I=$1::%s)',
            ref.parent_table,ref.parent_column,ref.parent_type)
            INTO linked USING value->>ref.column_name;
          IF NOT linked THEN RETURN false; END IF;
        END IF;
      END LOOP;
      FOR ref IN
        SELECT c.column_name, r.parent_table FROM information_schema.columns c
        JOIN (VALUES ('child_ids','children'), ('outcome_ids','outcomes')) AS r(column_name,parent_table)
          ON r.column_name=c.column_name
        WHERE c.table_schema='public' AND c.table_name=p_table AND c.udt_name='_int4'
      LOOP
        FOR path IN SELECT jsonb_array_elements_text(value->ref.column_name) LOOP
          EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id=$1::integer)',ref.parent_table)
            INTO linked USING path;
          IF NOT linked THEN RETURN false; END IF;
        END LOOP;
      END LOOP;
      IF p_table='password_reset_tokens' AND value->>'account_id' IS NOT NULL THEN
        account_table := CASE value->>'user_type' WHEN 'staff' THEN 'staff' WHEN 'guardian' THEN 'parent_accounts' WHEN 'school' THEN 'school_accounts' ELSE NULL END;
        IF account_table IS NULL THEN RETURN false; END IF;
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id=$1::integer)', account_table)
          INTO linked USING value->>'account_id';
        IF NOT linked THEN RETURN false; END IF;
      END IF;
      IF p_table NOT IN ('tenant_files','tenant_integrations') THEN
        FOR path IN SELECT portal_object_paths(value) LOOP
          IF NOT EXISTS (SELECT 1 FROM tenant_files f WHERE f.object_path=path) THEN RETURN false; END IF;
        END LOOP;
      END IF;
      RETURN true;
    END $$`);
  // Replace only the known global identity/reference constraints; never truncate.
  for (const [table, old, columns, index] of [
    ["staff", "staff_email_unique", "organisation_id,email", "staff_org_email_unique"],
    ["parent_accounts", "parent_accounts_guardian_email_unique", "organisation_id,guardian_email", "parent_accounts_org_email_unique"],
    ["guardian_financial_accounts", "guardian_financial_accounts_guardian_email_unique", "organisation_id,guardian_email", "guardian_financial_accounts_org_email_unique"],
    ["school_accounts", "school_accounts_username_unique", "organisation_id,username", "school_accounts_org_username_unique"],
    ["access_settings", "access_settings_role_unique", "organisation_id,role", "access_settings_org_role_unique"],
    ["outcomes", "outcomes_number_unique", "organisation_id,number", "outcomes_org_number_unique"],
    ["nqs_areas", "nqs_areas_number_unique", "organisation_id,number", "nqs_areas_org_number_unique"],
    ["nqs_elements", "nqs_elements_code_unique", "organisation_id,code", "nqs_elements_org_code_unique"],
    ["kidsoft_service_mappings", "kidsoft_service_mappings_service_id_key", "organisation_id,service_id", "kidsoft_service_mappings_org_service_unique"],
    ["email_send_log", "email_send_log_dedupe_key_unique", "organisation_id,dedupe_key", "email_send_log_org_dedupe_unique"],
  ]) {
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${quote(index)} ON ${quote(table)}(${columns})`);
    await client.query(`ALTER TABLE ${quote(table)} DROP CONSTRAINT IF EXISTS ${quote(old)}`);
    await client.query(`DROP INDEX IF EXISTS ${quote(old)}`);
    const legacyKey = old.replace(/_unique$/, "_key");
    if (legacyKey !== old) {
      await client.query(`ALTER TABLE ${quote(table)} DROP CONSTRAINT IF EXISTS ${quote(legacyKey)}`);
      await client.query(`DROP INDEX IF EXISTS ${quote(legacyKey)}`);
    }
  }
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS notification_settings_org_default_unique ON notification_settings(organisation_id,type) WHERE site_id IS NULL");
  await client.query("ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_type_key");
  await client.query("ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS uq_notification_settings_type_site");
  await client.query("ALTER TABLE notification_settings ADD CONSTRAINT uq_notification_settings_type_site UNIQUE(organisation_id,type,site_id)");
  await client.query("DROP INDEX IF EXISTS guardian_notifications_dedupe_idx");
  await client.query("CREATE UNIQUE INDEX guardian_notifications_dedupe_idx ON guardian_notifications(organisation_id,dedupe_key)");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS sites_organisation_identifier_unique ON sites(org_id,identifier)");
  await client.query("DROP INDEX IF EXISTS sites_identifier_unique");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS staff_support_email_unique ON staff(email) WHERE is_super_admin = true");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS email_settings_organisation_unique ON email_settings(organisation_id)");
  await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT; END IF; END $$`);
  const { rows: roles } = await client.query("SELECT rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname=$1", [role]);
  if (roles[0]?.rolsuper || roles[0]?.rolbypassrls || roles[0]?.rolcanlogin) throw new Error("The tenant database role must not be privileged or permit login");
  const { rows: users } = await client.query("SELECT current_user AS name");
  await client.query(`GRANT ${role} TO ${quote(users[0].name)}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  for (const table of tables) {
    const name = quote(table);
    const owner = table === "organisation" ? "id" : table === "sites" ? "org_id" : "organisation_id";
    const predicate = `${name}.${quote(owner)} = ${setting}`;
    const { rows: columns } = await client.query(
      "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table],
    );
    await client.query(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`);
    await client.query(`DROP POLICY IF EXISTS portal_company_boundary ON ${name}`);
    await client.query(`CREATE POLICY portal_company_boundary ON ${name} TO ${role} USING (${predicate}) WITH CHECK (${predicate} AND portal_record_references_owned('${table}',to_jsonb(${name}.*)))`);
    await client.query(`REVOKE ALL ON ${name} FROM ${role}`);
    const privileges = table === "organisation" ? "SELECT,UPDATE" : table === "tenant_integrations" ? "SELECT"
      : table === "tenant_files" ? "SELECT,INSERT,DELETE" : "SELECT,INSERT,UPDATE,DELETE";
    await client.query(`GRANT ${privileges} ON ${name} TO ${role}`);
    if (columns.some((column) => column.column_name === "id")) {
      const { rows: sequences } = await client.query("SELECT pg_get_serial_sequence($1,'id') AS name", [table]);
      if (sequences[0]?.name) await client.query(`GRANT USAGE ON SEQUENCE ${sequences[0].name} TO ${role}`);
    }
  }
  await client.query("COMMIT");
  console.log(`Development ownership and restricted-role policies installed for ${tables.length} tables. Production remains blocked.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
