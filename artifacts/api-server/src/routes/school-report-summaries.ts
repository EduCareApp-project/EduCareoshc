import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  schoolReportRowsTable,
  schoolReportSummariesTable,
  schoolReportTermsTable,
  sitesTable,
  type SchoolReportObligations,
} from "@workspace/db";
import {
  calculateSchoolReportStatistics,
  reportPeriodLabel,
  selectedTermNumbers,
} from "../lib/schoolReportStatistics";
import { createSchoolReportPdf } from "../lib/schoolReportPdf";
import { refreshDraftSchoolReportSummaries } from "../lib/refreshDraftSchoolReportSummaries";

const router: IRouter = Router();
const REPORT_MANAGER_ROLES = new Set(["admin", "admin_support", "educational_leader"]);
const OBLIGATION_KEYS: Array<keyof SchoolReportObligations> = [
  "learningPlayProgramHighlights",
  "teamServiceLeadership",
  "policyPracticeUpdates",
  "childSafetyWellbeing",
  "communityFeedbackResolution",
  "focusForFuture",
];
const EMPTY_OBLIGATIONS: SchoolReportObligations = {
  learningPlayProgramHighlights: "",
  teamServiceLeadership: "",
  policyPracticeUpdates: "",
  childSafetyWellbeing: "",
  communityFeedbackResolution: "",
  focusForFuture: "",
};

function isReportManager(req: Request): boolean {
  return req.session.user?.type === "staff" && REPORT_MANAGER_ROLES.has(req.session.user.role);
}

function requireReportManager(req: Request, res: Response): boolean {
  if (!isReportManager(req)) {
    res.status(403).json({ error: "Admin or Educational Leader access required" });
    return false;
  }
  return true;
}

