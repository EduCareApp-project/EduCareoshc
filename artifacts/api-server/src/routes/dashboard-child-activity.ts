import { Router, type IRouter } from "express";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import {
  db, childrenTable, observationsTable, jottingsTable, postsTable, planningExperiencesTable,
} from "@workspace/db";
import { GetChildActivityGapsResponse } from "@workspace/api-zod";
import { activityCutoffs, findChildActivityGaps } from "../lib/childActivityGaps";

const router: IRouter = Router();

router.get("/dashboard/child-activity-gaps", async (req, res): Promise<void> => {
  const user = req.session.user;
  if (!user || user.type !== "staff" || user.role === "onboarding") {
    res.status(403).json({ error: "Staff access required" });
    return;
  }

  const rawSiteId = req.query.siteId;
  if (rawSiteId !== undefined && (typeof rawSiteId !== "string" || !/^[1-9]\d*$/.test(rawSiteId) || !Number.isSafeInteger(Number(rawSiteId)))) {
    res.status(400).json({ error: "Invalid site ID" });
    return;
  }
  const requestedSiteId = rawSiteId === undefined ? null : Number(rawSiteId);
  const siteRestricted = user.role === "educator" || user.role === "coordinator";
  if (siteRestricted && (!user.siteId || (requestedSiteId !== null && requestedSiteId !== user.siteId))) {
    res.status(403).json({ error: "This site is not assigned to you" });
    return;
  }
  const siteId = requestedSiteId ?? (siteRestricted ? user.siteId ?? null : null);

  try {
    const now = new Date();
    const { threeMonthsAgo } = activityCutoffs(now);

    const rows = await db.select({
      id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName,
      status: childrenTable.status, siteId: childrenTable.siteId, enrollmentDate: childrenTable.enrollmentDate,
    }).from(childrenTable).where(siteId === null
      ? eq(childrenTable.status, "active")
      : and(eq(childrenTable.status, "active"), eq(childrenTable.siteId, siteId)));
    const children = rows.filter((child) => child.status === "active" && (siteId === null || child.siteId === siteId));
    if (children.length === 0) { res.json([]); return; }

    const ids = children.map((child) => child.id);
    const [observations, jottings, posts, plans] = await Promise.all([
      db.select({ childId: observationsTable.childId, createdAt: observationsTable.createdAt })
        .from(observationsTable)
        .where(and(inArray(observationsTable.childId, ids), gte(observationsTable.createdAt, threeMonthsAgo))),
      db.select({ childId: jottingsTable.childId, createdAt: jottingsTable.createdAt })
        .from(jottingsTable)
        .where(and(inArray(jottingsTable.childId, ids), gte(jottingsTable.createdAt, threeMonthsAgo), isNull(jottingsTable.archivedAt))),
      db.select({ childIds: postsTable.childIds, createdAt: postsTable.createdAt })
        .from(postsTable).where(gte(postsTable.createdAt, threeMonthsAgo)),
      db.select({ childIds: planningExperiencesTable.childIds, createdAt: planningExperiencesTable.createdAt })
        .from(planningExperiencesTable)
        .where(and(gte(planningExperiencesTable.createdAt, threeMonthsAgo), eq(planningExperiencesTable.isTemplate, false))),
    ]);

    const activeIds = new Set(ids);
    const activities = [
      ...observations.filter((item) => item.childId !== null && activeIds.has(item.childId)),
      ...jottings.filter((item) => item.childId !== null && activeIds.has(item.childId))
        .map((item) => ({ childId: item.childId!, createdAt: item.createdAt })),
      ...[...posts, ...plans].flatMap((item) =>
        item.childIds.filter((id) => activeIds.has(id)).map((childId) => ({ childId, createdAt: item.createdAt }))),
    ];
    res.json(GetChildActivityGapsResponse.parse(findChildActivityGaps(children, activities, now)));
  } catch (err) {
    req.log.error({ err }, "Failed to calculate child activity gaps");
    res.status(500).json({ error: "Could not check child activity" });
  }
});

export default router;
