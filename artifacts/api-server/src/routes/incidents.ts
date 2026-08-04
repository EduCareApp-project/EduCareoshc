import { Router, type IRouter } from "express";
import { createNotificationsForRoles } from "../lib/notify";
import { logger } from "../lib/logger";
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

router.get("/incidents", async (req, res): Promise<void> => {
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to list incidents");
    res.status(500).json({ error: "Failed to list incidents" });
  }
});

router.post("/incidents", async (req, res): Promise<void> => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [inc] = await db.insert(incidentsTable).values({
      childId: parsed.data.childId,
      incidentDatetime: parsed.data.incidentDatetime ? new Date(parsed.data.incidentDatetime) : null,
      siteId: parsed.data.siteId ?? null,
      respondentId: parsed.data.respondentId ?? null,
      description: parsed.data.description,
      firstAidProvided: parsed.data.firstAidProvided ?? null,
      attachmentPath: parsed.data.attachmentPath ?? null,
    }).returning();
    createNotificationsForRoles({
      roles: ["educational_leader", "admin"],
      type: "incident_submitted",
      title: "New incident log submitted",
      body: parsed.data.description,
      href: `/incidents?highlight=${inc.id}`,
      referenceId: inc.id,
      referenceType: "incident",
    }).catch((err) => logger.warn({ err }, "Failed to send incident_submitted notifications"));

    res.status(201).json(GetIncidentResponse.parse(await enrichIncident(inc)));
  } catch (err) {
    req.log.error({ err }, "Failed to create incident");
    res.status(500).json({ error: "Failed to create incident" });
  }
});

router.get("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  try {
    const [inc] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, params.data.id));
    if (!inc) { res.status(404).json({ error: "Incident not found" }); return; }
    res.json(GetIncidentResponse.parse(await enrichIncident(inc)));
  } catch (err) {
    req.log.error({ err, incidentId: params.data.id }, "Failed to get incident");
    res.status(500).json({ error: "Failed to get incident" });
  }
});

router.delete("/incidents/:id", async (req, res): Promise<void> => {
  const params = GetIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  try {
    await db.delete(incidentsTable).where(eq(incidentsTable.id, params.data.id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err, incidentId: params.data.id }, "Failed to delete incident");
    res.status(500).json({ error: "Failed to delete incident" });
  }
});

router.patch("/incidents/:id", async (req, res): Promise<void> => {
  const params = UpdateIncidentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.incidentDatetime) updateData.incidentDatetime = new Date(parsed.data.incidentDatetime);
    if (parsed.data.reportMadeAt) updateData.reportMadeAt = new Date(parsed.data.reportMadeAt);

    const [prevInc] = await db.select({ status: incidentsTable.status, siteId: incidentsTable.siteId })
      .from(incidentsTable).where(eq(incidentsTable.id, params.data.id));

    const [inc] = await db.update(incidentsTable).set(updateData as any).where(eq(incidentsTable.id, params.data.id)).returning();
    if (!inc) { res.status(404).json({ error: "Incident not found" }); return; }

    if (prevInc?.status === "open" && parsed.data.status && parsed.data.status !== "open") {
      createNotificationsForRoles({
        roles: ["coordinator"],
        siteId: inc.siteId,
        type: "incident_closed",
        title: "Incident log closed",
        href: `/incidents?highlight=${inc.id}`,
        referenceId: inc.id,
        referenceType: "incident",
      }).catch((err) => logger.warn({ err }, "Failed to send incident_closed notifications"));
    }

    res.json(UpdateIncidentResponse.parse(await enrichIncident(inc)));
  } catch (err) {
    req.log.error({ err, incidentId: params.data.id }, "Failed to update incident");
    res.status(500).json({ error: "Failed to update incident" });
  }
});

export default router;
