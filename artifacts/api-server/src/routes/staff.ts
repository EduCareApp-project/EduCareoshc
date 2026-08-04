import { Router, type IRouter } from "express";
import { eq, ne } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
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

const router: IRouter = Router();

router.get("/staff", async (req, res): Promise<void> => {
  try {
    const staff = await db
      .select()
      .from(staffTable)
      .where(ne(staffTable.isSuperAdmin, true))
      .orderBy(staffTable.lastName);
    res.json(ListStaffResponse.parse(staff));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch staff");
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [member] = await db.insert(staffTable).values(parsed.data).returning();
    res.status(201).json(GetStaffResponse.parse(member));
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
    const [member] = await db.select().from(staffTable).where(eq(staffTable.id, params.data.id));
    if (!member) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    res.json(GetStaffResponse.parse(member));
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
    const [existing] = await db.select().from(staffTable).where(eq(staffTable.id, params.data.id));
    if (existing?.isSuperAdmin) {
      res.status(403).json({ error: "This account cannot be modified." });
      return;
    }
    const user = req.session?.user;
    const updateData = { ...parsed.data };
    if (isEducatorRole(user?.role)) {
      delete (updateData as any).siteId;
    }
    const [member] = await db
      .update(staffTable)
      .set(updateData)
      .where(eq(staffTable.id, params.data.id))
      .returning();
    if (!member) {
      res.status(404).json({ error: "Staff member not found" });
      return;
    }
    res.json(UpdateStaffResponse.parse(member));
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to update staff member");
    res.status(500).json({ error: "Failed to update staff member" });
  }
});

router.patch("/staff/:id/archive", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (isEducatorRole(user?.role)) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const params = GetStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [existing] = await db.select().from(staffTable).where(eq(staffTable.id, params.data.id));
    if (existing?.isSuperAdmin) {
      res.status(403).json({ error: "This account cannot be modified." });
      return;
    }
    const [member] = await db
      .update(staffTable)
      .set({ status: "inactive", blockedAt: new Date() } as any)
      .where(eq(staffTable.id, params.data.id))
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
  if (isEducatorRole(user?.role)) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const params = GetStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [existing] = await db.select().from(staffTable).where(eq(staffTable.id, params.data.id));
    if (existing?.isSuperAdmin) {
      res.status(403).json({ error: "This account cannot be modified." });
      return;
    }
    const [deleted] = await db
      .delete(staffTable)
      .where(eq(staffTable.id, params.data.id))
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
