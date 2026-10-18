import { Router, type IRouter } from "express";
import { and, eq, ne, asc, inArray } from "drizzle-orm";
import { organisationId, ownsSites } from "../lib/tenant";
import { db, sitesTable, staffSitesTable, staffTable } from "@workspace/db";
import {
  CreateStaffBody,
  GetStaffParams,
  GetStaffResponse,
  UpdateStaffParams,
  UpdateStaffBody,
  UpdateStaffResponse,
  ListStaffResponse,
} from "@workspace/api-zod";

const EDUCATOR_ROLES = ["educator", "coordinator"] as const;
type EducatorRole = (typeof EDUCATOR_ROLES)[number];

function isEducatorRole(role: string | undefined | null): role is EducatorRole {
  return EDUCATOR_ROLES.includes(role as EducatorRole);
}

function isOnboarding(role: string | undefined | null): boolean {
  return role === "onboarding";
}

function isProfileOnlyRole(role: string | undefined | null): boolean {
  return role === "admin_support" || role === "onboarding";
}

const router: IRouter = Router();

async function addAssociatedSites<T extends { id: number; siteId?: number | null }>(members: T[], orgId: number) {
  if (members.length === 0) return members.map((member) => ({ ...member, associatedSiteIds: [], associatedSites: [] }));
  const links = await db
    .select({ staffId: staffSitesTable.staffId, id: sitesTable.id, name: sitesTable.name })
    .from(staffSitesTable)
    .innerJoin(sitesTable, eq(staffSitesTable.siteId, sitesTable.id))
    .where(and(inArray(staffSitesTable.staffId, members.map((member) => member.id)), eq(sitesTable.orgId, orgId)))
    .orderBy(asc(sitesTable.name));
  const byStaff = new Map<number, { id: number; name: string }[]>();
  for (const link of links) {
    const current = byStaff.get(link.staffId) ?? [];
    current.push({ id: link.id, name: link.name });
    byStaff.set(link.staffId, current);
  }
  return members.map((member) => {
    const associatedSites = (byStaff.get(member.id) ?? []).filter((site) => site.id !== member.siteId);
    return { ...member, associatedSiteIds: associatedSites.map((site) => site.id), associatedSites };
  });
}

async function replaceAssociatedSites(staffId: number, siteIds: number[], orgId: number) {
  const uniqueSiteIds = [...new Set(siteIds.filter((siteId) => Number.isInteger(siteId) && siteId > 0))];
  if (uniqueSiteIds.length > 0) {
    const existingSites = await db.select({ id: sitesTable.id }).from(sitesTable).where(eq(sitesTable.orgId, orgId));
    const validIds = new Set(existingSites.map((site) => site.id));
    if (uniqueSiteIds.some((siteId) => !validIds.has(siteId))) {
      throw new Error("One or more associated sites do not exist");
    }
  }
  await db.delete(staffSitesTable).where(eq(staffSitesTable.staffId, staffId));
  if (uniqueSiteIds.length > 0) {
    await db.insert(staffSitesTable).values(uniqueSiteIds.map((siteId) => ({ staffId, siteId }))).onConflictDoNothing();
  }
}

