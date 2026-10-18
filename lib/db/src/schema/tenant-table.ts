import { sql } from "drizzle-orm";
import { integer, type PgColumnBuilderBase, type PgTableExtraConfigValue } from "drizzle-orm/pg-core";
import { organisationTable } from "./organisation";
import { scopedTable } from "./scoped-table";

/** Nullable for migration staging; the runtime policy requires a matching owner. */
export function tenantTable<Name extends string, Columns extends Record<string, PgColumnBuilderBase>>(
  name: Name,
  columns: Columns,
  extra?: (table: any) => PgTableExtraConfigValue[] | Record<string, PgTableExtraConfigValue>,
) {
  return scopedTable(name, {
    ...columns,
    organisationId: integer("organisation_id")
      .references(() => organisationTable.id, { onDelete: "restrict" })
      .default(sql`nullif(current_setting('portal.organisation_id', true), '')::integer`),
  }, extra ? (table) => Object.values(extra(table)) : undefined);
}
