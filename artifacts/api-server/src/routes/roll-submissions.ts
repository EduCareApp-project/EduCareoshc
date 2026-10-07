import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rollSubmissionsTable, sitesTable } from "@workspace/db";
import { GetRollComplianceReportResponse } from "@workspace/api-zod";
import { buildRollPeriodCell, getWeekStartUTC, isEligibleRollWeek, isValidCalendarDate } from "../lib/rollCompliance";

const router: IRouter = Router();

// GET /api/roll-submissions/report?siteId=N
// Returns a week-by-week compliance summary since records began, plus period summaries.
router.get("/roll-submissions/report", async (req, res): Promise<void> => {
  const siteIdFilter = typeof req.query.siteId === "string" ? parseInt(req.query.siteId, 10) : null;

  try {
    const allSites = await db.select({ id: sitesTable.id, name: sitesTable.name, serviceStartDate: sitesTable.serviceStartDate }).from(sitesTable).where(eq(sitesTable.status, "active")).orderBy(sitesTable.name);
    const filteredSites = siteIdFilter ? allSites.filter((s) => s.id === siteIdFilter) : allSites;
    const totalSitesCount = filteredSites.length;

    let submissionsQuery = db.select().from(rollSubmissionsTable);
    if (siteIdFilter) {
      submissionsQuery = submissionsQuery.where(eq(rollSubmissionsTable.siteId, siteIdFilter)) as typeof submissionsQuery;
    }
    const allSubmissions = await submissionsQuery;

    if (totalSitesCount === 0) {
      res.json(GetRollComplianceReportResponse.parse({ sites: [], weeks: [] }));
      return;
    }

    // All cutoffs in UTC — "4 weeks" = the 4 complete weeks immediately before this week
    const currentWeekStart = getWeekStartUTC(new Date());
    const sites = filteredSites.map((site) => ({
      siteId: site.id,
      siteName: site.name,
      serviceStartDate: site.serviceStartDate ?? null,
      last4Weeks:  buildRollPeriodCell(site, allSubmissions, currentWeekStart, 4),
      last12Weeks: buildRollPeriodCell(site, allSubmissions, currentWeekStart, 12),
      last52Weeks: buildRollPeriodCell(site, allSubmissions, currentWeekStart, 52),
    }));

    res.json(GetRollComplianceReportResponse.parse({ sites, weeks: [] }));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch roll compliance report");
    res.status(500).json({ error: "Failed to fetch roll compliance report" });
  }
});

// GET /api/roll-submissions?weekStart=YYYY-MM-DD
// Returns every site with its submission status for the given week.
// Defaults to current week if weekStart is omitted.
router.get("/roll-submissions", async (req, res): Promise<void> => {
  const weekStart = typeof req.query.weekStart === "string"
    ? req.query.weekStart
    : getWeekStartUTC(new Date());

  if (!isValidCalendarDate(weekStart)) {
    res.status(400).json({ error: "weekStart must be YYYY-MM-DD" });
    return;
  }

  try {
    const sites = await db
      .select({ id: sitesTable.id, name: sitesTable.name, serviceStartDate: sitesTable.serviceStartDate })
      .from(sitesTable)
      .where(eq(sitesTable.status, "active"))
      .orderBy(sitesTable.name);

    const submissions = await db
      .select()
      .from(rollSubmissionsTable)
      .where(eq(rollSubmissionsTable.weekStart, weekStart));

    const bySite = new Map(submissions.map((s) => [s.siteId, s]));

    res.json({
      weekStart,
      sites: sites.filter((site) => isEligibleRollWeek(site.serviceStartDate, weekStart)).map((site) => {
        const sub = bySite.get(site.id);
        return {
          siteId: site.id,
          siteName: site.name,
          id: sub?.id ?? null,
          submitted: sub?.submitted ?? false,
          accurate: sub?.accurate ?? false,
          notes: sub?.notes ?? null,
          updatedBy: sub?.updatedBy ?? null,
          updatedAt: sub?.updatedAt?.toISOString() ?? null,
        };
      }),
    });
  } catch (err) {
    req.log.error({ err, weekStart }, "Failed to fetch roll submissions");
    res.status(500).json({ error: "Failed to fetch roll submissions" });
  }
});

// PUT /api/roll-submissions/:weekStart/:siteId
// Upserts the submission record for one site + week.
router.put("/roll-submissions/:weekStart/:siteId", async (req, res): Promise<void> => {
  const { weekStart, siteId: siteIdStr } = req.params;
  const siteId = parseInt(siteIdStr, 10);

  if (!isValidCalendarDate(weekStart) || isNaN(siteId)) {
    res.status(400).json({ error: "Invalid weekStart or siteId" });
    return;
  }

  const { submitted, accurate, notes } = req.body ?? {};

  try {
    const [site] = await db.select({ id: sitesTable.id, serviceStartDate: sitesTable.serviceStartDate })
      .from(sitesTable).where(eq(sitesTable.id, siteId)).limit(1);
    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }
    if (!isEligibleRollWeek(site.serviceStartDate, weekStart)) {
      res.status(400).json({ error: "Roll compliance is not applicable before the service start date." });
      return;
    }
    const [existing] = await db
      .select()
      .from(rollSubmissionsTable)
      .where(and(
        eq(rollSubmissionsTable.weekStart, weekStart),
        eq(rollSubmissionsTable.siteId, siteId),
      ))
      .limit(1);

    if (existing) {
      const updatedByName = (req.session as any)?.user?.name ?? null;
      const [updated] = await db
        .update(rollSubmissionsTable)
        .set({
          submitted: submitted !== undefined ? Boolean(submitted) : existing.submitted,
          accurate: accurate !== undefined ? Boolean(accurate) : existing.accurate,
          notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
          updatedBy: updatedByName,
          updatedAt: new Date(),
        })
        .where(eq(rollSubmissionsTable.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const updatedByName = (req.session as any)?.user?.name ?? null;
      const [created] = await db
        .insert(rollSubmissionsTable)
        .values({
          weekStart: weekStart as any,
          siteId,
          submitted: submitted !== undefined ? Boolean(submitted) : false,
          accurate: accurate !== undefined ? Boolean(accurate) : false,
          notes: notes?.trim() || null,
          updatedBy: updatedByName,
        })
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    req.log.error({ err, weekStart, siteId }, "Failed to upsert roll submission");
    res.status(500).json({ error: "Failed to upsert roll submission" });
  }
});

export default router;
