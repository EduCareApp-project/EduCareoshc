import { Readable } from "stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, organisationTable, schoolAccountsTable, schoolVitalRecordsTable, sitesTable, staffSitesTable, staffTable, staffQualificationsTable, vecraVisitsTable } from "@workspace/db";
import { ensureSchoolAccount } from "../lib/schoolAccounts";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const ADMIN_ROLES = new Set(["director", "admin", "admin_support", "coordinator", "educational_leader"]);
const objectStorageService = new ObjectStorageService();
const DEFAULT_SCHOOL_PORTAL_TABS = ["vital", "vecra", "staff", "reports", "qip"] as const;

function schoolPortalStaffRank(
  member: { role: string; siteId: number | null },
  siteId: number,
): number {
  const isHomeSite = member.siteId === siteId;
  if (isHomeSite && member.role === "coordinator") return 1;
  if (isHomeSite && member.role === "educator") return 2;
  if (!isHomeSite && member.role === "educator") return 3;
  if (member.role === "educational_leader") return 4;
  if (member.role === "admin") return 5;
  return 6;
}

async function isStaffAssignedToSite(staffId: number, siteId: number): Promise<boolean> {
  const [member] = await db.select({ siteId: staffTable.siteId }).from(staffTable).where(and(
    eq(staffTable.id, staffId),
    eq(staffTable.status, "active"),
    eq(staffTable.isSuperAdmin, false),
    ne(staffTable.role, "admin_support"),
  )).limit(1);
  if (!member) return false;
  if (member.siteId === siteId) return true;
  const [association] = await db.select({ staffId: staffSitesTable.staffId }).from(staffSitesTable).where(and(
    eq(staffSitesTable.staffId, staffId),
    eq(staffSitesTable.siteId, siteId),
  )).limit(1);
  return !!association;
}

async function streamObject(
  path: string,
  res: Response,
  filename?: string,
): Promise<void> {
  const objectFile = await objectStorageService.getObjectEntityFile(path);
  const response = await objectStorageService.downloadObject(objectFile);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (filename) {
    res.setHeader("Content-Disposition", `inline; filename="${filename.replace(/["\r\n]/g, "")}"`);
  }
  if (response.body) {
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
  } else {
    res.end();
  }
}

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

