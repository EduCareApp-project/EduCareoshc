import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, conditionReportsTable, staffTable, sitesTable } from "@workspace/db";
import {
  CreateConditionReportBody, UpdateConditionReportParams, UpdateConditionReportBody,
  UpdateConditionReportResponse, ListConditionReportsResponse, ListConditionReportsResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

const withJoins = async () => {
  const rows = await db
    .select({
      id: conditionReportsTable.id,
      reportedDate: conditionReportsTable.reportedDate,
      staffId: conditionReportsTable.staffId,
      staffName: sql<string | null>`CONCAT(${staffTable.firstName}, ' ', ${staffTable.lastName})`,
      siteId: conditionReportsTable.siteId,
      siteName: sitesTable.name,
      description: conditionReportsTable.description,
      immediateActionRequired: conditionReportsTable.immediateActionRequired,
      actionTaken: conditionReportsTable.actionTaken,
      evidenceDocumentPath: conditionReportsTable.evidenceDocumentPath,
      evidenceDocumentName: conditionReportsTable.evidenceDocumentName,
      leadershipNotes: conditionReportsTable.leadershipNotes,
      status: conditionReportsTable.status,
      createdAt: conditionReportsTable.createdAt,
    })
    .from(conditionReportsTable)
    .leftJoin(staffTable, eq(conditionReportsTable.staffId, staffTable.id))
    .leftJoin(sitesTable, eq(conditionReportsTable.siteId, sitesTable.id))
    .orderBy(conditionReportsTable.createdAt);
  return rows;
};

router.get("/condition-reports", async (_req, res): Promise<void> => {
  const rows = await withJoins();
  res.json(ListConditionReportsResponse.parse(rows));
});

router.post("/condition-reports", async (req, res): Promise<void> => {
  const parsed = CreateConditionReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { siteId, ...rest } = parsed.data;
  await db.insert(conditionReportsTable).values({ ...rest, siteId: siteId ?? null } as any);
  const rows = await withJoins();
  const report = rows[rows.length - 1];
  res.status(201).json(ListConditionReportsResponseItem.parse(report));
});

router.patch("/condition-reports/:id", async (req, res): Promise<void> => {
  const params = UpdateConditionReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateConditionReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.update(conditionReportsTable).set(parsed.data as any).where(eq(conditionReportsTable.id, params.data.id));
  const rows = await withJoins();
  const report = rows.find((r) => r.id === params.data.id);
  if (!report) { res.status(404).json({ error: "Condition report not found" }); return; }
  res.json(UpdateConditionReportResponse.parse(report));
});

export default router;
