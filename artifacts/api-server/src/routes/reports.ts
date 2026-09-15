import { Router, type IRouter } from "express";
import { and, eq, ne, isNotNull } from "drizzle-orm";
import { db, childrenTable, staffTable, observationsTable, outcomesTable, evacuationsTable, incidentsTable, conditionReportsTable, qipItemsTable, checklistRoutinesTable, professionalDevelopmentTable, staffQualificationsTable, postsTable, organisationTable, sitesTable } from "@workspace/db";
import { GetLearningStoriesReportResponse, GetServiceComplianceReportResponse, GetStaffComplianceReportResponse } from "@workspace/api-zod";
import { buildEmergencyStatuses } from "../lib/serviceCompliance";

const DEFAULT_CANNOT_WORK_QUALS = ["WWCC", "CPR Renewal", "First Aid"];
const DEFAULT_RP_QUALS = [
  "Child Safety - Mandatory Reporting and Other Obligations", "CPR Renewal",
  "Education Qualifications", "First Aid", "Food Safety", "History & Compliance",
  "Responsible Person Declaration", "Risk Management (DET)", "Staff Details (DET)", "WWCC",
];
const DEFAULT_EDUCATOR_QUALS = [
  "Staff Details (DET)", "WWCC", "Child Safety - Mandatory Reporting and Other Obligations",
];

const router: IRouter = Router();

router.get("/reports/learning-stories", async (req, res): Promise<void> => {
  const siteId = req.query.siteId ? Number(req.query.siteId) : null;

  try {
    const outcomes = await db.select().from(outcomesTable).orderBy(outcomesTable.number);
    const allChildren = await db.select().from(childrenTable);
    const filteredChildren = siteId ? allChildren.filter((c) => c.siteId === siteId) : allChildren;
    const filteredChildIds = new Set(filteredChildren.map((c) => c.id));

    const allObservations = await db.select().from(observationsTable)
      .where(isNotNull(observationsTable.publishedAt));
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
  } catch (err) {
    req.log.error({ err }, "Failed to fetch learning stories report");
    res.status(500).json({ error: "Failed to fetch learning stories report" });
  }
});

