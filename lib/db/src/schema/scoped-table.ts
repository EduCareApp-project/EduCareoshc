import { sql } from "drizzle-orm";
import { pgTable, pgPolicy, type PgColumnBuilderBase, type PgTableExtraConfigValue } from "drizzle-orm/pg-core";

/** Keep the boundary in the managed schema as well as the development setup.
 * Otherwise a subsequent schema push could disable a manually installed RLS policy. */
export function scopedTable<Name extends string, Columns extends Record<string, PgColumnBuilderBase>>(
  name: Name,
  columns: Columns,
  extra?: (table: any) => PgTableExtraConfigValue[] | Record<string, PgTableExtraConfigValue>,
) {
  const owner = name === "organisation" ? "id" : name === "sites" ? "org_id" : "organisation_id";
  const predicate = sql`${sql.identifier(name)}.${sql.identifier(owner)} = nullif(current_setting('portal.organisation_id', true), '')::integer`;
  return pgTable(name, columns, (table) => [
    ...(extra ? Object.values(extra(table)) : []),
    pgPolicy("portal_company_boundary", {
      to: "portal_tenant",
      using: predicate,
      withCheck: sql`${predicate} AND portal_record_references_owned(${sql.raw(`'${name}'`)}, to_jsonb(${sql.identifier(name)}.*))`,
    }),
  ]).enableRLS();
}
