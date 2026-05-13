import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, qipItemsTable } from "@workspace/db";
import {
  CreateQipItemBody, UpdateQipItemParams, UpdateQipItemBody, UpdateQipItemResponse,
  DeleteQipItemParams, ListQipItemsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/qip", async (_req, res): Promise<void> => {
  const rows = await db.select().from(qipItemsTable).orderBy(qipItemsTable.createdAt);
  res.json(ListQipItemsResponse.parse(rows));
});

router.post("/qip", async (req, res): Promise<void> => {
  const parsed = CreateQipItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(qipItemsTable).values(parsed.data).returning();
  res.status(201).json(UpdateQipItemResponse.parse(item));
});

router.patch("/qip/:id", async (req, res): Promise<void> => {
  const params = UpdateQipItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateQipItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(qipItemsTable).set(parsed.data).where(eq(qipItemsTable.id, params.data.id)).returning();
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

export default router;