router.get("/reports/service-compliance", async (req, res): Promise<void> => {
  const siteId = req.query.siteId ? Number(req.query.siteId) : null;

  try {
    const allEvacuations = await db.select().from(evacuationsTable);
    const filteredEvacuations = siteId ? allEvacuations.filter((e) => e.siteId === siteId) : allEvacuations;
    const activeSites = await db.select({ id: sitesTable.id, name: sitesTable.name })
      .from(sitesTable)
      .where(eq(sitesTable.status, "active"));
    const scopedSites = siteId ? activeSites.filter((site) => site.id === siteId) : activeSites;
    const emergencyStatuses = buildEmergencyStatuses(scopedSites, filteredEvacuations);
    const evacuationStatuses = emergencyStatuses.filter((status) => status.drillType === "evacuation");
    const legacyEvacuation = evacuationStatuses.find((status) => status.status !== "current")
      ?? evacuationStatuses[0];

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

    res.json(GetServiceComplianceReportResponse.parse({
      evacuationStatus: {
        lastConducted: legacyEvacuation?.lastConducted ?? null,
        nextDue: legacyEvacuation?.nextDue ?? null,
        isOverdue: legacyEvacuation?.status === "expired",
      },
      emergencyStatuses,
      openIncidents,
      openConditionReports,
      openQipItems,
      activeChecklists,
      overdueChecklists,
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch service compliance report");
    res.status(500).json({ error: "Failed to fetch service compliance report" });
  }
});

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

interface ComplianceTierConfig {
  cannotWorkQuals: string[];
  rpQuals: string[];
  educatorQuals: string[];
}

function deriveComplianceStatus(
  quals: StaffQual[],
  wwccOnRecord: boolean,
  config: ComplianceTierConfig,
): "cannot_work" | "responsible_person" | "educator" | "incomplete" {
  const nameLower = (n: string) => n.toLowerCase();

  // Cannot Work: any configured critical qual is expired
  const criticalExpired = config.cannotWorkQuals.some((cw) =>
    quals.some((q) => nameLower(q.name) === nameLower(cw) && qualIsExpired(q))
  );
  if (criticalExpired) return "cannot_work";

  const currentNames = new Set(quals.filter((q) => !qualIsExpired(q)).map((q) => nameLower(q.name)));
  const wwccCurrent = wwccOnRecord || currentNames.has("wwcc");

  // Educator tier — all educator quals must be current (WWCC handled via record too)
  const educatorMet = config.educatorQuals.every((n) =>
    nameLower(n) === "wwcc" ? wwccCurrent : currentNames.has(nameLower(n))
  );
  if (!educatorMet) return "incomplete";

  // Responsible Person — all RP quals current
  const rpMet = config.rpQuals.every((n) =>
    nameLower(n) === "wwcc" ? wwccCurrent : currentNames.has(nameLower(n))
  );
  return rpMet ? "responsible_person" : "educator";
}

router.get("/reports/staff-compliance", async (req, res): Promise<void> => {
  try {
    const [allStaff, allPd, allQuals, orgRow] = await Promise.all([
      db.select().from(staffTable).where(and(
        eq(staffTable.status, "active"),
        ne(staffTable.isSuperAdmin, true),
        ne(staffTable.role, "admin_support"),
      )),
      db.select().from(professionalDevelopmentTable),
      db.select().from(staffQualificationsTable),
      db.select({ featureSettings: organisationTable.featureSettings }).from(organisationTable).limit(1),
    ]);

    const fs = (orgRow[0]?.featureSettings ?? {}) as any;
    const tierConfig: ComplianceTierConfig = {
      cannotWorkQuals: fs.staffCannotWorkQuals ?? DEFAULT_CANNOT_WORK_QUALS,
      rpQuals:         fs.staffResponsiblePersonQuals ?? DEFAULT_RP_QUALS,
      educatorQuals:   fs.staffEducatorQuals ?? DEFAULT_EDUCATOR_QUALS,
    };

    const currentYear = new Date().getFullYear();
    const staffById = new Map(allStaff.map((s) => [s.id, s]));

    const staffData = allStaff.map((s) => {
      const pdThisYear = allPd.filter((p) => {
        const year = new Date(p.completedAt).getFullYear();
        return p.staffId === s.id && year === currentYear;
      });
      const pdHours = pdThisYear.reduce((sum, p) => sum + (p.hoursEarned ?? 0), 0);

      const myQuals = allQuals.filter((q) => q.staffId === s.id && !q.archivedAt);
      const hasWwcc = !!s.wwccNumber || myQuals.some((q) => q.name.toLowerCase() === "wwcc" && !qualIsExpired(q));
      const complianceStatus = deriveComplianceStatus(myQuals, !!s.wwccNumber, tierConfig);

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
        if (q.archivedAt) return false;
        if (!staffById.has(q.staffId)) return false;
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
  } catch (err) {
    req.log.error({ err }, "Failed to fetch staff compliance report");
    res.status(500).json({ error: "Failed to fetch staff compliance report" });
  }
});

// Returns distinct qualification names across all non-archived quals (for dropdown)
router.get("/reports/qualification-names", async (req, res): Promise<void> => {
  try {
    const quals = await db.select().from(staffQualificationsTable);
    const names = [
      ...new Set(quals.filter((q) => !q.archivedAt).map((q) => q.name)),
    ].sort((a, b) => a.localeCompare(b));
    res.json({ names });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch qualification names");
    res.status(500).json({ error: "Failed to fetch qualification names" });
  }
});

// Checks which active staff have / don't have a current qual of the given name
router.get("/reports/qualification-check", async (req, res): Promise<void> => {
  const qualName = (req.query.name as string | undefined)?.trim();
  if (!qualName) {
    res.status(400).json({ error: "Missing required query param: name" });
    return;
  }

  try {
    const [activeStaff, allQuals] = await Promise.all([
      db.select().from(staffTable).where(and(
        eq(staffTable.status, "active"),
        ne(staffTable.isSuperAdmin, true),
        ne(staffTable.role, "admin_support"),
      )),
      db.select().from(staffQualificationsTable),
    ]);

    const lowerTarget = qualName.toLowerCase();

    const have: { staffId: number; staffName: string; role: string; expiryDate: string | null }[] = [];
    const missing: { staffId: number; staffName: string; role: string }[] = [];

    for (const s of activeStaff) {
      const match = allQuals.find(
        (q) =>
          q.staffId === s.id &&
          !q.archivedAt &&
          q.name.toLowerCase() === lowerTarget &&
          !qualIsExpired(q)
      );

      const staffName = `${s.firstName} ${s.lastName}`;
      if (match) {
        have.push({
          staffId: s.id,
          staffName,
          role: s.role,
          expiryDate: match.expiryDate
            ? (typeof match.expiryDate === "string"
                ? match.expiryDate
                : (match.expiryDate as Date).toISOString().split("T")[0])
            : null,
        });
      } else {
        missing.push({ staffId: s.id, staffName, role: s.role });
      }
    }

    // Sort both lists alphabetically by name
    have.sort((a, b) => a.staffName.localeCompare(b.staffName));
    missing.sort((a, b) => a.staffName.localeCompare(b.staffName));

    res.json({ qualName, have, missing });
  } catch (err) {
    req.log.error({ err }, "Failed to run qualification check");
    res.status(500).json({ error: "Failed to run qualification check" });
  }
});

export default router;