router.get("/staff", async (req, res): Promise<void> => {
  try {
    const staff = await db
      .select()
      .from(staffTable)
      .where(and(ne(staffTable.isSuperAdmin, true), eq(staffTable.organisationId, organisationId(res))))
      .orderBy(staffTable.lastName);
    const visibleStaff = isOnboarding(req.session.user?.role)
      ? staff.filter((member) => member.id === req.session.user?.id)
      : isEducatorRole(req.session.user?.role)
      ? staff.filter((member) => member.role !== "admin_support")
      : staff;
    res.json(ListStaffResponse.parse(await addAssociatedSites(visibleStaff, organisationId(res))));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch staff");
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

router.post("/staff", async (req, res): Promise<void> => {
  if (isOnboarding(req.session.user?.role)) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const { associatedSiteIds, ...parsedStaffData } = parsed.data;
    const staffData = isProfileOnlyRole(parsedStaffData.role)
      ? { ...parsedStaffData, siteId: null }
      : parsedStaffData;
    if (!(await ownsSites(organisationId(res), [staffData.siteId, ...(isProfileOnlyRole(staffData.role) ? [] : associatedSiteIds ?? [])]))) {
      res.status(400).json({ error: "Invalid service" }); return;
    }
    const [member] = await db.insert(staffTable).values({
      ...staffData, email: staffData.email.trim().toLowerCase(), organisationId: organisationId(res),
    }).returning();
    if (isProfileOnlyRole(staffData.role)) {
      await replaceAssociatedSites(member.id, [], organisationId(res));
    } else if (associatedSiteIds !== undefined) {
      await replaceAssociatedSites(member.id, associatedSiteIds.filter((siteId) => siteId !== member.siteId), organisationId(res));
    }
    const [withSites] = await addAssociatedSites([member], organisationId(res));
    res.status(201).json(GetStaffResponse.parse(withSites));
  } catch (err) {
    req.log.error({ err }, "Failed to create staff member");
    res.status(500).json({ error: "Failed to create staff member" });
  }
});

router.get("/staff/:id", async (req, res): Promise<void> => {
  const params = GetStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [member] = await db.select().from(staffTable)
      .where(and(eq(staffTable.id, params.data.id), eq(staffTable.organisationId, organisationId(res))));
    if (!member) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    if (isOnboarding(req.session.user?.role) && member.id !== req.session.user?.id) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    if (isEducatorRole(req.session.user?.role) && member.role === "admin_support") {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    const [withSites] = await addAssociatedSites([member], organisationId(res));
    res.json(GetStaffResponse.parse(withSites));
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to fetch staff member");
    res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

router.patch("/staff/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [existing] = await db.select().from(staffTable)
      .where(and(eq(staffTable.id, params.data.id), eq(staffTable.organisationId, organisationId(res))));
    if (!existing) { res.status(404).json({ error: "Staff member not found" }); return; }
    if (existing?.isSuperAdmin) {
      res.status(403).json({ error: "This account cannot be modified." });
      return;
    }
    const user = req.session?.user;
    const { associatedSiteIds, ...staffFields } = parsed.data;
    const updateData = { ...staffFields };
    if (updateData.email !== undefined) updateData.email = updateData.email.trim().toLowerCase();
    const targetRole = staffFields.role ?? existing?.role;
    if (isOnboarding(user?.role)) {
      if (params.data.id !== user?.id) {
        res.status(403).json({ error: "Not permitted" });
        return;
      }
      const allowedFields = new Set(["firstName", "lastName", "email", "phone", "bio", "profilePicturePath"]);
      if (associatedSiteIds !== undefined || Object.keys(updateData).some((field) => !allowedFields.has(field))) {
        res.status(403).json({ error: "Onboarding staff can only edit their own personal details" });
        return;
      }
    } else if (isEducatorRole(user?.role)) {
      delete (updateData as any).siteId;
    } else if (isProfileOnlyRole(targetRole)) {
      updateData.siteId = null;
    }
    const canAssignSites = !isEducatorRole(user?.role) && !isOnboarding(user?.role) && !isProfileOnlyRole(targetRole);
    if (!(await ownsSites(organisationId(res), [updateData.siteId, ...(canAssignSites ? associatedSiteIds ?? [] : [])]))) {
      res.status(400).json({ error: "Invalid service" }); return;
    }
    const [member] = await db
      .update(staffTable)
      .set(updateData)
      .where(and(eq(staffTable.id, params.data.id), eq(staffTable.organisationId, organisationId(res))))
      .returning();
    if (!member) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    if (isProfileOnlyRole(targetRole)) {
      await replaceAssociatedSites(member.id, [], organisationId(res));
    } else if (associatedSiteIds !== undefined && !isEducatorRole(user?.role) && !isOnboarding(user?.role)) {
      await replaceAssociatedSites(member.id, associatedSiteIds.filter((siteId) => siteId !== member.siteId), organisationId(res));
    }
    const [withSites] = await addAssociatedSites([member], organisationId(res));
    res.json(UpdateStaffResponse.parse(withSites));
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to update staff member");
    res.status(500).json({ error: "Failed to update staff member" });
  }
});

router.patch("/staff/:id/archive", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (isEducatorRole(user?.role) || isOnboarding(user?.role)) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const params = GetStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [existing] = await db.select().from(staffTable)
      .where(and(eq(staffTable.id, params.data.id), eq(staffTable.organisationId, organisationId(res))));
    if (existing?.isSuperAdmin) {
      res.status(403).json({ error: "This account cannot be modified." });
      return;
    }
    const [member] = await db
      .update(staffTable)
      .set({ status: "inactive", blockedAt: new Date() } as any)
      .where(and(eq(staffTable.id, params.data.id), eq(staffTable.organisationId, organisationId(res))))
      .returning();
    if (!member) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    res.json(GetStaffResponse.parse(member));
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to archive staff member");
    res.status(500).json({ error: "Failed to archive staff member" });
  }
});

router.delete("/staff/:id", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (isEducatorRole(user?.role) || isOnboarding(user?.role)) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const params = GetStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [existing] = await db.select().from(staffTable)
      .where(and(eq(staffTable.id, params.data.id), eq(staffTable.organisationId, organisationId(res))));
    if (existing?.isSuperAdmin) {
      res.status(403).json({ error: "This account cannot be modified." });
      return;
    }
    const [deleted] = await db
      .delete(staffTable)
      .where(and(eq(staffTable.id, params.data.id), eq(staffTable.organisationId, organisationId(res))))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to delete staff member");
    res.status(500).json({ error: "Failed to delete staff member" });
  }
});

export default router;
