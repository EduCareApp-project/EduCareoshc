import { integer, pgTable, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { staffTable } from "./staff";

export const staffSitesTable = pgTable(
  "staff_sites",
  {
    id: serial("id").primaryKey(),
    staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
    siteId: integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  },
  (table) => ({
    staffSiteUnique: uniqueIndex("staff_sites_staff_id_site_id_unique").on(table.staffId, table.siteId),
  }),
);

export type StaffSite = typeof staffSitesTable.$inferSelect;