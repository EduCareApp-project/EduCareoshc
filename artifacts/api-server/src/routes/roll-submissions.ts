import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, rollSubmissionsTable, sitesTable } from "@workspace/db";
import { GetRollComplianceReportResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// All date helpers work in UTC to avoid server-timezone skew
function getWeekStartUTC(d: Date): string {
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // days back to Monday
  const monday = new Date(d.getTime() + diff * 86400000);
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
}

function subtractWeeks(dateStr: string, n: number): string {
  const ms = new Date(dateStr + "T00:00:00Z").getTime() - n * 7 * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// GET /api/roll-submissions/report?siteId=N
// Returns a week-by-week compliance summary since records began, plus period summaries.
router.get("/roll-submissions/report", async (req, res): Promise<void> => {
  const siteIdFilter = typeof req.query.siteId === "string" ? parseInt(req.query.siteId, 10) : null;

  const allSites = await db.select({ id: sitesTable.id, name: sitesTable.name }).from(sitesTable).orderBy(sitesTable.name);
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
  const cutoff4  = subtractWeeks(currentWeekStart, 4);
  const cutoff12 = subtractWeeks(currentWeekStart, 12);
  const cutoff52 = subtractWeeks(currentWeekStart, 52);

  function siteCell(siteId: number, fromCutoff: string, weeksCount: number) {
    const submitted = allSubmissions.filter(
      (s) => s.siteId === siteId && s.submitted &&
             (s.weekStart as string) >= fromCutoff &&
             (s.weekStart as string) < currentWeekStart
    ).length;
    return {
      submitted,
      totalPossible: weeksCount,
      pct: weeksCount > 0 ? Math.round((submitted / weeksCount) * 100) : 0,
    };
  }

  const sites = filteredSites.map((site) => ({
    siteId: site.id,
    siteName: site.name,
    last4Weeks:  siteCell(site.id, cutoff4,  4),
    last12Weeks: siteCell(site.id, cutoff12, 12),
    last52Weeks: siteCell(site.id, cutoff52, 52),
  }));

  res.json(GetRollComplianceReportResponse.parse({ sites, weeks: [] }));
});

// GET /api/roll-submissions?weekStart=YYYY-MM-DD
// Returns every site with its submission status for the given week.
// Defaults to current week if weekStart is omitted.
router.get("/roll-submissions", async (req, res): Promise<void> => {
  const weekStart = typeof req.query.weekStart === "string"
    ? req.query.weekStart
    : getWeekStartUTC(new Date());

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    res.status(400).json({ error: "weekStart must be YYYY-MM-DD" });
    return;
  }

  const sites = await db
    .select({ id: sitesTable.id, name: sitesTable.name })
    .from(sitesTable)
    .orderBy(sitesTable.name);

  const submissions = await db
    .select()
    .from(rollSubmissionsTable)
    .where(eq(rollSubmissionsTable.weekStart, weekStart));

  const bySite = new Map(submissions.map((s) => [s.siteId, s]));

  res.json({
    weekStart,
    sites: sites.map((site) => {
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
});

// PUT /api/roll-submissions/:weekStart/:siteId
// Upserts the submission record for one site + week.
router.put("/roll-submissions/:weekStart/:siteId", async (req, res): Promise<void> => {
  const { weekStart, siteId: siteIdStr } = req.params;
  const siteId = parseInt(siteIdStr, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || isNaN(siteId)) {
    res.status(400).json({ error: "Invalid weekStart or siteId" });
    return;
  }

  const { submitted, accurate, notes } = req.body ?? {};

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
});

export default router;
