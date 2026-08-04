import { Router, type IRouter } from "express";
import { db, evacuationsTable, sitesTable } from "@workspace/db";
import { CreateEvacuationBody, UpdateEvacuationBody, ListEvacuationsResponse, ListEvacuationsResponseItem } from "@workspace/api-zod";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/evacuations", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: evacuationsTable.id,
        drillType: evacuationsTable.drillType,
        conductedAt: evacuationsTable.conductedAt,
        nextDueAt: evacuationsTable.nextDueAt,
        participantCount: evacuationsTable.participantCount,
        durationMinutes: evacuationsTable.durationMinutes,
        notes: evacuationsTable.notes,
        conductedBy: evacuationsTable.conductedBy,
        siteId: evacuationsTable.siteId,
        siteName: sitesTable.name,
        evacuationDocPath: evacuationsTable.evacuationDocPath,
        evacuationDocName: evacuationsTable.evacuationDocName,
        attendanceDocPath: evacuationsTable.attendanceDocPath,
        attendanceDocName: evacuationsTable.attendanceDocName,
        createdAt: evacuationsTable.createdAt,
        archivedAt: evacuationsTable.archivedAt,
      })
      .from(evacuationsTable)
      .leftJoin(sitesTable, eq(evacuationsTable.siteId, sitesTable.id))
      .orderBy(desc(evacuationsTable.conductedAt));

    res.json(ListEvacuationsResponse.parse(rows));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch evacuations");
    res.status(500).json({ error: "Failed to fetch evacuations" });
  }
});

router.post("/evacuations", async (req, res): Promise<void> => {
  const parsed = CreateEvacuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data: Record<string, unknown> = { ...parsed.data };

  // Compute nextDueAt: evacuation drills are always 90 days; other types use validDays (default 365)
  const conducted = new Date(String(parsed.data.conductedAt));
  const nextDue = new Date(conducted);
  const days = parsed.data.drillType === "evacuation" ? 90 : ((parsed.data as any).validDays ?? 365);
  nextDue.setDate(nextDue.getDate() + days);
  data.nextDueAt = nextDue;
  delete data.validDays; // not a DB column

  try {
    const [evac] = await db.insert(evacuationsTable).values(data as any).returning();

    // Fetch site name for response
    let siteName: string | null = null;
    if (evac.siteId) {
      const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, evac.siteId));
      siteName = site?.name ?? null;
    }

    res.status(201).json(ListEvacuationsResponseItem.parse({ ...evac, siteName }));
  } catch (err) {
    req.log.error({ err }, "Failed to create evacuation");
    res.status(500).json({ error: "Failed to create evacuation" });
  }
});

router.patch("/evacuations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = UpdateEvacuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data: Record<string, unknown> = { ...parsed.data };

  // Recompute nextDueAt from conductedAt + validDays
  if (parsed.data.conductedAt) {
    const conducted = new Date(String(parsed.data.conductedAt));
    const nextDue = new Date(conducted);
    const days = parsed.data.drillType === "evacuation" ? 90 : ((parsed.data as any).validDays ?? 365);
    nextDue.setDate(nextDue.getDate() + days);
    data.nextDueAt = nextDue;
  }
  delete data.validDays;

  try {
    const [evac] = await db.update(evacuationsTable).set(data as any).where(eq(evacuationsTable.id, id)).returning();
    if (!evac) { res.status(404).json({ error: "Not found" }); return; }

    let siteName: string | null = null;
    if (evac.siteId) {
      const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, evac.siteId));
      siteName = site?.name ?? null;
    }

    res.json(ListEvacuationsResponseItem.parse({ ...evac, siteName }));
  } catch (err) {
    req.log.error({ err, evacuationId: id }, "Failed to update evacuation");
    res.status(500).json({ error: "Failed to update evacuation" });
  }
});

router.patch("/evacuations/:id/archive", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [evac] = await db
      .update(evacuationsTable)
      .set({ archivedAt: new Date() } as any)
      .where(eq(evacuationsTable.id, id))
      .returning();
    if (!evac) { res.status(404).json({ error: "Not found" }); return; }

    let siteName: string | null = null;
    if (evac.siteId) {
      const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, evac.siteId));
      siteName = site?.name ?? null;
    }

    res.json(ListEvacuationsResponseItem.parse({ ...evac, siteName }));
  } catch (err) {
    req.log.error({ err, evacuationId: id }, "Failed to archive evacuation");
    res.status(500).json({ error: "Failed to archive evacuation" });
  }
});

router.delete("/evacuations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [deleted] = await db.delete(evacuationsTable).where(eq(evacuationsTable.id, id)).returning({ id: evacuationsTable.id });
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err, evacuationId: id }, "Failed to delete evacuation");
    res.status(500).json({ error: "Failed to delete evacuation" });
  }
});

export default router;
