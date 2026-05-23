import { Router, type IRouter } from "express";
import { db, evacuationsTable, sitesTable } from "@workspace/db";
import { CreateEvacuationBody, UpdateEvacuationBody, ListEvacuationsResponse, ListEvacuationsResponseItem } from "@workspace/api-zod";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/evacuations", async (_req, res): Promise<void> => {
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
    })
    .from(evacuationsTable)
    .leftJoin(sitesTable, eq(evacuationsTable.siteId, sitesTable.id))
    .orderBy(desc(evacuationsTable.conductedAt));

  res.json(ListEvacuationsResponse.parse(rows));
});

router.post("/evacuations", async (req, res): Promise<void> => {
  const parsed = CreateEvacuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data: Record<string, unknown> = { ...parsed.data };

  // Compute nextDueAt: evacuation drills are always 90 days; other types use validDays (default 365)
  const conducted = new Date(parsed.data.conductedAt as string);
  const nextDue = new Date(conducted);
  const days = parsed.data.drillType === "evacuation" ? 90 : ((parsed.data as any).validDays ?? 365);
  nextDue.setDate(nextDue.getDate() + days);
  data.nextDueAt = nextDue;
  delete data.validDays; // not a DB column

  const [evac] = await db.insert(evacuationsTable).values(data as any).returning();

  // Fetch site name for response
  let siteName: string | null = null;
  if (evac.siteId) {
    const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, evac.siteId));
    siteName = site?.name ?? null;
  }

  res.status(201).json(ListEvacuationsResponseItem.parse({ ...evac, siteName }));
});

router.patch("/evacuations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = UpdateEvacuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data: Record<string, unknown> = { ...parsed.data };

  // Recompute nextDueAt from conductedAt + validDays
  if (parsed.data.conductedAt) {
    const conducted = new Date(parsed.data.conductedAt as string);
    const nextDue = new Date(conducted);
    const days = parsed.data.drillType === "evacuation" ? 90 : ((parsed.data as any).validDays ?? 365);
    nextDue.setDate(nextDue.getDate() + days);
    data.nextDueAt = nextDue;
  }
  delete data.validDays;

  const [evac] = await db.update(evacuationsTable).set(data as any).where(eq(evacuationsTable.id, id)).returning();
  if (!evac) { res.status(404).json({ error: "Not found" }); return; }

  let siteName: string | null = null;
  if (evac.siteId) {
    const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, evac.siteId));
    siteName = site?.name ?? null;
  }

  res.json(ListEvacuationsResponseItem.parse({ ...evac, siteName }));
});

router.delete("/evacuations/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(evacuationsTable).where(eq(evacuationsTable.id, id)).returning({ id: evacuationsTable.id });
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).end();
});

export default router;
