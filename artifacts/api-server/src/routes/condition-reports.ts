import { Router, type IRouter } from "express";
import { createNotificationsForRoles } from "../lib/notify";
import { logger } from "../lib/logger";
import { eq, sql } from "drizzle-orm";
import { db, conditionReportsTable, staffTable, sitesTable } from "@workspace/db";
import {
  CreateConditionReportBody, UpdateConditionReportParams, UpdateConditionReportBody,
  UpdateConditionReportResponse, ListConditionReportsResponse, ListConditionReportsResponseItem,
  DeleteConditionReportParams,
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

  createNotificationsForRoles({
    roles: ["educational_leader", "admin"],
    type: "condition_submitted",
    title: "New condition report submitted",
    body: parsed.data.description,
    href: `/condition-reports`,
    referenceId: report.id,
    referenceType: "condition_report",
  }).catch((err) => logger.warn({ err }, "Failed to send condition_submitted notifications"));

  res.status(201).json(ListConditionReportsResponseItem.parse(report));
});

router.patch("/condition-reports/:id", async (req, res): Promise<void> => {
  const params = UpdateConditionReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateConditionReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [prev] = await db.select({ status: conditionReportsTable.status, siteId: conditionReportsTable.siteId })
    .from(conditionReportsTable).where(eq(conditionReportsTable.id, params.data.id));

  await db.update(conditionReportsTable).set(parsed.data as any).where(eq(conditionReportsTable.id, params.data.id));
  const rows = await withJoins();
  const report = rows.find((r) => r.id === params.data.id);
  if (!report) { res.status(404).json({ error: "Condition report not found" }); return; }

  if (prev?.status === "open" && (parsed.data as any).status && (parsed.data as any).status !== "open") {
    createNotificationsForRoles({
      roles: ["coordinator"],
      siteId: prev.siteId,
      type: "condition_closed",
      title: "Condition report closed",
      href: `/condition-reports`,
      referenceId: report.id,
      referenceType: "condition_report",
    }).catch((err) => logger.warn({ err }, "Failed to send condition_closed notifications"));
  }

  res.json(UpdateConditionReportResponse.parse(report));
});

router.delete("/condition-reports/:id", async (req, res): Promise<void> => {
  const params = DeleteConditionReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db.delete(conditionReportsTable).where(eq(conditionReportsTable.id, params.data.id)).returning();
  if (!row) { res.status(404).json({ error: "Condition report not found" }); return; }
  res.sendStatus(204);
});

export default router;
