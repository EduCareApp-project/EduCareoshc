import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, observationsTable, childrenTable, staffTable, programsTable } from "@workspace/db";
import {
  CreateObservationBody,
  GetObservationParams,
  GetObservationResponse,
  UpdateObservationParams,
  UpdateObservationBody,
  UpdateObservationResponse,
  DeleteObservationParams,
  ListObservationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichObservation(obs: typeof observationsTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, obs.childId));
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, obs.staffId));
  const program = obs.programId
    ? (await db.select().from(programsTable).where(eq(programsTable.id, obs.programId)))[0]
    : null;
  return {
    ...obs,
    childName: child ? `${child.firstName} ${child.lastName}` : null,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
    programName: program ? program.title : null,
  };
}

router.get("/observations", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(observationsTable)
    .orderBy(observationsTable.observationDate);

  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const programList = await db.select().from(programsTable);

  const enriched = rows.map((obs) => {
    const child = childList.find((c) => c.id === obs.childId);
    const staff = staffList.find((s) => s.id === obs.staffId);
    const program = programList.find((p) => p.id === obs.programId);
    return {
      ...obs,
      childName: child ? `${child.firstName} ${child.lastName}` : null,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
      programName: program ? program.title : null,
    };
  });

  res.json(ListObservationsResponse.parse(enriched));
});

router.post("/observations", async (req, res): Promise<void> => {
  const parsed = CreateObservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [obs] = await db.insert(observationsTable).values(parsed.data as any).returning();
  const enriched = await enrichObservation(obs);
  res.status(201).json(GetObservationResponse.parse(enriched));
});

router.get("/observations/:id", async (req, res): Promise<void> => {
  const params = GetObservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [obs] = await db.select().from(observationsTable).where(eq(observationsTable.id, params.data.id));
  if (!obs) {
    res.status(404).json({ error: "Observation not found" });
    return;
  }
  const enriched = await enrichObservation(obs);
  res.json(GetObservationResponse.parse(enriched));
});

router.patch("/observations/:id", async (req, res): Promise<void> => {
  const params = UpdateObservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateObservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [obs] = await db
    .update(observationsTable)
    .set(parsed.data as any)
    .where(eq(observationsTable.id, params.data.id))
    .returning();
  if (!obs) {
    res.status(404).json({ error: "Observation not found" });
    return;
  }
  const enriched = await enrichObservation(obs);
  res.json(UpdateObservationResponse.parse(enriched));
});

router.delete("/observations/:id", async (req, res): Promise<void> => {
  const params = DeleteObservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [obs] = await db
    .delete(observationsTable)
    .where(eq(observationsTable.id, params.data.id))
    .returning();
  if (!obs) {
    res.status(404).json({ error: "Observation not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
