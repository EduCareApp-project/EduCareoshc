import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schoolAccountsTable, schoolVitalRecordsTable, sitesTable, staffSitesTable, staffTable, vecraVisitsTable } from "@workspace/db";
import { ensureSchoolAccount } from "../lib/schoolAccounts";

const router: IRouter = Router();
const ADMIN_ROLES = new Set(["director", "admin", "coordinator", "educational_leader"]);

function staffId(req: Request, res: Response): number | null {
  if (req.session.user?.type !== "staff") {
    res.status(403).json({ error: "Staff access required" });
    return null;
  }
  return req.session.user.id;
}

function adminStaff(req: Request, res: Response): number | null {
  const id = staffId(req, res);
  if (id != null && !ADMIN_ROLES.has(req.session.user?.role ?? "")) {
    res.status(403).json({ error: "Administrator access required" });
    return null;
  }
  return id;
}

async function portalForSite(siteId: number) {
  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId)).limit(1);
  if (!site) return null;
  const associatedStaffRows = await db.select({ staffId: staffSitesTable.staffId }).from(staffSitesTable)
    .where(eq(staffSitesTable.siteId, siteId));
  const associatedStaffIds = associatedStaffRows.map((row) => row.staffId);
  const schoolStaffFilter = associatedStaffIds.length > 0
    ? or(eq(staffTable.siteId, siteId), inArray(staffTable.id, associatedStaffIds))
    : eq(staffTable.siteId, siteId);
  const [staff, vitalRecords, vecraVisits, account] = await Promise.all([
    db.select({
      id: staffTable.id, firstName: staffTable.firstName, lastName: staffTable.lastName,
      role: staffTable.role, qualifications: staffTable.qualifications, status: staffTable.status, siteId: staffTable.siteId,
    }).from(staffTable).where(and(schoolStaffFilter, eq(staffTable.status, "active"), eq(staffTable.isSuperAdmin, false)))
      .orderBy(asc(staffTable.lastName), asc(staffTable.firstName)),
    db.select().from(schoolVitalRecordsTable).where(eq(schoolVitalRecordsTable.siteId, siteId))
      .orderBy(asc(schoolVitalRecordsTable.expiryDate), asc(schoolVitalRecordsTable.recordName)),
    db.select().from(vecraVisitsTable).where(eq(vecraVisitsTable.siteId, siteId))
      .orderBy(asc(vecraVisitsTable.visitDate)),
    db.select({ username: schoolAccountsTable.username, blockedAt: schoolAccountsTable.blockedAt, lastLoginAt: schoolAccountsTable.lastLoginAt })
      .from(schoolAccountsTable).where(eq(schoolAccountsTable.siteId, siteId)).limit(1),
  ]);
  const staffIds = staff.map((member) => member.id);
  const associationRows = staffIds.length > 0
    ? await db.select({ staffId: staffSitesTable.staffId, id: sitesTable.id, name: sitesTable.name })
      .from(staffSitesTable)
      .innerJoin(sitesTable, eq(staffSitesTable.siteId, sitesTable.id))
      .where(inArray(staffSitesTable.staffId, staffIds))
      .orderBy(asc(sitesTable.name))
    : [];
  const associatedSitesByStaff = new Map<number, { id: number; name: string }[]>();
  for (const association of associationRows) {
    const current = associatedSitesByStaff.get(association.staffId) ?? [];
    current.push({ id: association.id, name: association.name });
    associatedSitesByStaff.set(association.staffId, current);
  }
  const staffWithAssociations = staff.map((member) => ({
    ...member,
    associatedSites: (associatedSitesByStaff.get(member.id) ?? []).filter((associatedSite) => associatedSite.id !== member.siteId),
  }));
  return { site, account: account[0] ?? null, staff: staffWithAssociations, vitalRecords, vecraVisits };
}

router.get("/schools", async (req, res): Promise<void> => {
  if (adminStaff(req, res) == null) return;
  try {
    const sites = await db.select().from(sitesTable).orderBy(asc(sitesTable.name));
    await Promise.all(sites.map((site) => ensureSchoolAccount(site.id, site.name)));
    const rows = await db.select({
      id: schoolAccountsTable.id, siteId: sitesTable.id, siteName: sitesTable.name,
      username: schoolAccountsTable.username, blockedAt: schoolAccountsTable.blockedAt,
      lastLoginAt: schoolAccountsTable.lastLoginAt, passwordSet: schoolAccountsTable.passwordHash,
    }).from(schoolAccountsTable).innerJoin(sitesTable, eq(schoolAccountsTable.siteId, sitesTable.id))
      .orderBy(asc(sitesTable.name));
    res.json(rows.map((row) => ({ ...row, passwordSet: !!row.passwordSet })));
  } catch (err) {
    req.log.error({ err }, "Failed to list schools");
    res.status(500).json({ error: "Failed to list schools" });
  }
});

