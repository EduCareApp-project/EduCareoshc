import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, childrenTable, staffTable, observationsTable, outcomesTable, evacuationsTable, incidentsTable, conditionReportsTable, qipItemsTable, checklistRoutinesTable, professionalDevelopmentTable, staffQualificationsTable, postsTable } from "@workspace/db";
import { GetLearningStoriesReportResponse, GetServiceComplianceReportResponse, GetStaffComplianceReportResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/reports/learning-stories", async (req, res): Promise<void> => {
  const siteId = req.query.siteId ? Number(req.query.siteId) : null;

  const outcomes = await db.select().from(outcomesTable).orderBy(outcomesTable.number);
  const allChildren = await db.select().from(childrenTable);
  const filteredChildren = siteId ? allChildren.filter((c) => c.siteId === siteId) : allChildren;
  const filteredChildIds = new Set(filteredChildren.map((c) => c.id));

  const allObservations = await db.select().from(observationsTable);
  const observations = siteId
    ? allObservations.filter((obs) => filteredChildIds.has(obs.childId))
    : allObservations;

  const allPosts = await db.select({ outcomeIds: postsTable.outcomeIds, siteId: postsTable.siteId }).from(postsTable);
  const posts = siteId ? allPosts.filter((p) => p.siteId === siteId) : allPosts;

  // Combine outcome references from both observations and posts
  const byOutcome = outcomes.map((o) => ({
    outcomeId: o.id,
    outcomeTitle: o.title,
    outcomeNumber: o.number,
    count:
      observations.filter((obs) => obs.outcomeIds.includes(String(o.id))).length +
      posts.filter((p) => p.outcomeIds.includes(String(o.id))).length,
  }));

  const byChild = filteredChildren.map((c) => ({
    childId: c.id,
    childName: `${c.firstName} ${c.lastName}`,
    observationCount: observations.filter((obs) => obs.childId === c.id).length,
  }));

  const maxCount = Math.max(...byOutcome.map((o) => o.count), 1);
  const avg = byOutcome.reduce((s, o) => s + o.count, 0) / byOutcome.length;
  const underRepresented = byOutcome.filter((o) => o.count < avg * 0.6);

  res.json(GetLearningStoriesReportResponse.parse({ byOutcome, byChild, underRepresentedOutcomes: underRepresented }));
});

router.get("/reports/service-compliance", async (req, res): Promise<void> => {
  const siteId = req.query.siteId ? Number(req.query.siteId) : null;

  const allEvacuations = await db.select().from(evacuationsTable).orderBy(evacuationsTable.conductedAt);
  const filteredEvacuations = siteId ? allEvacuations.filter((e) => e.siteId === siteId) : allEvacuations;
  const lastEvac = filteredEvacuations.filter((e) => e.drillType === "evacuation").pop();

  const allIncidents = await db.select().from(incidentsTable);
  const filteredIncidents = siteId ? allIncidents.filter((i) => i.siteId === siteId) : allIncidents;
  const openIncidents = filteredIncidents.filter((i) => i.status !== "closed" && !i.archived).length;

  const allConditionReports = await db.select().from(conditionReportsTable);
  const filteredConditionReports = siteId ? allConditionReports.filter((r) => r.siteId === siteId) : allConditionReports;
  const openConditionReports = filteredConditionReports.filter((r) => r.status !== "resolved").length;

  const allQipItems = await db.select().from(qipItemsTable);
  const filteredQipItems = siteId ? allQipItems.filter((q) => q.siteId === siteId) : allQipItems;
  const openQipItems = filteredQipItems.length;

  const allChecklists = await db.select().from(checklistRoutinesTable);
  const filteredChecklists = siteId ? allChecklists.filter((c) => c.siteId === siteId) : allChecklists;
  const activeChecklists = filteredChecklists.length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const overdueChecklists = filteredChecklists.filter((c) => {
    if (!c.targetDate) return false;
    const target = new Date(c.targetDate);
    return !isNaN(target.getTime()) && target < sevenDaysAgo;
  }).length;

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
    overdueChecklists,
  }));
});

// Returns true if a qualification name contains every part (case-insensitive)
function qualMatches(name: string, ...parts: string[]) {
  const lower = name.toLowerCase();
  return parts.every((p) => lower.includes(p.toLowerCase()));
}

// Returns true if a qualification is expired (status flag or date has passed)
function qualIsExpired(q: { status: string; expiryDate: string | null }) {
  if (q.status === "expired") return true;
  if (q.expiryDate) {
    const d = new Date(q.expiryDate);
    if (!isNaN(d.getTime()) && d < new Date()) return true;
  }
  return false;
}

