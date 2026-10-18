import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { organisationTable } from "./organisation";

// Not a tenant table: only the separately authenticated support control plane
// may access this registry. portal_tenant receives no privileges on it.
// Tracking its serial sequence also prevents schema push from dropping it.
export const superAdminOrganisationsTable = pgTable("super_admin_orgs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain"),
  logoUrl: text("logo_url"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  portalOrgId: integer("portal_org_id").references(() => organisationTable.id, { onDelete: "restrict" }),
});