async function portalForSite(siteId: number, schoolView = false) {
  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId)).limit(1);
  if (!site) return null;
  const associatedStaffRows = await db.select({ staffId: staffSitesTable.staffId }).from(staffSitesTable)
    .where(eq(staffSitesTable.siteId, siteId));
  const associatedStaffIds = associatedStaffRows.map((row) => row.staffId);
  const schoolStaffFilter = associatedStaffIds.length > 0
    ? or(eq(staffTable.siteId, siteId), inArray(staffTable.id, associatedStaffIds))
    : eq(staffTable.siteId, siteId);
  const [staff, vitalRecords, vecraVisits, account, organisation] = await Promise.all([
    db.select({
      id: staffTable.id, firstName: staffTable.firstName, lastName: staffTable.lastName,
      role: staffTable.role, qualifications: staffTable.qualifications, status: staffTable.status, siteId: staffTable.siteId,
    }).from(staffTable).where(and(
      schoolStaffFilter,
      eq(staffTable.status, "active"),
      eq(staffTable.isSuperAdmin, false),
      ne(staffTable.role, "admin_support"),
    ))
      .orderBy(asc(staffTable.lastName), asc(staffTable.firstName)),
    db.select().from(schoolVitalRecordsTable).where(eq(schoolVitalRecordsTable.siteId, siteId))
      .orderBy(asc(schoolVitalRecordsTable.expiryDate), asc(schoolVitalRecordsTable.recordName)),
    db.select().from(vecraVisitsTable).where(eq(vecraVisitsTable.siteId, siteId))
      .orderBy(asc(vecraVisitsTable.visitDate)),
    db.select({ username: schoolAccountsTable.username, blockedAt: schoolAccountsTable.blockedAt, lastLoginAt: schoolAccountsTable.lastLoginAt })
      .from(schoolAccountsTable).where(eq(schoolAccountsTable.siteId, siteId)).limit(1),
    db.select({ featureSettings: organisationTable.featureSettings }).from(organisationTable).limit(1),
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
  const staffWithAssociations = staff
    .filter((member) => member.role !== "admin_support")
    .map((member) => ({
      ...member,
      associatedSites: (associatedSitesByStaff.get(member.id) ?? []).filter((associatedSite) => associatedSite.id !== member.siteId),
    }))
    .sort((left, right) => {
      const rankDifference = schoolPortalStaffRank(left, siteId) - schoolPortalStaffRank(right, siteId);
      if (rankDifference !== 0) return rankDifference;
      const lastNameDifference = left.lastName.localeCompare(right.lastName);
      return lastNameDifference !== 0
        ? lastNameDifference
        : left.firstName.localeCompare(right.firstName);
    });
  const featureSettings = organisation[0]?.featureSettings ?? {};
  const visibleTabs = featureSettings.schoolPortalVisibleTabs ?? [...DEFAULT_SCHOOL_PORTAL_TABS];
  return {
    site,
    account: account[0] ?? null,
    staff: schoolView && !visibleTabs.includes("staff") ? [] : staffWithAssociations,
    vitalRecords: schoolView && !visibleTabs.includes("vital") ? [] : vitalRecords,
    vecraVisits: schoolView && !visibleTabs.includes("vecra") ? [] : vecraVisits,
    portalSettings: {
      visibleTabs,
      visibleQualificationNames:
        featureSettings.schoolPortalVisibleQualificationNames
        ?? featureSettings.staffQualificationNames
        ?? [],
    },
  };
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

router.get("/schools/:siteId/staff/:staffId", async (req, res): Promise<void> => {
  const siteId = Number(req.params.siteId);
  const requestedStaffId = Number(req.params.staffId);
  const user = req.session.user;
  if (!Number.isInteger(siteId) || !Number.isInteger(requestedStaffId)) {
    res.status(400).json({ error: "Invalid school or staff id" });
    return;
  }
  if (user?.type === "school") {
    if (user.siteId !== siteId) { res.status(403).json({ error: "This school is outside your access" }); return; }
  } else if (adminStaff(req, res) == null) {
    return;
  }

  try {
    const [staffMember] = await db.select({
      id: staffTable.id,
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      email: staffTable.email,
      phone: staffTable.phone,
      role: staffTable.role,
      qualifications: staffTable.qualifications,
      bio: staffTable.bio,
      profilePicturePath: staffTable.profilePicturePath,
      status: staffTable.status,
      siteId: staffTable.siteId,
    }).from(staffTable).where(and(
      eq(staffTable.id, requestedStaffId),
      eq(staffTable.status, "active"),
      eq(staffTable.isSuperAdmin, false),
    )).limit(1);

    if (!staffMember) {
      res.status(404).json({ error: "Staff member not found for this site" });
      return;
    }

    if (staffMember.siteId !== siteId) {
      const [association] = await db.select({ staffId: staffSitesTable.staffId })
        .from(staffSitesTable)
        .where(and(
          eq(staffSitesTable.staffId, requestedStaffId),
          eq(staffSitesTable.siteId, siteId),
        ))
        .limit(1);
      if (!association) {
        res.status(404).json({ error: "Staff member not found for this site" });
        return;
      }
    }

    const [organisation] = user?.type === "school"
      ? await db.select({ featureSettings: organisationTable.featureSettings }).from(organisationTable).limit(1)
      : [];
    const visibleTabs = organisation?.featureSettings?.schoolPortalVisibleTabs ?? [...DEFAULT_SCHOOL_PORTAL_TABS];
    if (user?.type === "school" && !visibleTabs.includes("staff")) {
      res.status(404).json({ error: "Staff records are not available in this school portal" });
      return;
    }
    const visibleQualificationNames = organisation?.featureSettings?.schoolPortalVisibleQualificationNames
      ?? organisation?.featureSettings?.staffQualificationNames
      ?? [];
    const qualificationVisibilityFilter = user?.type === "school"
      ? visibleQualificationNames.length > 0
        ? inArray(staffQualificationsTable.name, visibleQualificationNames)
        : null
      : undefined;
    const qualifications = qualificationVisibilityFilter === null ? [] : await db.select({
      id: staffQualificationsTable.id,
      name: staffQualificationsTable.name,
      status: staffQualificationsTable.status,
      referenceNumber: staffQualificationsTable.referenceNumber,
      expiryDate: staffQualificationsTable.expiryDate,
      documentPath: staffQualificationsTable.documentPath,
    }).from(staffQualificationsTable).where(and(
      eq(staffQualificationsTable.staffId, requestedStaffId),
      isNull(staffQualificationsTable.archivedAt),
      qualificationVisibilityFilter,
    )).orderBy(asc(staffQualificationsTable.createdAt));

    res.json({
      staff: {
        ...staffMember,
        hasProfilePicture: !!staffMember.profilePicturePath,
        profilePicturePath: null,
      },
      qualifications: qualifications.map((qualification) => ({
        ...qualification,
        hasDocument: !!qualification.documentPath,
        documentPath: undefined,
      })),
    });
  } catch (err) {
    req.log.error({ err, siteId, staffId: requestedStaffId }, "Failed to load school staff profile");
    res.status(500).json({ error: "Failed to load staff profile" });
  }
});

router.get("/schools/:siteId/staff/:staffId/photo", async (req, res): Promise<void> => {
  const siteId = Number(req.params.siteId);
  const requestedStaffId = Number(req.params.staffId);
  const user = req.session.user;
  if (!Number.isInteger(siteId) || !Number.isInteger(requestedStaffId)) {
    res.status(400).json({ error: "Invalid school or staff id" });
    return;
  }
  if (user?.type === "school") {
    if (user.siteId !== siteId) { res.status(403).json({ error: "This school is outside your access" }); return; }
  } else if (adminStaff(req, res) == null) {
    return;
  }
  try {
    if (!(await isStaffAssignedToSite(requestedStaffId, siteId))) {
      res.status(404).json({ error: "Staff member not found for this site" });
      return;
    }
    if (user?.type === "school") {
      const [organisation] = await db.select({ featureSettings: organisationTable.featureSettings })
        .from(organisationTable).limit(1);
      const visibleTabs = organisation?.featureSettings?.schoolPortalVisibleTabs ?? [...DEFAULT_SCHOOL_PORTAL_TABS];
      if (!visibleTabs.includes("staff")) {
        res.status(404).json({ error: "Profile picture not found" });
        return;
      }
    }
    const [member] = await db.select({ profilePicturePath: staffTable.profilePicturePath }).from(staffTable)
      .where(eq(staffTable.id, requestedStaffId)).limit(1);
    if (!member?.profilePicturePath) {
      res.status(404).json({ error: "Profile picture not found" });
      return;
    }
    await streamObject(member.profilePicturePath, res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Profile picture not found" });
      return;
    }
    req.log.error({ err, siteId, staffId: requestedStaffId }, "Failed to load school staff profile picture");
    res.status(500).json({ error: "Failed to load profile picture" });
  }
});

router.get("/schools/:siteId/staff/:staffId/qualifications/:qualificationId/document", async (req, res): Promise<void> => {
  const siteId = Number(req.params.siteId);
  const requestedStaffId = Number(req.params.staffId);
  const qualificationId = Number(req.params.qualificationId);
  const user = req.session.user;
  if (![siteId, requestedStaffId, qualificationId].every(Number.isInteger)) {
    res.status(400).json({ error: "Invalid school, staff or qualification id" });
    return;
  }
  if (user?.type === "school") {
    if (user.siteId !== siteId) { res.status(403).json({ error: "This school is outside your access" }); return; }
  } else if (adminStaff(req, res) == null) {
    return;
  }
  try {
    if (!(await isStaffAssignedToSite(requestedStaffId, siteId))) {
      res.status(404).json({ error: "Staff member not found for this site" });
      return;
    }
    const [qualification] = await db.select({
      name: staffQualificationsTable.name,
      documentPath: staffQualificationsTable.documentPath,
    }).from(staffQualificationsTable).where(and(
      eq(staffQualificationsTable.id, qualificationId),
      eq(staffQualificationsTable.staffId, requestedStaffId),
      isNull(staffQualificationsTable.archivedAt),
    )).limit(1);
    if (!qualification?.documentPath) {
      res.status(404).json({ error: "Qualification document not found" });
      return;
    }
    if (user?.type === "school") {
      const [organisation] = await db.select({ featureSettings: organisationTable.featureSettings })
        .from(organisationTable).limit(1);
      const visibleNames = organisation?.featureSettings?.schoolPortalVisibleQualificationNames
        ?? organisation?.featureSettings?.staffQualificationNames
        ?? [];
      const visibleTabs = organisation?.featureSettings?.schoolPortalVisibleTabs ?? [...DEFAULT_SCHOOL_PORTAL_TABS];
      if (!visibleTabs.includes("staff") || !visibleNames.includes(qualification.name)) {
        res.status(404).json({ error: "Qualification document not found" });
        return;
      }
    }
    await streamObject(qualification.documentPath, res, `${qualification.name}.pdf`);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Qualification document not found" });
      return;
    }
    req.log.error(
      { err, siteId, staffId: requestedStaffId, qualificationId },
      "Failed to load school qualification document",
    );
    res.status(500).json({ error: "Failed to load qualification document" });
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
    const portal = await portalForSite(siteId, user?.type === "school");
    if (!portal) { res.status(404).json({ error: "School not found" }); return; }
    res.json(portal);
  } catch (err) {
    req.log.error({ err, siteId }, "Failed to load school portal");
    res.status(500).json({ error: "Failed to load school portal" });
  }
});

router.get("/schools/:siteId/vital-records/:id/document", async (req, res): Promise<void> => {
  const siteId = Number(req.params.siteId);
  const recordId = Number(req.params.id);
  const user = req.session.user;
  if (!Number.isInteger(siteId) || !Number.isInteger(recordId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  if (user?.type === "school") {
    if (user.siteId !== siteId) {
      res.status(403).json({ error: "This school is outside your access" });
      return;
    }
  } else if (adminStaff(req, res) == null) {
    return;
  }

  try {
    const [record] = await db
      .select({ documentPath: schoolVitalRecordsTable.documentPath, documentName: schoolVitalRecordsTable.documentName })
      .from(schoolVitalRecordsTable)
      .where(and(eq(schoolVitalRecordsTable.id, recordId), eq(schoolVitalRecordsTable.siteId, siteId)))
      .limit(1);
    if (!record) {
      res.status(404).json({ error: "Vital record not found" });
      return;
    }
    if (!record.documentPath) {
      res.status(404).json({ error: "This record has no document" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(record.documentPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (record.documentName) {
      res.setHeader("Content-Disposition", `inline; filename="${record.documentName.replace(/["\r\n]/g, "")}"`);
    }
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    req.log.error({ err, siteId, recordId }, "Failed to serve vital record document");
    res.status(500).json({ error: "Failed to serve document" });
  }
});

router.post("/schools/:siteId/vital-records", async (req, res): Promise<void> => {
  const creator = adminStaff(req, res);
  if (creator == null) return;
  const siteId = Number(req.params.siteId);
  const { recordType, recordName, provider, referenceNumber, expiryDate, notes, documentPath, documentName } = req.body ?? {};
  if (!Number.isInteger(siteId) || !recordType || !recordName) {
    res.status(400).json({ error: "Record type and name are required" }); return;
  }
  if (!documentPath || !documentName) {
    res.status(400).json({ error: "A supporting document is required" }); return;
  }
  const normalizedDocumentPath = objectStorageService.normalizeObjectEntityPath(String(documentPath));
  if (!normalizedDocumentPath.startsWith("/objects/")) {
    res.status(400).json({ error: "The supporting document is invalid" }); return;
  }
  try {
    const [record] = await db.insert(schoolVitalRecordsTable).values({
      siteId, recordType: String(recordType), recordName: String(recordName),
      provider: provider ? String(provider) : null, referenceNumber: referenceNumber ? String(referenceNumber) : null,
      expiryDate: expiryDate ? String(expiryDate) : null, notes: notes ? String(notes) : null,
      documentPath: normalizedDocumentPath, documentName: String(documentName),
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
  const [record] = await db
    .select({ documentPath: schoolVitalRecordsTable.documentPath })
    .from(schoolVitalRecordsTable)
    .where(and(eq(schoolVitalRecordsTable.id, id), eq(schoolVitalRecordsTable.siteId, siteId)))
    .limit(1);
  await db.delete(schoolVitalRecordsTable).where(and(eq(schoolVitalRecordsTable.id, id), eq(schoolVitalRecordsTable.siteId, siteId)));
  if (record?.documentPath) {
    try {
      await objectStorageService.deleteObjectEntity(record.documentPath);
    } catch (err) {
      if (!(err instanceof ObjectNotFoundError)) {
        req.log.warn({ err, siteId, recordId: id }, "Failed to delete vital record document");
      }
    }
  }
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