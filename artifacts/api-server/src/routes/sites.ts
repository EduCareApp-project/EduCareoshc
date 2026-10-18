import { Router, type IRouter } from "express";
import { isValidCalendarDate } from "../lib/rollCompliance";
import { and, eq } from "drizzle-orm";
import { organisationId } from "../lib/tenant";
import { db, sitesTable } from "@workspace/db";
import { ensureSchoolAccount } from "../lib/schoolAccounts";
import { normalizeSiteIdentifierBody, isDuplicateSiteIdentifier } from "../lib/siteIdentifiers";
import {
  ListSitesResponse,
  CreateSiteBody,
  UpdateSiteParams,
  UpdateSiteBody,
  UpdateSiteResponse,
  DeleteSiteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sites", async (req, res): Promise<void> => {
  try {
    // ?all=true is used by the Sites management page to show pending/closed sites too.
    // All other callers (dropdowns, roll marking, etc.) get active sites only.
    const showAll = req.query.all === "true";
    const scope = eq(sitesTable.orgId, organisationId(res));
    const query = db.select().from(sitesTable).where(scope).orderBy(sitesTable.name);
    const sites = showAll
      ? await query
      : await db.select().from(sitesTable).where(and(scope, eq(sitesTable.status, "active"))).orderBy(sitesTable.name);
    res.json(ListSitesResponse.parse(sites));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sites");
    res.status(500).json({ error: "Failed to fetch sites" });
  }
});

router.post("/sites", async (req, res): Promise<void> => {
  const parsed = CreateSiteBody.refine(
    (data) => data.serviceStartDate == null || isValidCalendarDate(data.serviceStartDate),
    { message: "Service start date must be a valid YYYY-MM-DD date", path: ["serviceStartDate"] },
  ).safeParse(normalizeSiteIdentifierBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [site] = await db.insert(sitesTable).values({
      ...parsed.data,
      orgId: organisationId(res),
      identifier: parsed.data.identifier ?? null,
    }).returning();
    if (!site) throw new Error("Site creation returned no record");
    await ensureSchoolAccount(site.id, site.name);
    res.status(201).json(UpdateSiteResponse.parse(site));
  } catch (err) {
    if (isDuplicateSiteIdentifier(err)) {
      res.status(409).json({ error: "That identifier is already used by another site. Choose a different code." });
      return;
    }
    req.log.error({ err }, "Failed to create site");
    res.status(500).json({ error: "Failed to create site" });
  }
});

router.patch("/sites/:id", async (req, res): Promise<void> => {
  const params = UpdateSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSiteBody.refine(
    (data) => data.serviceStartDate == null || isValidCalendarDate(data.serviceStartDate),
    { message: "Service start date must be a valid YYYY-MM-DD date", path: ["serviceStartDate"] },
  ).safeParse(normalizeSiteIdentifierBody(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [site] = await db
      .update(sitesTable)
      .set(parsed.data)
      .where(and(eq(sitesTable.id, params.data.id), eq(sitesTable.orgId, organisationId(res))))
      .returning();
    if (!site) {
      res.status(404).json({ error: "Site not found" });
      return;
    }
    res.json(UpdateSiteResponse.parse(site));
  } catch (err) {
    if (isDuplicateSiteIdentifier(err)) {
      res.status(409).json({ error: "That identifier is already used by another site. Choose a different code." });
      return;
    }
    req.log.error({ err, siteId: params.data.id }, "Failed to update site");
    res.status(500).json({ error: "Failed to update site" });
  }
});

router.delete("/sites/:id", async (req, res): Promise<void> => {
  const params = DeleteSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [deleted] = await db.delete(sitesTable)
      .where(and(eq(sitesTable.id, params.data.id), eq(sitesTable.orgId, organisationId(res)))).returning({ id: sitesTable.id });
    if (!deleted) { res.status(404).json({ error: "Site not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err, siteId: params.data.id }, "Failed to delete site");
    res.status(500).json({ error: "Failed to delete site" });
  }
});

export default router;
