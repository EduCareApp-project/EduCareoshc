import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import {
  db,
  organisationTable,
  schoolReportRowsTable,
  schoolReportSummariesTable,
  schoolReportTermsTable,
  sitesTable,
  type SchoolReportObligations,
  type SchoolReportSummary,
} from "@workspace/db";
import {
  calculateSchoolReportStatistics,
  calculateLiveSchoolReportStatistics,
  reportPeriodLabel,
  selectedTermNumbers,
} from "../lib/schoolReportStatistics";
import { createSchoolReportPdf } from "../lib/schoolReportPdf";
import { refreshDraftSchoolReportSummaries } from "../lib/refreshDraftSchoolReportSummaries";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { Readable } from "node:stream";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
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

function safeFilenamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

function finalizedReportFilename(organisationName: string, siteName: string, report: SchoolReportSummary): string {
  const reportType = report.frequency === "term"
    ? `Term ${report.period} Report`
    : `${report.periodLabel.replace(/\s+\d{4}$/, "")} Report`;
  return [
    safeFilenamePart(organisationName),
    safeFilenamePart(siteName),
    safeFilenamePart(reportType),
    String(report.reportYear),
  ].join(" - ") + ".pdf";
}

async function createStoredPdf(report: SchoolReportSummary) {
  const [[site], [organisation]] = await Promise.all([
    db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, report.siteId)).limit(1),
    db.select({ name: organisationTable.name }).from(organisationTable).limit(1),
  ]);
  const siteName = site?.name ?? "School";
  const organisationName = organisation?.name?.trim() || "Elysium OSHC";
  const name = finalizedReportFilename(organisationName, siteName, report);
  const bytes = await createSchoolReportPdf(report, siteName, organisationName);
  const path = await objectStorageService.saveObjectEntity(bytes, "application/pdf", "generated/school-reports");
  return { path, name, createdAt: new Date() };
}

async function canReadSiteReports(req: Request, siteId: number): Promise<boolean> {
  const user = req.session.user;
  return isReportManager(req) || (user?.type === "school" && user.siteId === siteId);
}

router.get("/school-reports/:siteId/live-statistics", async (req, res): Promise<void> => {
  const siteId = parsePositiveInteger(req.params.siteId);
  if (!siteId) {
    res.status(400).json({ error: "Invalid site" });
    return;
  }
  if (!(await canReadSiteReports(req, siteId))) {
    res.status(403).json({ error: "You cannot access these school report statistics" });
    return;
  }
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 6);
  const rangeStart = start.toISOString().slice(0, 10);
  const rangeEnd = end.toISOString().slice(0, 10);
  try {
    const result = await db.select({ row: schoolReportRowsTable })
      .from(schoolReportRowsTable)
      .innerJoin(schoolReportTermsTable, eq(schoolReportRowsTable.termId, schoolReportTermsTable.id))
      .where(and(
        eq(schoolReportTermsTable.siteId, siteId),
        gte(schoolReportRowsTable.weekBeginning, rangeStart),
        lte(schoolReportRowsTable.weekBeginning, rangeEnd),
      ))
      .orderBy(schoolReportRowsTable.weekBeginning, schoolReportRowsTable.serviceType);
    res.json(calculateLiveSchoolReportStatistics(result.map(({ row }) => row), rangeStart, rangeEnd));
  } catch (error) {
    req.log.error({ error, siteId }, "Failed to load live school report statistics");
    res.status(500).json({ error: "Failed to load live attendance statistics" });
  }
});

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
    )).orderBy(desc(schoolReportSummariesTable.createdAt), desc(schoolReportSummariesTable.id));
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
      if (report.finalizedPdfPath && report.finalizedPdfName) {
        res.json(report);
        return;
      }
      const pdf = await createStoredPdf(report);
      const [backfilled] = await db.update(schoolReportSummariesTable).set({
        finalizedPdfPath: pdf.path,
        finalizedPdfName: pdf.name,
        finalizedPdfCreatedAt: pdf.createdAt,
        updatedAt: pdf.createdAt,
      }).where(eq(schoolReportSummariesTable.id, reportId)).returning();
      res.json(backfilled);
      return;
    }
    const pdf = await createStoredPdf(report);
    const now = new Date();
    try {
      const [finalized] = await db.update(schoolReportSummariesTable).set({
        status: "finalized",
        finalizedAt: now,
        finalizedById: req.session.user!.id,
        finalizedPdfPath: pdf.path,
        finalizedPdfName: pdf.name,
        finalizedPdfCreatedAt: pdf.createdAt,
        updatedAt: now,
      }).where(eq(schoolReportSummariesTable.id, reportId)).returning();
      res.json(finalized);
    } catch (error) {
      await objectStorageService.deleteObjectEntity(pdf.path).catch(() => undefined);
      throw error;
    }
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
    let pdfPath = report.finalizedPdfPath;
    let filename = report.finalizedPdfName;
    if (!pdfPath || !filename) {
      const pdf = await createStoredPdf(report);
      pdfPath = pdf.path;
      filename = pdf.name;
      await db.update(schoolReportSummariesTable).set({
        finalizedPdfPath: pdf.path,
        finalizedPdfName: pdf.name,
        finalizedPdfCreatedAt: pdf.createdAt,
      }).where(eq(schoolReportSummariesTable.id, reportId));
    }
    const file = await objectStorageService.getObjectEntityFile(pdfPath);
    const response = await objectStorageService.downloadObject(file, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/["\r\n]/g, "")}"`);
    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "The saved report PDF could not be found" });
      return;
    }
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