router.get("/schools/:siteId/portal", async (req, res): Promise<void> => {
  const siteId = Number(req.params.siteId);
  const user = req.session.user;
  if (!Number.isInteger(siteId)) { res.status(400).json({ error: "Invalid school id" }); return; }
  if (user?.type === "school") {
    if (user.siteId !== siteId) { res.status(403).json({ error: "This school is outside your access" }); return; }
  } else if (adminStaff(req, res) == null) {
    return;
  }
  try {
    const portal = await portalForSite(siteId);
    if (!portal) { res.status(404).json({ error: "School not found" }); return; }
    res.json(portal);
  } catch (err) {
    req.log.error({ err, siteId }, "Failed to load school portal");
    res.status(500).json({ error: "Failed to load school portal" });
  }
});

router.post("/schools/:siteId/vital-records", async (req, res): Promise<void> => {
  const creator = adminStaff(req, res);
  if (creator == null) return;
  const siteId = Number(req.params.siteId);
  const { recordType, recordName, provider, referenceNumber, expiryDate, notes } = req.body ?? {};
  if (!Number.isInteger(siteId) || !recordType || !recordName) {
    res.status(400).json({ error: "Record type and name are required" }); return;
  }
  try {
    const [record] = await db.insert(schoolVitalRecordsTable).values({
      siteId, recordType: String(recordType), recordName: String(recordName),
      provider: provider ? String(provider) : null, referenceNumber: referenceNumber ? String(referenceNumber) : null,
      expiryDate: expiryDate ? String(expiryDate) : null, notes: notes ? String(notes) : null,
    }).returning();
    res.status(201).json(record);
  } catch (err) {
    req.log.error({ err, siteId, creator }, "Failed to create school vital record");
    res.status(500).json({ error: "Failed to create vital record" });
  }
});

router.delete("/schools/:siteId/vital-records/:id", async (req, res): Promise<void> => {
  if (adminStaff(req, res) == null) return;
  const siteId = Number(req.params.siteId); const id = Number(req.params.id);
  if (!Number.isInteger(siteId) || !Number.isInteger(id)) { res.status(400).json({ error: "Invalid record id" }); return; }
  await db.delete(schoolVitalRecordsTable).where(and(eq(schoolVitalRecordsTable.id, id), eq(schoolVitalRecordsTable.siteId, siteId)));
  res.status(204).send();
});

router.post("/schools/:siteId/vecra-visits", async (req, res): Promise<void> => {
  const creator = adminStaff(req, res);
  if (creator == null) return;
  const siteId = Number(req.params.siteId);
  const { visitDate, visitorName, visitorOrganisation, findings, actions, followUpDate } = req.body ?? {};
  if (!Number.isInteger(siteId) || !visitDate || !visitorName) {
    res.status(400).json({ error: "Visit date and visitor name are required" }); return;
  }
  try {
    const [visit] = await db.insert(vecraVisitsTable).values({
      siteId, visitDate: String(visitDate), visitorName: String(visitorName),
      visitorOrganisation: visitorOrganisation ? String(visitorOrganisation) : null,
      findings: findings ? String(findings) : null, actions: actions ? String(actions) : null,
      followUpDate: followUpDate ? String(followUpDate) : null, createdBy: creator,
    }).returning();
    res.status(201).json(visit);
  } catch (err) {
    req.log.error({ err, siteId, creator }, "Failed to create VECRA visit");
    res.status(500).json({ error: "Failed to create VECRA visit" });
  }
});

router.delete("/schools/:siteId/vecra-visits/:id", async (req, res): Promise<void> => {
  if (adminStaff(req, res) == null) return;
  const siteId = Number(req.params.siteId); const id = Number(req.params.id);
  if (!Number.isInteger(siteId) || !Number.isInteger(id)) { res.status(400).json({ error: "Invalid visit id" }); return; }
  await db.delete(vecraVisitsTable).where(and(eq(vecraVisitsTable.id, id), eq(vecraVisitsTable.siteId, siteId)));
  res.status(204).send();
});

export default router;