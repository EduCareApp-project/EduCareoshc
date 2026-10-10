import { Router, type IRouter } from "express";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schoolReportRowsTable, schoolReportTermsTable, sitesTable } from "@workspace/db";
import { GetDashboardUtilisationQueryParams, GetDashboardUtilisationResponse } from "@workspace/api-zod";
import { calculateSchoolUtilisation, shiftCalendarDate, validCalendarDate } from "../lib/schoolUtilisation";

const router: IRouter = Router();
const LEADERSHIP_ROLES = new Set(["admin", "admin_support", "educational_leader"]);

router.get("/dashboard/utilisation", async (req, res): Promise<void> => {
  const user = req.session.user;
  if (!user) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  if (user.type !== "staff" || !LEADERSHIP_ROLES.has(user.role)) {
    res.status(403).json({ error: "Leadership access required" });
    return;
  }
  const parsed = GetDashboardUtilisationQueryParams.safeParse(req.query);
  if (!parsed.success || !validCalendarDate(parsed.data.startDate) || !validCalendarDate(parsed.data.endDate)
    || parsed.data.startDate > parsed.data.endDate) {
    res.status(400).json({ error: "Choose a valid start and end date, with the start no later than the end" });
    return;
  }
  const { startDate, endDate } = parsed.data;
  try {
    const [sites, rows] = await Promise.all([
      db.select({
        id: sitesTable.id, name: sitesTable.name, identifier: sitesTable.identifier,
        status: sitesTable.status, serviceStartDate: sitesTable.serviceStartDate,
      })
        .from(sitesTable).orderBy(asc(sitesTable.name)),
      db.select({ siteId: schoolReportTermsTable.siteId, row: schoolReportRowsTable })
        .from(schoolReportRowsTable)
        .innerJoin(schoolReportTermsTable, eq(schoolReportRowsTable.termId, schoolReportTermsTable.id))
        .where(and(
          gte(schoolReportRowsTable.weekBeginning, shiftCalendarDate(startDate, -4)),
          lte(schoolReportRowsTable.weekBeginning, endDate),
        )).orderBy(asc(schoolReportRowsTable.id)),
    ]);
    res.json(GetDashboardUtilisationResponse.parse(calculateSchoolUtilisation(sites, rows, startDate, endDate)));
  } catch (error) {
    req.log.error({ error }, "Failed to load leadership utilisation data");
    res.status(500).json({ error: "Failed to load utilisation data" });
  }
});

export default router;
