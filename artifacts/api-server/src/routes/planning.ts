import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, planningExperiencesTable } from "@workspace/db";
import {
  CreatePlanningExperienceBody, UpdatePlanningExperienceParams, UpdatePlanningExperienceBody,
  UpdatePlanningExperienceResponse, DeletePlanningExperienceParams,
  ListPlanningExperiencesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/planning", async (_req, res): Promise<void> => {
  const rows = await db.select().from(planningExperiencesTable).orderBy(planningExperiencesTable.createdAt);
  res.json(ListPlanningExperiencesResponse.parse(rows));
});

router.post("/planning", async (req, res): Promise<void> => {
  const parsed = CreatePlanningExperienceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [exp] = await db.insert(planningExperiencesTable).values(parsed.data as any).returning();
  res.status(201).json(UpdatePlanningExperienceResponse.parse(exp));
});

router.patch("/planning/:id", async (req, res): Promise<void> => {
  const params = UpdatePlanningExperienceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePlanningExperienceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [exp] = await db.update(planningExperiencesTable).set(parsed.data as any).where(eq(planningExperiencesTable.id, params.data.id)).returning();
  if (!exp) { res.status(404).json({ error: "Planning experience not found" }); return; }
  res.json(UpdatePlanningExperienceResponse.parse(exp));
});

router.delete("/planning/:id", async (req, res): Promise<void> => {
  const params = DeletePlanningExperienceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [exp] = await db.delete(planningExperiencesTable).where(eq(planningExperiencesTable.id, params.data.id)).returning();
  if (!exp) { res.status(404).json({ error: "Planning experience not found" }); return; }
  res.sendStatus(204);
});

export default router;