type StaffQual = { staffId: number; name: string; status: string; expiryDate: string | null };

// True if the staff member has this qual recorded AND it is not expired
function hasCurrent(quals: StaffQual[], ...nameParts: string[]) {
  return quals.some((q) => qualMatches(q.name, ...nameParts) && !qualIsExpired(q));
}

// True if the staff member has this qual recorded AND it IS expired
function hasExpired(quals: StaffQual[], ...nameParts: string[]) {
  return quals.some((q) => qualMatches(q.name, ...nameParts) && qualIsExpired(q));
}

function deriveComplianceStatus(quals: StaffQual[], wwccOnRecord: boolean): "cannot_work" | "responsible_person" | "educator" | "incomplete" {
  // Cannot Work: any critical qual is explicitly expired
  const criticalExpired =
    hasExpired(quals, "wwcc") ||
    hasExpired(quals, "cpr") ||
    hasExpired(quals, "first aid");
  if (criticalExpired) return "cannot_work";

  // WWCC is current via staff record or qualification
  const wwccCurrent = wwccOnRecord || hasCurrent(quals, "wwcc");

  // Core three required for Educator tier
  const coreThreeCurrent =
    wwccCurrent &&
    hasCurrent(quals, "staff details") &&
    hasCurrent(quals, "child safety") &&
    hasCurrent(quals, "mandatory reporting");

  if (!coreThreeCurrent) return "incomplete";

  // Responsible Person: all required quals present and current
  const responsiblePersonQuals =
    coreThreeCurrent &&
    hasCurrent(quals, "first aid") &&
    hasCurrent(quals, "cpr") &&
    hasCurrent(quals, "food safety") &&
    hasCurrent(quals, "responsible person") &&
    hasCurrent(quals, "education qualifications") &&
    hasCurrent(quals, "history");
  if (responsiblePersonQuals) return "responsible_person";

  return "educator";
}

router.get("/reports/staff-compliance", async (_req, res): Promise<void> => {
  const allStaff = await db.select().from(staffTable).where(eq(staffTable.status, "active"));
  const allPd = await db.select().from(professionalDevelopmentTable);
  const allQuals = await db.select().from(staffQualificationsTable);
  const currentYear = new Date().getFullYear();

  const staffById = new Map(allStaff.map((s) => [s.id, s]));

  const staffData = allStaff.map((s) => {
    const pdThisYear = allPd.filter((p) => {
      const year = new Date(p.completedAt).getFullYear();
      return p.staffId === s.id && year === currentYear;
    });
    const pdHours = pdThisYear.reduce((sum, p) => sum + (p.hoursEarned ?? 0), 0);

    const myQuals = allQuals.filter((q) => q.staffId === s.id);
    const hasWwccQual = hasCurrent(myQuals, "wwcc");
    const hasWwcc = !!s.wwccNumber || hasWwccQual;
    const complianceStatus = deriveComplianceStatus(myQuals, !!s.wwccNumber);

    return {
      staffId: s.id,
      staffName: `${s.firstName} ${s.lastName}`,
      role: s.role,
      hasWwcc,
      pdHoursThisYear: pdHours,
      complianceStatus,
    };
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const windowEnd = new Date(today);
  windowEnd.setDate(today.getDate() + 14);
  const windowEndStr = windowEnd.toISOString().split("T")[0];

  function toDateStr(v: Date | string | null): string {
    if (!v) return "";
    return typeof v === "string" ? v : v.toISOString().split("T")[0];
  }

  const expiringQualifications = allQuals
    .filter((q) => {
      if (!q.expiryDate) return false;
      const d = toDateStr(q.expiryDate);
      return d >= todayStr && d <= windowEndStr;
    })
    .map((q) => {
      const expiryStr = toDateStr(q.expiryDate);
      const ms = new Date(expiryStr).getTime() - today.getTime();
      const daysUntilExpiry = Math.round(ms / 86_400_000);
      const member = staffById.get(q.staffId);
      return {
        qualId: q.id,
        staffId: q.staffId,
        staffName: member ? `${member.firstName} ${member.lastName}` : `Staff #${q.staffId}`,
        qualName: q.name,
        expiryDate: expiryStr,
        daysUntilExpiry,
      };
    })
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  res.json(GetStaffComplianceReportResponse.parse({ staff: staffData, expiringQualifications }));
});

export default router;
