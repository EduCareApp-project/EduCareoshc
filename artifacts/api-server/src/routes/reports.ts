import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, childrenTable, staffTable, observationsTable, outcomesTable, evacuationsTable, incidentsTable, conditionReportsTable, qipItemsTable, checklistsTable, professionalDevelopmentTable, staffQualificationsTable } from "@workspace/db";
import { GetLearningStoriesReportResponse, GetServiceComplianceReportResponse, GetStaffComplianceReportResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports/learning-stories", async (_req, res): Promise<void> => {
  const outcomes = await db.select().from(outcomesTable).orderBy(outcomesTable.number);
  const observations = await db.select().from(observationsTable);
  const children = await db.select().from(childrenTable);

  const byOutcome = outcomes.map((o) => ({
    outcomeId: o.id,
    outcomeTitle: o.title,
    outcomeNumber: o.number,
    count: observations.filter((obs) => obs.outcomeIds.includes(o.id)).length,
  }));

  const byChild = children.map((c) => ({
    childId: c.id,
    childName: `${c.firstName} ${c.lastName}`,
    observationCount: observations.filter((obs) => obs.childId === c.id).length,
  }));

  const maxCount = Math.max(...byOutcome.map((o) => o.count), 1);
  const avg = byOutcome.reduce((s, o) => s + o.count, 0) / byOutcome.length;
  const underRepresented = byOutcome.filter((o) => o.count < avg * 0.6);

  res.json(GetLearningStoriesReportResponse.parse({ byOutcome, byChild, underRepresentedOutcomes: underRepresented }));
});

router.get("/reports/service-compliance", async (_req, res): Promise<void> => {
  const evacuations = await db.select().from(evacuationsTable).orderBy(evacuationsTable.conductedAt);
  const lastEvac = evacuations.filter((e) => e.drillType === "evacuation").pop();

  const openIncidents = (await db.select().from(incidentsTable)).filter((i) => i.status !== "closed").length;
  const openConditionReports = (await db.select().from(conditionReportsTable)).filter((r) => r.status !== "resolved").length;
  const openQipItems = (await db.select().from(qipItemsTable)).length;
  const activeChecklists = (await db.select().from(checklistsTable)).length;

  const now = new Date();
  const nextDue = lastEvac?.nextDueAt ? new Date(lastEvac.nextDueAt) : null;
  const isOverdue = nextDue ? now > nextDue : lastEvac === undefined ? false : true;

  res.json(GetServiceComplianceReportResponse.parse({
    evacuationStatus: {
      lastConducted: lastEvac?.conductedAt?.toISOString() ?? null,
      nextDue: nextDue?.toISOString() ?? null,
      isOverdue,
    },
    openIncidents,
    openConditionReports,
    openQipItems,
    activeChecklists,
  }));
});

router.get("/reports/staff-compliance", async (_req, res): Promise<void> => {
  const allStaff = await db.select().from(staffTable).where(eq(staffTable.status, "active"));
  const allPd = await db.select().from(professionalDevelopmentTable);
  const allQuals = await db.select().from(staffQualificationsTable);
  const currentYear = new Date().getFullYear();

  const staffData = allStaff.map((s) => {
    const pdThisYear = allPd.filter((p) => {
      const year = new Date(p.completedAt).getFullYear();
      return p.staffId === s.id && year === currentYear;
    });
    const pdHours = pdThisYear.reduce((sum, p) => sum + (p.hoursEarned ?? 0), 0);

    // Check WWCC: either the staff record's wwccNumber field, or a qualification
    // named "WWCC" (case-insensitive) with status "current"
    const hasWwccQual = allQuals.some(
      (q) => q.staffId === s.id && q.name.toLowerCase().includes("wwcc") && q.status === "current",
    );

    return {
      staffId: s.id,
      staffName: `${s.firstName} ${s.lastName}`,
      role: s.role,
      hasWwcc: !!s.wwccNumber || hasWwccQual,
      pdHoursThisYear: pdHours,
    };
  });

  res.json(GetStaffComplianceReportResponse.parse({ staff: staffData }));
});

export default router;
