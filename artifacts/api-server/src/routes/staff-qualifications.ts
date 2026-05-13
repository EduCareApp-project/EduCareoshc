import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffQualificationsTable } from "@workspace/db";
import {
  GetStaffQualificationsParams,
  GetStaffQualificationsResponse,
  CreateStaffQualificationParams,
  CreateStaffQualificationBody,
  UpdateStaffQualificationParams,
  UpdateStaffQualificationBody,
  DeleteStaffQualificationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/staff/:id/qualifications", async (req, res): Promise<void> => {
  const params = GetStaffQualificationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(staffQualificationsTable)
    .where(eq(staffQualificationsTable.staffId, params.data.id))
    .orderBy(staffQualificationsTable.createdAt);
  res.json(GetStaffQualificationsResponse.parse(rows));
});

router.post("/staff/:id/qualifications", async (req, res): Promise<void> => {
  const params = CreateStaffQualificationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateStaffQualificationBody.safeParse({ ...req.body, staffId: params.data.id });
  if (!parsed.success) {
    req.log.warn({ body: req.body, issues: parsed.error.issues }, "POST qualification validation failed");
    res.status(400).json({ error: parsed.error.message, issues: parsed.error.issues });
    return;
  }
  const [row] = await db
    .insert(staffQualificationsTable)
    .values(parsed.data as any)
    .returning();
  res.status(201).json(row);
});

router.patch("/qualifications/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffQualificationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateStaffQualificationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ body: req.body, issues: parsed.error.issues }, "PATCH qualification validation failed");
    res.status(400).json({ error: parsed.error.message, issues: parsed.error.issues });
    return;
  }
  const [row] = await db
    .update(staffQualificationsTable)
    .set(parsed.data as any)
    .where(eq(staffQualificationsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Qualification not found" });
    return;
  }
  res.json(row);
});

router.delete("/qualifications/:id", async (req, res): Promise<void> => {
  const params = DeleteStaffQualificationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(staffQualificationsTable)
    .where(eq(staffQualificationsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Qualification not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
