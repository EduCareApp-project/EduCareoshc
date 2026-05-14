import { Router, type IRouter } from "express";
import { db, evacuationsTable, sitesTable } from "@workspace/db";
import { CreateEvacuationBody, ListEvacuationsResponse, ListEvacuationsResponseItem } from "@workspace/api-zod";
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

  // Always compute nextDueAt as conductedAt + 90 days (record expiry)
  const conducted = new Date(parsed.data.conductedAt as string);
  const nextDue = new Date(conducted);
  nextDue.setDate(nextDue.getDate() + 90);
  data.nextDueAt = nextDue;

  const [evac] = await db.insert(evacuationsTable).values(data as any).returning();

  // Fetch site name for response
  let siteName: string | null = null;
  if (evac.siteId) {
    const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, evac.siteId));
    siteName = site?.name ?? null;
  }

  res.status(201).json(ListEvacuationsResponseItem.parse({ ...evac, siteName }));
});

export default router;
