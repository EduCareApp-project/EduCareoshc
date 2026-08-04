import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, professionalDevelopmentTable } from "@workspace/db";
import {
  CreateProfessionalDevelopmentBody, DeleteProfessionalDevelopmentParams,
  GetStaffProfessionalDevelopmentParams, GetStaffProfessionalDevelopmentResponse,
  GetStaffProfessionalDevelopmentResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/staff/:id/professional-development", async (req, res): Promise<void> => {
  const params = GetStaffProfessionalDevelopmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const rows = await db.select().from(professionalDevelopmentTable)
      .where(eq(professionalDevelopmentTable.staffId, params.data.id))
      .orderBy(professionalDevelopmentTable.completedAt);
    res.json(GetStaffProfessionalDevelopmentResponse.parse(rows));
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to fetch professional development");
    res.status(500).json({ error: "Failed to fetch professional development" });
  }
});

router.post("/professional-development", async (req, res): Promise<void> => {
  const parsed = CreateProfessionalDevelopmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [pd] = await db.insert(professionalDevelopmentTable).values(parsed.data as any).returning();
    res.status(201).json(GetStaffProfessionalDevelopmentResponseItem.parse(pd));
  } catch (err) {
    req.log.error({ err }, "Failed to create professional development");
    res.status(500).json({ error: "Failed to create professional development" });
  }
});

router.delete("/professional-development/:id", async (req, res): Promise<void> => {
  const params = DeleteProfessionalDevelopmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const [pd] = await db.delete(professionalDevelopmentTable).where(eq(professionalDevelopmentTable.id, params.data.id)).returning();
    if (!pd) { res.status(404).json({ error: "Record not found" }); return; }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, id: params.data.id }, "Failed to delete professional development");
    res.status(500).json({ error: "Failed to delete professional development" });
  }
});

export default router;
