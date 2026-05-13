import { Router, type IRouter } from "express";
import { eq, gte, count } from "drizzle-orm";
import { db, childrenTable, staffTable, observationsTable, programsTable, nqsAreasTable, outcomesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentObservationsResponse,
  GetOutcomeCountsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [totalChildrenResult] = await db.select({ count: count() }).from(childrenTable);
  const [activeChildrenResult] = await db
    .select({ count: count() })
    .from(childrenTable)
    .where(eq(childrenTable.status, "active"));
  const [totalStaffResult] = await db.select({ count: count() }).from(staffTable);
  const [totalObsResult] = await db.select({ count: count() }).from(observationsTable);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [monthObsResult] = await db
    .select({ count: count() })
    .from(observationsTable)
    .where(gte(observationsTable.createdAt, startOfMonth));

  const [totalProgramsResult] = await db.select({ count: count() }).from(programsTable);
  const [activeProgramsResult] = await db
    .select({ count: count() })
    .from(programsTable)
    .where(eq(programsTable.status, "active"));

  const nqsAreas = await db.select().from(nqsAreasTable);
  const nqsMeetingCount = nqsAreas.filter(
    (a) => a.status === "meeting" || a.status === "exceeding"
  ).length;

  const summary = {
    totalChildren: totalChildrenResult?.count ?? 0,
    activeChildren: activeChildrenResult?.count ?? 0,
    totalStaff: totalStaffResult?.count ?? 0,
    totalObservations: totalObsResult?.count ?? 0,
    observationsThisMonth: monthObsResult?.count ?? 0,
    totalPrograms: totalProgramsResult?.count ?? 0,
    activePrograms: activeProgramsResult?.count ?? 0,
    nqsMeetingCount,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/recent-observations", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(observationsTable)
    .orderBy(observationsTable.createdAt)
    .limit(10);

  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const programList = await db.select().from(programsTable);

  const enriched = rows.map((obs) => {
    const child = childList.find((c) => c.id === obs.childId);
    const staff = staffList.find((s) => s.id === obs.staffId);
    const program = programList.find((p) => p.id === obs.programId);
    return {
      ...obs,
      childName: child ? `${child.firstName} ${child.lastName}` : null,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
      programName: program ? program.title : null,
    };
  });

  res.json(GetRecentObservationsResponse.parse(enriched));
});

router.get("/dashboard/outcome-counts", async (_req, res): Promise<void> => {
  const outcomes = await db.select().from(outcomesTable).orderBy(outcomesTable.number);
  const observations = await db.select().from(observationsTable);

  const counts = outcomes.map((outcome) => {
    const cnt = observations.filter((obs) => obs.outcomeIds.includes(outcome.id)).length;
    return {
      outcomeId: outcome.id,
      outcomeTitle: outcome.title,
      outcomeNumber: outcome.number,
      count: cnt,
    };
  });

  res.json(GetOutcomeCountsResponse.parse(counts));
});

export default router;
