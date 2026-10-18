import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, childrenTable, postsTable, planningExperiencesTable } from "@workspace/db";
import { guardianChildren, organisationId } from "../lib/tenant";

/** Guardian IDs and staff IDs are different namespaces. A guardian must never
 * reach a generic staff route merely because their numeric IDs happen to match. */
export const guardianBoundary: RequestHandler = async (req, res, next) => {
  const user = req.session?.user;
  if (user?.type !== "guardian") { next(); return; }
  if (req.method === "GET" && (
    /^\/guardian\/(?:notifications|excursions(?:\/\d+\/recipients\/\d+)?)$/.test(req.path)
    || /^\/excursions\/\d+\/risk-assessment$/.test(req.path)
    || req.path.startsWith("/storage/public-objects/")
    || req.path === "/qip/public" || req.path.startsWith("/service-docs/public")
    || req.path === "/email-settings/logo"
  )) { next(); return; }
  if (req.method === "POST" && /^\/guardian\/excursions\/\d+\/recipients\/\d+\/(?:viewed|acknowledged|decision)$/.test(req.path)) {
    next(); return;
  }
  const post = /^\/posts\/(\d+)(?:\/(like|comments))?$/.exec(req.path);
  const plan = /^\/planning\/(\d+)\/comments$/.exec(req.path);
  if ((post || plan) && (req.method === "GET" || (req.method === "POST" && (plan || post?.[2])))) {
    try {
      const children = await db.select({ id: childrenTable.id, siteId: childrenTable.siteId }).from(childrenTable)
        .where(guardianChildren(organisationId(res), user.email));
      if (post) {
        const [record] = await db.select().from(postsTable).where(eq(postsTable.id, Number(post[1]))).limit(1);
        if (record?.publishedAt && record.childIds.some((id) => children.some((child) => child.id === id))) {
          next(); return;
        }
      } else if (plan) {
        const [record] = await db.select().from(planningExperiencesTable)
          .where(eq(planningExperiencesTable.id, Number(plan[1]))).limit(1);
        if (record?.stage === "published" && record.weeklyPlanData
            && children.some((child) => child.siteId != null && child.siteId === record.siteId)) {
          next(); return;
        }
      }
      res.status(404).json({ error: "This item is not available to your family" }); return;
    } catch (error) { next(error); return; }
  }
  res.status(403).json({ error: "Guardian accounts can only access their family's portal" });
};
