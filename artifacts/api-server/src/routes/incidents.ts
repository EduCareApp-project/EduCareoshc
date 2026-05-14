import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, incidentsTable, childrenTable, staffTable, sitesTable } from "@workspace/db";
import {
  CreateIncidentBody, GetIncidentParams, GetIncidentResponse,
  UpdateIncidentParams, UpdateIncidentBody, UpdateIncidentResponse,
  ListIncidentsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichIncident(inc: typeof incidentsTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, inc.childId));
  const staffList = await db.select().from(staffTable);
  const siteList = await db.select().from(sitesTable);

  const respondent = staffList.find((s) => s.id === inc.respondentId);
  const reportPerson = staffList.find((s) => s.id === inc.reportPersonId);
  const site = siteList.find((s) => s.id === inc.siteId);

  return {
    ...inc,
    childName: child ? `${child.firstName} ${child.lastName}` : null,
    siteName: site?.name ?? null,
    respondentName: respondent ? `${respondent.firstName} ${respondent.lastName}` : null,
    reportPersonName: reportPerson ? `${reportPerson.firstName} ${reportPerson.lastName}` : null,
  };
}

router.get("/incidents", async (_req, res): Promise<void> => {
  const rows = await db.select().from(incidentsTable).orderBy(incidentsTable.createdAt);
  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const siteList = await db.select().from(sitesTable);

  const enriched = rows.map((i) => {
    const child = childList.find((c) => c.id === i.childId);
    const respondent = staffList.find((s) => s.id === i.respondentId);
    const reportPerson = staffList.find((s) => s.id === i.reportPersonId);
    const site = siteList.find((s) => s.id === i.siteId);
    return {
      ...i,
      childName: child ? `${child.firstName} ${child.lastName}` : null,
      siteName: site?.name ?? null,
      respondentName: respondent ? `${respondent.firstName} ${respondent.lastName}` : null,
      reportPersonName: reportPerson ? `${reportPerson.firstName} ${reportPerson.lastName}` : null,
    };
  });
  res.json(ListIncidentsResponse.parse(enriched));
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [inc] = await db.insert(incidentsTable).values({
    childId: parsed.data.childId,
    incidentDatetime: parsed.data.incidentDatetime ? new Date(parsed.data.incidentDatetime) : null,
    siteId: parsed.data.siteId ?? null,
    respondentId: parsed.data.respondentId ?? null,
    description: parsed.data.description,
    firstAidProvided: parsed.data.firstAidProvided ?? null,
    attachmentPath: parsed.data.attachmentPath ?? null,
  }).returning();
  res.status(201).json(GetIncidentResponse.parse(await enrichIncident(inc)));
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [inc] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  if (!inc) { res.status(404).json({ error: "Incident not found" }); return; }
  res.json(GetIncidentResponse.parse(await enrichIncident(inc)));
});

router.delete("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(incidentsTable).where(eq(incidentsTable.id, params.data.id));
  res.status(204).send();
});

router.patch("/incidents/:id", async (req, res): Promise<void> => {
  const params = UpdateIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.incidentDatetime) updateData.incidentDatetime = new Date(parsed.data.incidentDatetime);
  if (parsed.data.reportMadeAt) updateData.reportMadeAt = new Date(parsed.data.reportMadeAt);

  const [inc] = await db.update(incidentsTable).set(updateData as any).where(eq(incidentsTable.id, params.data.id)).returning();
  if (!inc) { res.status(404).json({ error: "Incident not found" }); return; }
  res.json(UpdateIncidentResponse.parse(await enrichIncident(inc)));
});

export default router;
