import { eq } from "drizzle-orm";
import { db, schoolAccountsTable } from "@workspace/db";

export function schoolUsername(name: string, siteId: number): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "school";
  return `${base}-${siteId}`;
}

export async function ensureSchoolAccount(siteId: number, siteName: string): Promise<void> {
  const [existing] = await db.select({ id: schoolAccountsTable.id }).from(schoolAccountsTable)
    .where(eq(schoolAccountsTable.siteId, siteId)).limit(1);
  if (!existing) {
    await db.insert(schoolAccountsTable).values({ siteId, username: schoolUsername(siteName, siteId) })
      .onConflictDoNothing();
  }
}