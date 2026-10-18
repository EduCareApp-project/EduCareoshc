import type { Response } from "express";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, childrenTable, sitesTable, staffTable } from "@workspace/db";

/** Never accept ownership from a body, query string, or cached session. */
export function organisationId(res: Response): number {
  const id: unknown = res.locals.organisationId;
  if (res.locals.organisationContextVerified !== true || !Number.isSafeInteger(id) || Number(id) <= 0) {
    throw new Error("Verified organisation context is required");
  }
  return id as number;
}

export function tenantChildIds(orgId: number) {
  return db.select({ id: childrenTable.id }).from(childrenTable)
    .where(eq(childrenTable.organisationId, orgId));
}

export function tenantStaffIds(orgId: number) {
  return db.select({ id: staffTable.id }).from(staffTable)
    .where(eq(staffTable.organisationId, orgId));
}

export function tenantSiteIds(orgId: number) {
  return db.select({ id: sitesTable.id }).from(sitesTable)
    .where(eq(sitesTable.orgId, orgId));
}

export function guardianChildren(orgId: number, email: string) {
  return and(eq(childrenTable.organisationId, orgId),
    or(eq(sql`lower(trim(${childrenTable.guardianEmail}))`, email.trim().toLowerCase()),
      eq(sql`lower(trim(${childrenTable.guardian2Email}))`, email.trim().toLowerCase())));
}

/** Validate *every* supplied relationship before doing any writes. */
export async function ownsSites(orgId: number, ids: Array<number | null | undefined>): Promise<boolean> {
  const values = [...new Set(ids.filter((id): id is number => id != null))];
  if (values.some((id) => !Number.isSafeInteger(id) || id <= 0)) return false;
  if (!values.length) return true;
  const rows = await db.select({ id: sitesTable.id }).from(sitesTable)
    .where(and(eq(sitesTable.orgId, orgId), inArray(sitesTable.id, values)));
  return rows.length === values.length;
}

export async function ownsChild(orgId: number, id: number): Promise<boolean> {
  const [child] = await db.select({ id: childrenTable.id }).from(childrenTable)
    .where(and(eq(childrenTable.id, id), eq(childrenTable.organisationId, orgId))).limit(1);
  return !!child;
}
