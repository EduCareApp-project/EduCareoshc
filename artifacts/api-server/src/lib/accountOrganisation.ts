import { and, eq, sql } from "drizzle-orm";
import { systemDb as db, organisationTable, staffTable, parentAccountsTable, schoolAccountsTable, sitesTable } from "@workspace/db";

/**
 * Preserve email-only sign-in for existing, unambiguous accounts. Never pick
 * the first company or use the password to guess which company was intended.
 * Organisation codes are public routing information, not authorization.
 */
export async function resolveAccountOrganisation(identity: string, code?: string): Promise<number | null> {
  let selected: number | undefined;
  if (code) {
    const matches = await db.select({ id: organisationTable.id }).from(organisationTable)
      .where(eq(sql`lower(${organisationTable.organisationId})`, code.trim().toLowerCase())).limit(2);
    if (matches.length !== 1) return null;
    selected = matches[0].id;
  }
  const [staff, guardians, schools] = await Promise.all([
    db.select({ id: staffTable.organisationId }).from(staffTable).where(and(
      eq(staffTable.email, identity), selected === undefined ? undefined : eq(staffTable.organisationId, selected),
    )),
    db.select({ id: parentAccountsTable.organisationId }).from(parentAccountsTable).where(and(
      eq(parentAccountsTable.guardianEmail, identity),
      selected === undefined ? undefined : eq(parentAccountsTable.organisationId, selected),
    )),
    db.select({ id: sitesTable.orgId }).from(schoolAccountsTable)
      .innerJoin(sitesTable, eq(schoolAccountsTable.siteId, sitesTable.id)).where(and(
        eq(schoolAccountsTable.username, identity), selected === undefined ? undefined : eq(sitesTable.orgId, selected),
      )),
  ]);
  const ids = new Set([...staff, ...guardians, ...schools]
    .map((account) => account.id).filter((id): id is number => id !== null && Number.isSafeInteger(id) && id > 0));
  return ids.size === 1 ? [...ids][0] : null;
}

/** Include the public routing code in invitations without treating it as proof of membership. */
export async function organisationRoutingQuery(orgId: number): Promise<string> {
  const [org] = await db.select({ code: organisationTable.organisationId }).from(organisationTable)
    .where(eq(organisationTable.id, orgId)).limit(1);
  if (!org) throw new Error("Invitation organisation was not found");
  return org.code ? `organisationCode=${encodeURIComponent(org.code)}` : "";
}
