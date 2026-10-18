import { Router, type Request, type Response } from "express";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { tenantConnectionPool as pool, currentOrganisationId, sitesTable, organisationTable, kidsoftServiceMappingsTable, kidsoftRollSnapshotsTable, type KidsoftRollBooking } from "@workspace/db";
import { z, GetKidsoftSetupResponse, GetSchoolKidsoftRollResponse } from "@workspace/api-zod";
import { getKidsoftRoll, getKidsoftServices, kidsoftConfigured, kidsoftToday, KidsoftError } from "../lib/kidsoft";

const router = Router();
// Share the existing database pool but never log SQL parameters containing
// imported child names, even when the main development DB logger is enabled.
const db = drizzle(pool, { logger: false });
const siteParam = z.coerce.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid day");
const admins = new Set(["admin", "admin_support"]);

export function canAccessKidsoftSite(user: { type: string; role?: string; siteId?: number | null }, siteId: number): boolean {
  if (user.type === "school") return user.siteId === siteId;
  if (user.type !== "staff" || user.role === "onboarding") return false;
  return !["educator", "coordinator"].includes(user.role ?? "") || user.siteId === siteId;
}

function admin(req: Request, res: Response): boolean {
  const user = req.session.user!;
  if (user.type !== "staff" || !admins.has(user.role)) {
    res.status(403).json({ error: "Administrator access required" });
    return false;
  }
  return true;
}

function schoolDayAccess(req: Request, res: Response, day: string): boolean {
  if (req.session.user?.type === "school" && day !== kidsoftToday()) {
    res.status(403).json({ error: "Schools can only view today's bookings (Melbourne time)." });
    return false;
  }
  return true;
}

async function siteAccess(req: Request, res: Response): Promise<number | null> {
  const parsed = siteParam.safeParse(req.params.siteId);
  if (!parsed.success) { res.status(400).json({ error: "Invalid service" }); return null; }
  const siteId = parsed.data;
  if (!canAccessKidsoftSite(req.session.user!, siteId)) {
    res.status(403).json({ error: "You can only view your own service's roll" }); return null;
  }
  if (req.session.user!.type === "school") {
    const [org] = await db.select().from(organisationTable).where(eq(organisationTable.id, currentOrganisationId())).limit(1);
    const tabs = org?.featureSettings?.schoolPortalVisibleTabs;
    if (tabs && !tabs.includes("roll")) {
      res.status(403).json({ error: "Kidsoft Roll is not enabled for schools" }); return null;
    }
  }
  const [site] = await db.select({ status: sitesTable.status }).from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site || site.status !== "active") {
    res.status(404).json({ error: "Active service not found" }); return null;
  }
  return siteId;
}

function rollResponse(day: string, mapping: { serviceName: string } | undefined, snapshot?: { bookings: KidsoftRollBooking[]; refreshedAt: Date }) {
  const bookings = snapshot?.bookings ?? [];
  const response = GetSchoolKidsoftRollResponse.parse({
    mapped: Boolean(mapping), serviceName: mapping?.serviceName ?? null,
    date: day, refreshedAt: snapshot?.refreshedAt.toISOString() ?? null,
    totalBookings: bookings.length, totalChildren: new Set(bookings.map((row) => row.childId)).size,
    bookings,
  });
  // Generated response validators coerce dates; the contract is a date-only string.
  return { ...response, date: day };
}

function failure(req: Request, res: Response, error: unknown) {
  if (error instanceof KidsoftError) {
    // Upstream exceptions contain no URL, key, response body or child details.
    res.status(502).json({ error: error.message });
  } else {
    const detail = error as { code?: string; cause?: { code?: string } };
    if (detail.code === "23505" || detail.cause?.code === "23505") {
      res.status(409).json({ error: "That Kidsoft service is already mapped to another EduCare service" });
    } else {
      req.log.error({ errorCode: detail?.code ?? detail?.cause?.code }, "Kidsoft Roll operation failed");
      res.status(500).json({ error: "The roll could not be saved or loaded. Please try again." });
    }
  }
}

router.get("/kidsoft/setup", async (req, res) => {
  if (!admin(req, res)) return;
  try {
    const connected = await kidsoftConfigured();
    const [sites, mappings, services] = await Promise.all([
      db.select({ id: sitesTable.id, name: sitesTable.name }).from(sitesTable)
        .where(eq(sitesTable.status, "active")).orderBy(asc(sitesTable.name)),
      db.select().from(kidsoftServiceMappingsTable),
      connected ? getKidsoftServices() : Promise.resolve([]),
    ]);
    res.json(GetKidsoftSetupResponse.parse({
      connected, services,
      sites: sites.map((site) => {
        const mapping = mappings.find((row) => row.siteId === site.id);
        return { siteId: site.id, siteName: site.name, serviceId: mapping?.serviceId ?? null, serviceName: mapping?.serviceName ?? null };
      }),
    }));
  } catch (error) { failure(req, res, error); }
});

