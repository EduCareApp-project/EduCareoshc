import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, fileCategoriesTable } from "@workspace/db";
import {
  CreateFileCategoryBody, UpdateFileCategoryBody, UpdateFileCategoryParams,
  DeleteFileCategoryParams, ListFileCategoriesResponse, ListFileCategoriesResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/file-categories", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(fileCategoriesTable).orderBy(fileCategoriesTable.sortOrder, fileCategoriesTable.name);
    res.json(ListFileCategoriesResponse.parse(rows));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch file categories");
    res.status(500).json({ error: "Failed to fetch file categories" });
  }
});

router.post("/file-categories", async (req, res): Promise<void> => {
  const parsed = CreateFileCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [cat] = await db.insert(fileCategoriesTable).values(parsed.data as any).returning();
    res.status(201).json(ListFileCategoriesResponseItem.parse(cat));
  } catch (err) {
    req.log.error({ err }, "Failed to create file category");
    res.status(500).json({ error: "Failed to create file category" });
  }
});

router.patch("/file-categories/:id", async (req, res): Promise<void> => {
  const params = UpdateFileCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateFileCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [cat] = await db.update(fileCategoriesTable).set(parsed.data as any).where(eq(fileCategoriesTable.id, params.data.id)).returning();
    if (!cat) { res.status(404).json({ error: "Not found" }); return; }
    res.json(ListFileCategoriesResponseItem.parse(cat));
  } catch (err) {
    req.log.error({ err, categoryId: params.data.id }, "Failed to update file category");
    res.status(500).json({ error: "Failed to update file category" });
  }
});

router.delete("/file-categories/:id", async (req, res): Promise<void> => {
  const params = DeleteFileCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    await db.delete(fileCategoriesTable).where(eq(fileCategoriesTable.id, params.data.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err, categoryId: params.data.id }, "Failed to delete file category");
    res.status(500).json({ error: "Failed to delete file category" });
  }
});

export default router;
