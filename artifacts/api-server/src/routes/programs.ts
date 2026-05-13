import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, programsTable } from "@workspace/db";
import {
  CreateProgramBody,
  GetProgramParams,
  GetProgramResponse,
  UpdateProgramParams,
  UpdateProgramBody,
  UpdateProgramResponse,
  ListProgramsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/programs", async (_req, res): Promise<void> => {
  const programs = await db.select().from(programsTable).orderBy(programsTable.startDate);
  res.json(ListProgramsResponse.parse(programs));
});

router.post("/programs", async (req, res): Promise<void> => {
  const parsed = CreateProgramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [program] = await db.insert(programsTable).values(parsed.data as any).returning();
  res.status(201).json(GetProgramResponse.parse(program));
});

router.get("/programs/:id", async (req, res): Promise<void> => {
  const params = GetProgramParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [program] = await db.select().from(programsTable).where(eq(programsTable.id, params.data.id));
  if (!program) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  res.json(GetProgramResponse.parse(program));
});

router.patch("/programs/:id", async (req, res): Promise<void> => {
  const params = UpdateProgramParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProgramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [program] = await db
    .update(programsTable)
    .set(parsed.data as any)
    .where(eq(programsTable.id, params.data.id))
    .returning();
  if (!program) {
    res.status(404).json({ error: "Program not found" });
    return;
  }
  res.json(UpdateProgramResponse.parse(program));
});

export default router;