router.put("/kidsoft/mappings/:siteId", async (req, res) => {
  if (!admin(req, res)) return;
  const id = siteParam.safeParse(req.params.siteId);
  const body = z.object({ serviceId: z.string().uuid().nullable() }).safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Choose a valid service" }); return; }
  try {
    const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, id.data));
    if (!site || site.status !== "active") { res.status(400).json({ error: "Choose an active EduCare service" }); return; }
    if (body.data.serviceId === null) {
      await db.delete(kidsoftServiceMappingsTable).where(eq(kidsoftServiceMappingsTable.siteId, id.data));
    } else {
      const service = (await getKidsoftServices()).find((row) => row.id === body.data.serviceId);
      if (!service) { res.status(400).json({ error: "Choose an active Kidsoft service accessible with the connected key" }); return; }
      await db.insert(kidsoftServiceMappingsTable).values({
        siteId: id.data, serviceId: service.id, serviceName: service.name,
      }).onConflictDoUpdate({ target: kidsoftServiceMappingsTable.siteId,
        set: { serviceId: service.id, serviceName: service.name, updatedAt: new Date() } });
    }
    // Historical snapshots stay stored but are never served under a different mapping.
    res.json({ ok: true });
  } catch (error) { failure(req, res, error); }
});

router.get("/schools/:siteId/kidsoft-roll", async (req, res) => {
  const date = dateSchema.safeParse(req.query.date);
  if (!date.success) { res.status(400).json({ error: "Choose a valid day" }); return; }
  if (!schoolDayAccess(req, res, date.data)) return;
  try {
    const siteId = await siteAccess(req, res);
    if (siteId === null) return;
    const [mapping] = await db.select().from(kidsoftServiceMappingsTable).where(eq(kidsoftServiceMappingsTable.siteId, siteId));
    const [snapshot] = mapping ? await db.select().from(kidsoftRollSnapshotsTable).where(and(
      eq(kidsoftRollSnapshotsTable.siteId, siteId), eq(kidsoftRollSnapshotsTable.rollDate, date.data),
      eq(kidsoftRollSnapshotsTable.serviceId, mapping.serviceId),
    )) : [];
    if (!schoolDayAccess(req, res, date.data)) return;
    res.json(rollResponse(date.data, mapping, snapshot));
  } catch (error) { failure(req, res, error); }
});

const refreshing = new Set<string>();
router.post("/schools/:siteId/kidsoft-roll/refresh", async (req, res) => {
  const body = z.object({ date: dateSchema }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Choose a valid day" }); return; }
  if (!schoolDayAccess(req, res, body.data.date)) return;
  let claimed: string | null = null;
  try {
    const siteId = await siteAccess(req, res);
    if (siteId === null) return;
    const [mapping] = await db.select().from(kidsoftServiceMappingsTable).where(eq(kidsoftServiceMappingsTable.siteId, siteId));
    if (!mapping) { res.status(409).json({ error: "Your administrator must map this service to Kidsoft first" }); return; }
    const [previous] = await db.select().from(kidsoftRollSnapshotsTable).where(and(
      eq(kidsoftRollSnapshotsTable.siteId, siteId), eq(kidsoftRollSnapshotsTable.rollDate, body.data.date),
      eq(kidsoftRollSnapshotsTable.serviceId, mapping.serviceId),
    ));
    const refreshKey = `${currentOrganisationId()}:${siteId}`;
    if (refreshing.has(refreshKey) || (previous && Date.now() - previous.refreshedAt.getTime() < 30_000)) {
      res.setHeader("Retry-After", "30");
      res.status(429).json({ error: "Please wait 30 seconds before refreshing this roll again" }); return;
    }
    refreshing.add(refreshKey); claimed = refreshKey;
    const activeService = (await getKidsoftServices()).some((service) => service.id === mapping.serviceId);
    if (!activeService) throw new KidsoftError("The mapped Kidsoft service is no longer active. Ask your administrator to check the mapping.");
    const bookings = await getKidsoftRoll(mapping.serviceId, body.data.date);
    if (!schoolDayAccess(req, res, body.data.date)) return;
    const snapshot = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(kidsoftServiceMappingsTable)
        .where(eq(kidsoftServiceMappingsTable.siteId, siteId)).for("update");
      if (!current || current.serviceId !== mapping.serviceId) return null;
      if (req.session.user?.type === "school" && body.data.date !== kidsoftToday()) return null;
      const [saved] = await tx.insert(kidsoftRollSnapshotsTable).values({
        siteId, rollDate: body.data.date, serviceId: mapping.serviceId, bookings, refreshedAt: new Date(),
      }).onConflictDoUpdate({ target: [kidsoftRollSnapshotsTable.siteId, kidsoftRollSnapshotsTable.rollDate],
        set: { serviceId: mapping.serviceId, bookings, refreshedAt: new Date() } }).returning();
      return saved;
    });
    if (!schoolDayAccess(req, res, body.data.date)) return;
    if (!snapshot) { res.status(409).json({ error: "The service mapping changed during refresh. Please reload and try again." }); return; }
    res.json(rollResponse(body.data.date, mapping, snapshot));
  } catch (error) { failure(req, res, error); }
  finally { if (claimed !== null) refreshing.delete(claimed); }
});

export default router;
