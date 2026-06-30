import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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
  const staff = await db.select().from(staffTable).orderBy(staffTable.lastName);
  res.json(ListStaffResponse.parse(staff));
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [member] = await db.insert(staffTable).values(parsed.data).returning();
  res.status(201).json(GetStaffResponse.parse(member));
});

router.get("/staff/:id", async (req, res): Promise<void> => {
  const params = GetStaffParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [member] = await db.select().from(staffTable).where(eq(staffTable.id, params.data.id));
  if (!member) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json(GetStaffResponse.parse(member));
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
  const [deleted] = await db
    .delete(staffTable)
    .where(eq(staffTable.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.status(204).end();
});

export default router;
