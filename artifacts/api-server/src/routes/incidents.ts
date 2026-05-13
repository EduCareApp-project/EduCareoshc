import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, incidentsTable, childrenTable } from "@workspace/db";
import {
  CreateIncidentBody, GetIncidentParams, GetIncidentResponse,
  UpdateIncidentParams, UpdateIncidentBody, UpdateIncidentResponse,
  ListIncidentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichIncident(inc: typeof incidentsTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, inc.childId));
  return { ...inc, childName: child ? `${child.firstName} ${child.lastName}` : null };
}

router.get("/incidents", async (_req, res): Promise<void> => {
  const rows = await db.select().from(incidentsTable).orderBy(incidentsTable.incidentDate);
  const childList = await db.select().from(childrenTable);
  const enriched = rows.map((i) => {
    const child = childList.find((c) => c.id === i.childId);
    return { ...i, childName: child ? `${child.firstName} ${child.lastName}` : null };
  });
  res.json(ListIncidentsResponse.parse(enriched));
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [inc] = await db.insert(incidentsTable).values(parsed.data as any).returning();
  res.status(201).json(GetIncidentResponse.parse(await enrichIncident(inc)));
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [inc] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!inc) { res.status(404).json({ error: "Incident not found" }); return; }
  res.json(GetIncidentResponse.parse(await enrichIncident(inc)));
});

router.patch("/incidents/:id", async (req, res): Promise<void> => {
  const params = UpdateIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [inc] = await db.update(incidentsTable).set(parsed.data as any).where(eq(incidentsTable.id, params.data.id)).returning();
  if (!inc) { res.status(404).json({ error: "Incident not found" }); return; }
  res.json(UpdateIncidentResponse.parse(await enrichIncident(inc)));
});

export default router;
