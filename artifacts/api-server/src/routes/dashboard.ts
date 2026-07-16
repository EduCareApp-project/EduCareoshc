import { Router, type IRouter } from "express";
import { eq, gte, count, desc, isNotNull, and, lte, ne } from "drizzle-orm";
import { db, childrenTable, staffTable, observationsTable, programsTable, nqsAreasTable, outcomesTable, postsTable, incidentsTable, conditionReportsTable, sitesTable, planningExperiencesTable, staffQualificationsTable, jottingsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentObservationsResponse,
  GetOutcomeCountsResponse,
  GetRecentActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [totalChildrenResult] = await db.select({ count: count() }).from(childrenTable);
  const [activeChildrenResult] = await db
    .select({ count: count() })
    .from(childrenTable)
    .where(eq(childrenTable.status, "active"));
  const [totalStaffResult] = await db.select({ count: count() }).from(staffTable).where(ne(staffTable.isSuperAdmin, true));
  const [totalObsResult] = await db.select({ count: count() }).from(observationsTable);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const [last7ObsResult] = await db
    .select({ count: count() })
    .from(observationsTable)
    .where(gte(observationsTable.createdAt, sevenDaysAgo));

  const [totalProgramsResult] = await db.select({ count: count() }).from(programsTable);
  const [activeProgramsResult] = await db
    .select({ count: count() })
    .from(programsTable)
    .where(eq(programsTable.status, "active"));

  const nqsAreas = await db.select().from(nqsAreasTable);
  const nqsMeetingCount = nqsAreas.filter(
    (a) => a.status === "meeting" || a.status === "exceeding"
  ).length;

  // Sites with a published weekly plan for the current week (Mon–Sun)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysFromMon = (dayOfWeek + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMon);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const allSites = await db.select({ id: sitesTable.id }).from(sitesTable);
  const publishedPlans = await db
    .selectDistinct({ siteId: planningExperiencesTable.siteId })
    .from(planningExperiencesTable)
    .where(and(
      isNotNull(planningExperiencesTable.weeklyPlanData),
      isNotNull(planningExperiencesTable.siteId),
      gte(planningExperiencesTable.startDate as any, weekStartStr),
      lte(planningExperiencesTable.startDate as any, weekEndStr),
    ));

  // Staff with at least one qualification expiring within the next 30 days
  const thirtyDaysOut = new Date(now);
  thirtyDaysOut.setDate(now.getDate() + 30);
  const todayStr = now.toISOString().split("T")[0];
  const thirtyDaysOutStr = thirtyDaysOut.toISOString().split("T")[0];
  const allQuals = await db.select({ staffId: staffQualificationsTable.staffId, expiryDate: staffQualificationsTable.expiryDate }).from(staffQualificationsTable);
  const expiringStaffIds = new Set(
    allQuals
      .filter((q) => {
        if (!q.expiryDate) return false;
        const d = typeof q.expiryDate === "string" ? q.expiryDate : (q.expiryDate as Date).toISOString().split("T")[0];
        return d >= todayStr && d <= thirtyDaysOutStr;
      })
      .map((q) => q.staffId)
  );

  const [last7PostsResult] = await db
    .select({ count: count() })
    .from(postsTable)
    .where(gte(postsTable.createdAt, sevenDaysAgo));

  const [last7JottingsResult] = await db
    .select({ count: count() })
    .from(jottingsTable)
    .where(gte(jottingsTable.createdAt, sevenDaysAgo));

  const [openIncidentsResult] = await db
    .select({ count: count() })
    .from(incidentsTable)
    .where(and(eq(incidentsTable.status, "open"), eq(incidentsTable.archived, false)));

  const [openConditionReportsResult] = await db
    .select({ count: count() })
    .from(conditionReportsTable)
    .where(eq(conditionReportsTable.status, "open"));

  const summary = {
    totalChildren: totalChildrenResult?.count ?? 0,
    activeChildren: activeChildrenResult?.count ?? 0,
    totalStaff: totalStaffResult?.count ?? 0,
    totalObservations: totalObsResult?.count ?? 0,
    observationsLast7Days: last7ObsResult?.count ?? 0,
    totalPrograms: totalProgramsResult?.count ?? 0,
    activePrograms: activeProgramsResult?.count ?? 0,
    nqsMeetingCount,
    sitesWithPublishedPlan: publishedPlans.length,
    totalSites: allSites.length,
    staffWithExpiringQuals: expiringStaffIds.size,
    postsLast7Days: last7PostsResult?.count ?? 0,
    jottingsLast7Days: last7JottingsResult?.count ?? 0,
    openIncidents: openIncidentsResult?.count ?? 0,
    openConditionReports: openConditionReportsResult?.count ?? 0,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/recent-observations", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(observationsTable)
    .orderBy(desc(observationsTable.createdAt))
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
    const cnt = observations.filter((obs) => obs.outcomeIds.includes(String(outcome.id))).length;
    return {
      outcomeId: outcome.id,
      outcomeTitle: outcome.title,
      outcomeNumber: outcome.number,
      count: cnt,
    };
  });

  res.json(GetOutcomeCountsResponse.parse(counts));
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const [childList, staffList, siteList] = await Promise.all([
    db.select().from(childrenTable),
    db.select().from(staffTable),
    db.select().from(sitesTable),
  ]);

  const [recentObs, recentPosts, recentIncidents, recentConditions] = await Promise.all([
    db.select().from(observationsTable).orderBy(desc(observationsTable.createdAt)).limit(20),
    db.select().from(postsTable).orderBy(desc(postsTable.createdAt)).limit(20),
    db.select().from(incidentsTable).orderBy(desc(incidentsTable.createdAt)).limit(20),
    db.select().from(conditionReportsTable).orderBy(desc(conditionReportsTable.createdAt)).limit(20),
  ]);

  type ActivityItem = {
    id: string;
    type: "observation" | "post" | "incident" | "condition_report";
    label: string;
    detail: string | null;
    actor: string | null;
    siteName: string | null;
    timestamp: string;
    href: string | null;
  };

  const items: ActivityItem[] = [];

  for (const obs of recentObs) {
    const child = childList.find((c) => c.id === obs.childId);
    const staff = staffList.find((s) => s.id === obs.staffId);
    const site = child?.siteId ? siteList.find((s) => s.id === child.siteId) : null;
    items.push({
      id: `obs-${obs.id}`,
      type: "observation",
      label: child ? `Observation — ${child.firstName} ${child.lastName}` : "Observation recorded",
      detail: obs.description.length > 120 ? obs.description.slice(0, 120) + "…" : obs.description,
      actor: staff ? `${staff.firstName} ${staff.lastName}` : null,
      siteName: site ? site.name : null,
      timestamp: obs.createdAt.toISOString(),
      href: `/observations/${obs.id}`,
    });
  }

  for (const post of recentPosts) {
    const staff = staffList.find((s) => s.id === post.staffId);
    const site = post.siteId ? siteList.find((s) => s.id === post.siteId) : null;
    items.push({
      id: `post-${post.id}`,
      type: "post",
      label: `Post published — ${post.title}`,
      detail: post.description ? (post.description.length > 120 ? post.description.slice(0, 120) + "…" : post.description) : null,
      actor: staff ? `${staff.firstName} ${staff.lastName}` : null,
      siteName: site ? site.name : null,
      timestamp: post.createdAt.toISOString(),
      href: `/posts/${post.id}`,
    });
  }

  for (const inc of recentIncidents) {
    const child = childList.find((c) => c.id === inc.childId);
    const respondent = staffList.find((s) => s.id === inc.respondentId);
    const site = inc.siteId ? siteList.find((s) => s.id === inc.siteId) : null;
    items.push({
      id: `inc-${inc.id}`,
      type: "incident",
      label: child ? `Incident — ${child.firstName} ${child.lastName}` : "Incident recorded",
      detail: inc.description.length > 120 ? inc.description.slice(0, 120) + "…" : inc.description,
      actor: respondent ? `${respondent.firstName} ${respondent.lastName}` : null,
      siteName: site ? site.name : null,
      timestamp: inc.createdAt.toISOString(),
      href: `/incidents/${inc.id}`,
    });
  }

  for (const cr of recentConditions) {
    const staff = staffList.find((s) => s.id === cr.staffId);
    const site = cr.siteId ? siteList.find((s) => s.id === cr.siteId) : null;
    items.push({
      id: `cr-${cr.id}`,
      type: "condition_report",
      label: `Condition report${cr.immediateActionRequired ? " (action required)" : ""}`,
      detail: cr.description.length > 120 ? cr.description.slice(0, 120) + "…" : cr.description,
      actor: staff ? `${staff.firstName} ${staff.lastName}` : null,
      siteName: site ? site.name : null,
      timestamp: cr.createdAt.toISOString(),
      href: `/condition-reports/${cr.id}`,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(GetRecentActivityResponse.parse(items.slice(0, 20)));
});

export default router;
