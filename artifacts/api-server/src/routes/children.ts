import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, childrenTable, observationsTable, staffTable, outcomesTable, programsTable } from "@workspace/db";
import {
  CreateChildBody,
  GetChildParams,
  GetChildResponse,
  UpdateChildParams,
  UpdateChildBody,
  UpdateChildResponse,
  DeleteChildParams,
  ListChildrenResponse,
  GetChildObservationsParams,
  GetChildObservationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/children", async (_req, res): Promise<void> => {
  const children = await db.select().from(childrenTable).orderBy(childrenTable.lastName);
  res.json(ListChildrenResponse.parse(children));
});

router.post("/children", async (req, res): Promise<void> => {
  const parsed = CreateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [child] = await db.insert(childrenTable).values(parsed.data as any).returning();
  res.status(201).json(GetChildResponse.parse(child));
});

router.get("/children/:id", async (req, res): Promise<void> => {
  const params = GetChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, params.data.id));
  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.json(GetChildResponse.parse(child));
});

router.patch("/children/:id", async (req, res): Promise<void> => {
  const params = UpdateChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [child] = await db
    .update(childrenTable)
    .set(parsed.data as any)
    .where(eq(childrenTable.id, params.data.id))
    .returning();
  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.json(UpdateChildResponse.parse(child));
});

router.delete("/children/:id", async (req, res): Promise<void> => {
  const params = DeleteChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [child] = await db.delete(childrenTable).where(eq(childrenTable.id, params.data.id)).returning();
  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/children/:id/observations", async (req, res): Promise<void> => {
  const params = GetChildObservationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const staffList = await db.select().from(staffTable);
  const childList = await db.select().from(childrenTable);
  const programList = await db.select().from(programsTable);

  const observations = await db
    .select()
    .from(observationsTable)
    .where(eq(observationsTable.childId, params.data.id))
    .orderBy(observationsTable.observationDate);

  const enriched = observations.map((obs) => {
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

  res.json(GetChildObservationsResponse.parse(enriched));
});

export default router;
