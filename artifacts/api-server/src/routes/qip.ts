import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, qipItemsTable, qipSourcesTable, qipStrengthsTable } from "@workspace/db";
import {
  CreateQipItemBody, UpdateQipItemParams, UpdateQipItemBody, UpdateQipItemResponse,
  DeleteQipItemParams, ListQipItemsResponse,
  CreateQipSourceBody, UpdateQipSourceParams, UpdateQipSourceBody, UpdateQipSourceResponse,
  DeleteQipSourceParams, ListQipSourcesResponse,
  UpsertQipStrengthParams, UpsertQipStrengthBody, UpsertQipStrengthResponse,
  ListQipStrengthsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── QIP Items ──────────────────────────────────────────────────────────────────

router.get("/qip", async (_req, res): Promise<void> => {
  const rows = await db.select().from(qipItemsTable).orderBy(qipItemsTable.createdAt);
  res.json(ListQipItemsResponse.parse(rows));
});

router.post("/qip", async (req, res): Promise<void> => {
  const parsed = CreateQipItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(qipItemsTable).values(parsed.data as any).returning();
  res.status(201).json(UpdateQipItemResponse.parse(item));
});

router.patch("/qip/:id", async (req, res): Promise<void> => {
  const params = UpdateQipItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateQipItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(qipItemsTable).set(parsed.data as any).where(eq(qipItemsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "QIP item not found" }); return; }
  res.json(UpdateQipItemResponse.parse(item));
});

router.delete("/qip/:id", async (req, res): Promise<void> => {
  const params = DeleteQipItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [item] = await db.delete(qipItemsTable).where(eq(qipItemsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "QIP item not found" }); return; }
  res.sendStatus(204);
});

// ── QIP Sources ────────────────────────────────────────────────────────────────

router.get("/qip-sources", async (_req, res): Promise<void> => {
  const rows = await db.select().from(qipSourcesTable).orderBy(qipSourcesTable.sortOrder, qipSourcesTable.name);
  res.json(ListQipSourcesResponse.parse(rows));
});

router.post("/qip-sources", async (req, res): Promise<void> => {
  const parsed = CreateQipSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [source] = await db.insert(qipSourcesTable).values(parsed.data).returning();
  res.status(201).json(UpdateQipSourceResponse.parse(source));
});

router.patch("/qip-sources/:id", async (req, res): Promise<void> => {
  const params = UpdateQipSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateQipSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [source] = await db.update(qipSourcesTable).set(parsed.data).where(eq(qipSourcesTable.id, params.data.id)).returning();
  if (!source) { res.status(404).json({ error: "QIP source not found" }); return; }
  res.json(UpdateQipSourceResponse.parse(source));
});

router.delete("/qip-sources/:id", async (req, res): Promise<void> => {
  const params = DeleteQipSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [source] = await db.delete(qipSourcesTable).where(eq(qipSourcesTable.id, params.data.id)).returning();
  if (!source) { res.status(404).json({ error: "QIP source not found" }); return; }
  res.sendStatus(204);
});

// ── QIP Strengths ──────────────────────────────────────────────────────────────

router.get("/qip-strengths", async (_req, res): Promise<void> => {
  const rows = await db.select().from(qipStrengthsTable).orderBy(qipStrengthsTable.qualityArea);
  res.json(ListQipStrengthsResponse.parse(rows));
});

router.put("/qip-strengths/:qualityArea", async (req, res): Promise<void> => {
  const params = UpsertQipStrengthParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpsertQipStrengthBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [strength] = await db
    .insert(qipStrengthsTable)
    .values({ qualityArea: params.data.qualityArea, content: parsed.data.content })
    .onConflictDoUpdate({
      target: qipStrengthsTable.qualityArea,
      set: { content: parsed.data.content, updatedAt: new Date() },
    })
    .returning();
  res.json(UpsertQipStrengthResponse.parse(strength));
});

export default router;
