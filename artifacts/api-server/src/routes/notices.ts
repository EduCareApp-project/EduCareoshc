import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, noticesTable } from "@workspace/db";
import { CreateNoticeBody, DeleteNoticeParams, ListNoticesResponse, ListNoticesResponseItem } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notices", async (req, res): Promise<void> => {
  const audience = req.query.audience as string | undefined;
  const rows = audience
    ? await db.select().from(noticesTable).where(eq(noticesTable.audience, audience)).orderBy(noticesTable.createdAt)
    : await db.select().from(noticesTable).orderBy(noticesTable.createdAt);
  res.json(ListNoticesResponse.parse(rows));
});

router.post("/notices", async (req, res): Promise<void> => {
  const parsed = CreateNoticeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [notice] = await db.insert(noticesTable).values(parsed.data as any).returning();
  res.status(201).json(ListNoticesResponseItem.parse(notice));
});

router.delete("/notices/:id", async (req, res): Promise<void> => {
  const params = DeleteNoticeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [notice] = await db.delete(noticesTable).where(eq(noticesTable.id, params.data.id)).returning();
  if (!notice) { res.status(404).json({ error: "Notice not found" }); return; }
  res.sendStatus(204);
});

export default router;