function requireAdmin(req: Request, res: Response): boolean {
  if (
    req.session.user?.type !== "staff"
    || !["admin", "admin_support"].includes(req.session.user.role)
  ) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

function parsePositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseReportYear(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2200 ? parsed : null;
}

async function canReadSiteReports(req: Request, siteId: number): Promise<boolean> {
  const user = req.session.user;
  return isReportManager(req) || (user?.type === "school" && user.siteId === siteId);
}

router.get("/school-reports/:siteId/summaries", async (req, res): Promise<void> => {
  const siteId = parsePositiveInteger(req.params.siteId);
  const reportYear = parseReportYear(req.query.reportYear);
  if (!siteId || !reportYear) {
    res.status(400).json({ error: "Invalid site or report year" });
    return;
  }
  if (!(await canReadSiteReports(req, siteId))) {
    res.status(403).json({ error: "You cannot access these school reports" });
    return;
  }
  try {
    await refreshDraftSchoolReportSummaries(siteId, reportYear);
    const visibility = req.session.user?.type === "school"
      ? isNull(schoolReportSummariesTable.archivedAt)
      : undefined;
    const reports = await db.select().from(schoolReportSummariesTable).where(and(
      eq(schoolReportSummariesTable.siteId, siteId),
      eq(schoolReportSummariesTable.reportYear, reportYear),
      visibility,
    )).orderBy(asc(schoolReportSummariesTable.createdAt));
    res.json(reports);
  } catch (error) {
    req.log.error({ error, siteId, reportYear }, "Failed to load generated school reports");
    res.status(500).json({ error: "Failed to load generated reports" });
  }
});

router.post("/school-reports/:siteId/summaries", async (req, res): Promise<void> => {
  if (!requireReportManager(req, res)) return;
  const siteId = parsePositiveInteger(req.params.siteId);
  const reportYear = parseReportYear(req.body?.reportYear);
  const frequency = typeof req.body?.frequency === "string" ? req.body.frequency : "";
  const period = typeof req.body?.period === "string" ? req.body.period : "";
  const termNumbers = selectedTermNumbers(frequency, period);
  const periodLabel = reportYear ? reportPeriodLabel(frequency, period, reportYear) : null;
  if (!siteId || !reportYear || !termNumbers || !periodLabel) {
    res.status(400).json({ error: "Invalid report selection" });
    return;
  }

  try {
    const terms = await db.select().from(schoolReportTermsTable).where(and(
      eq(schoolReportTermsTable.siteId, siteId),
      eq(schoolReportTermsTable.reportYear, reportYear),
      inArray(schoolReportTermsTable.termNumber, termNumbers),
    )).orderBy(asc(schoolReportTermsTable.termNumber));
    const unavailable = termNumbers.filter((termNumber) => {
      const term = terms.find((candidate) => candidate.termNumber === termNumber);
      return !term?.generatedAt;
    });
    if (unavailable.length > 0) {
      res.status(409).json({
        error: `Generate attendance for ${unavailable.map((term) => `Term ${term}`).join(", ")} before creating this report`,
      });
      return;
    }

    const rows = await db.select().from(schoolReportRowsTable).where(
      inArray(schoolReportRowsTable.termId, terms.map((term) => term.id)),
    ).orderBy(asc(schoolReportRowsTable.weekNumber), asc(schoolReportRowsTable.id));
    const statistics = calculateSchoolReportStatistics(
      terms.map((term) => ({ ...term, rows: rows.filter((row) => row.termId === term.id) })),
      periodLabel,
    );

    const [existing] = await db.select().from(schoolReportSummariesTable).where(and(
      eq(schoolReportSummariesTable.siteId, siteId),
      eq(schoolReportSummariesTable.reportYear, reportYear),
      eq(schoolReportSummariesTable.frequency, frequency),
      eq(schoolReportSummariesTable.period, period),
      isNull(schoolReportSummariesTable.archivedAt),
    )).limit(1);
    if (existing?.status === "finalized") {
      res.status(409).json({ error: "This report has already been finalised" });
      return;
    }

    const now = new Date();
    const [saved] = existing
      ? await db.update(schoolReportSummariesTable).set({
        periodLabel,
        statistics,
        updatedAt: now,
      }).where(eq(schoolReportSummariesTable.id, existing.id)).returning()
      : await db.insert(schoolReportSummariesTable).values({
        siteId,
        reportYear,
        frequency,
        period,
        periodLabel,
        statistics,
        reportingObligations: EMPTY_OBLIGATIONS,
        createdById: req.session.user!.id,
      }).returning();
    res.status(existing ? 200 : 201).json(saved);
  } catch (error) {
    req.log.error({ error, siteId, reportYear, frequency, period }, "Failed to generate school summary report");
    res.status(500).json({ error: "Failed to generate report" });
  }
});

router.put("/school-reports/:siteId/summaries/:reportId", async (req, res): Promise<void> => {
  if (!requireReportManager(req, res)) return;
  const siteId = parsePositiveInteger(req.params.siteId);
  const reportId = parsePositiveInteger(req.params.reportId);
  if (!siteId || !reportId) {
    res.status(400).json({ error: "Invalid site or report" });
    return;
  }
  const obligations = {} as SchoolReportObligations;
  for (const key of OBLIGATION_KEYS) {
    const value = req.body?.reportingObligations?.[key];
    if (typeof value !== "string" || value.length > 20_000) {
      res.status(400).json({ error: "Reporting obligations must be text and no longer than 20,000 characters each" });
      return;
    }
    obligations[key] = value;
  }
  try {
    const [report] = await db.select().from(schoolReportSummariesTable).where(and(
      eq(schoolReportSummariesTable.id, reportId),
      eq(schoolReportSummariesTable.siteId, siteId),
    )).limit(1);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    if (report.archivedAt) {
      res.status(409).json({ error: "Archived reports cannot be edited" });
      return;
    }
    if (report.status === "finalized") {
      res.status(409).json({ error: "Finalised reports cannot be edited" });
      return;
    }
    const [saved] = await db.update(schoolReportSummariesTable).set({
      reportingObligations: obligations,
      updatedAt: new Date(),
    }).where(eq(schoolReportSummariesTable.id, reportId)).returning();
    res.json(saved);
  } catch (error) {
    req.log.error({ error, siteId, reportId }, "Failed to save reporting obligations");
    res.status(500).json({ error: "Failed to save reporting obligations" });
  }
});

router.post("/school-reports/:siteId/summaries/:reportId/finalize", async (req, res): Promise<void> => {
  if (!requireReportManager(req, res)) return;
  const siteId = parsePositiveInteger(req.params.siteId);
  const reportId = parsePositiveInteger(req.params.reportId);
  if (!siteId || !reportId) {
    res.status(400).json({ error: "Invalid site or report" });
    return;
  }
  try {
    const [report] = await db.select().from(schoolReportSummariesTable).where(and(
      eq(schoolReportSummariesTable.id, reportId),
      eq(schoolReportSummariesTable.siteId, siteId),
    )).limit(1);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    if (report.archivedAt) {
      res.status(409).json({ error: "Archived reports cannot be finalised" });
      return;
    }
    if (report.status === "finalized") {
      res.json(report);
      return;
    }
    const now = new Date();
    const [finalized] = await db.update(schoolReportSummariesTable).set({
      status: "finalized",
      finalizedAt: now,
      finalizedById: req.session.user!.id,
      updatedAt: now,
    }).where(eq(schoolReportSummariesTable.id, reportId)).returning();
    res.json(finalized);
  } catch (error) {
    req.log.error({ error, siteId, reportId }, "Failed to finalize school report");
    res.status(500).json({ error: "Failed to finalize report" });
  }
});

router.get("/school-reports/:siteId/summaries/:reportId/pdf", async (req, res): Promise<void> => {
  const siteId = parsePositiveInteger(req.params.siteId);
  const reportId = parsePositiveInteger(req.params.reportId);
  if (!siteId || !reportId) {
    res.status(400).json({ error: "Invalid site or report" });
    return;
  }
  if (!(await canReadSiteReports(req, siteId))) {
    res.status(403).json({ error: "You cannot access this school report" });
    return;
  }
  try {
    const [report] = await db.select().from(schoolReportSummariesTable).where(and(
      eq(schoolReportSummariesTable.id, reportId),
      eq(schoolReportSummariesTable.siteId, siteId),
    )).limit(1);
    if (!report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    if (req.session.user?.type === "school" && report.archivedAt) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    if (report.status !== "finalized") {
      res.status(409).json({ error: "Finalize the report before downloading its PDF" });
      return;
    }
    const [site] = await db.select({ name: sitesTable.name }).from(sitesTable)
      .where(eq(sitesTable.id, siteId)).limit(1);
    const bytes = await createSchoolReportPdf(report, site?.name ?? "School");
    const filename = `${(site?.name ?? "school").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${report.periodLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(bytes.length));
    res.send(Buffer.from(bytes));
  } catch (error) {
    req.log.error({ error, siteId, reportId }, "Failed to create school report PDF");
    res.status(500).json({ error: "Failed to create report PDF" });
  }
});

router.post("/school-reports/:siteId/summaries/:reportId/archive", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const siteId = parsePositiveInteger(req.params.siteId);
  const reportId = parsePositiveInteger(req.params.reportId);
  if (!siteId || !reportId) {
    res.status(400).json({ error: "Invalid site or report" });
    return;
  }
  try {
    const [archived] = await db.update(schoolReportSummariesTable).set({
      archivedAt: new Date(),
      archivedById: req.session.user!.id,
      updatedAt: new Date(),
    }).where(and(
      eq(schoolReportSummariesTable.id, reportId),
      eq(schoolReportSummariesTable.siteId, siteId),
      isNull(schoolReportSummariesTable.archivedAt),
    )).returning();
    if (!archived) {
      res.status(404).json({ error: "Current report not found" });
      return;
    }
    res.json(archived);
  } catch (error) {
    req.log.error({ error, siteId, reportId }, "Failed to archive school report");
    res.status(500).json({ error: "Failed to archive report" });
  }
});

router.delete("/school-reports/:siteId/summaries/:reportId", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const siteId = parsePositiveInteger(req.params.siteId);
  const reportId = parsePositiveInteger(req.params.reportId);
  if (!siteId || !reportId) {
    res.status(400).json({ error: "Invalid site or report" });
    return;
  }
  try {
    const [deleted] = await db.delete(schoolReportSummariesTable).where(and(
      eq(schoolReportSummariesTable.id, reportId),
      eq(schoolReportSummariesTable.siteId, siteId),
    )).returning({ id: schoolReportSummariesTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    req.log.error({ error, siteId, reportId }, "Failed to delete school report");
    res.status(500).json({ error: "Failed to delete report" });
  }
});

export default router;