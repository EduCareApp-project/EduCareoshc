import { Router, type IRouter } from "express";
import { db, evacuationsTable } from "@workspace/db";
import { CreateEvacuationBody, ListEvacuationsResponse, ListEvacuationsResponseItem } from "@workspace/api-zod";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/evacuations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(evacuationsTable).orderBy(desc(evacuationsTable.conductedAt));
  res.json(ListEvacuationsResponse.parse(rows));
});

router.post("/evacuations", async (req, res): Promise<void> => {
  const parsed = CreateEvacuationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const data: Record<string, unknown> = { ...parsed.data };

  // Auto-compute nextDueAt for evacuation type (90 days)
  if (!data.nextDueAt && parsed.data.drillType === "evacuation") {
    const conducted = new Date(parsed.data.conductedAt as string);
    const nextDue = new Date(conducted);
    nextDue.setDate(nextDue.getDate() + 90);
    data.nextDueAt = nextDue;
  }

  const [evac] = await db.insert(evacuationsTable).values(data as any).returning();
  res.status(201).json(ListEvacuationsResponseItem.parse(evac));
});

export default router;
