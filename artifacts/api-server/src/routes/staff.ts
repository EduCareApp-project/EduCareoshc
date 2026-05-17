import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable, staffAppraisalsTable } from "@workspace/db";
import {
  CreateStaffBody,
  GetStaffParams,
  GetStaffResponse,
  UpdateStaffParams,
  UpdateStaffBody,
  UpdateStaffResponse,
  ListStaffResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/staff", async (_req, res): Promise<void> => {
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

  // Auto-create an initial appraisal for the new staff member (due in 12 months)
  const due = new Date();
  due.setFullYear(due.getFullYear() + 1);
  const dueDate = due.toISOString().split("T")[0];
  await db.insert(staffAppraisalsTable).values({
    staffId: member.id,
    type: "educator_appraisal",
    status: "stage1",
    dueDate: dueDate as any,
  } as any);

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
  const [member] = await db
    .update(staffTable)
    .set(parsed.data)
    .where(eq(staffTable.id, params.data.id))
    .returning();
  if (!member) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json(UpdateStaffResponse.parse(member));
});

router.delete("/staff/:id", async (req, res): Promise<void> => {
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
