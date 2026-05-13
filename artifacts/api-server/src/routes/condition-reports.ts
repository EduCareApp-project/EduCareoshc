import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conditionReportsTable } from "@workspace/db";
import {
  CreateConditionReportBody, UpdateConditionReportParams, UpdateConditionReportBody,
  UpdateConditionReportResponse, ListConditionReportsResponse, ListConditionReportsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/condition-reports", async (_req, res): Promise<void> => {
  const rows = await db.select().from(conditionReportsTable).orderBy(conditionReportsTable.reportedAt);
  res.json(ListConditionReportsResponse.parse(rows));
});

router.post("/condition-reports", async (req, res): Promise<void> => {
  const parsed = CreateConditionReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [report] = await db.insert(conditionReportsTable).values(parsed.data).returning();
  res.status(201).json(ListConditionReportsResponseItem.parse(report));
});

router.patch("/condition-reports/:id", async (req, res): Promise<void> => {
  const params = UpdateConditionReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateConditionReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "resolved" && !parsed.data.resolvedAt) {
    updateData.resolvedAt = new Date();
  }
  const [report] = await db.update(conditionReportsTable).set(updateData as any).where(eq(conditionReportsTable.id, params.data.id)).returning();
  if (!report) { res.status(404).json({ error: "Condition report not found" }); return; }
  res.json(UpdateConditionReportResponse.parse(report));
});

export default router;
