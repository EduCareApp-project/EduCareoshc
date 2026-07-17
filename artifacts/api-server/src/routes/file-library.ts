import { Router, type IRouter } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, fileLibraryTable, fileCategoriesTable } from "@workspace/db";
import {
  CreateFileLibraryItemBody, DeleteFileLibraryItemParams,
  ListFileLibraryResponse, ListFileLibraryResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/file-library", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: fileLibraryTable.id,
        categoryId: fileLibraryTable.categoryId,
        categoryName: fileCategoriesTable.name,
        siteId: fileLibraryTable.siteId,
        name: fileLibraryTable.name,
        documentPath: fileLibraryTable.documentPath,
        documentName: fileLibraryTable.documentName,
        position: fileLibraryTable.position,
        createdAt: fileLibraryTable.createdAt,
      })
      .from(fileLibraryTable)
      .leftJoin(fileCategoriesTable, eq(fileLibraryTable.categoryId, fileCategoriesTable.id))
      .where(isNull(fileLibraryTable.siteId))
      .orderBy(fileCategoriesTable.sortOrder, fileCategoriesTable.name, fileLibraryTable.position, fileLibraryTable.name);
    const parsed = ListFileLibraryResponse.parse(rows);
    res.setHeader("Cache-Control", "no-store");
    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "file-library GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/file-library", async (req, res): Promise<void> => {
  const parsed = CreateFileLibraryItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Use provided position, or auto-assign next position within this category group
  const { categoryId, position: requestedPosition } = parsed.data as any;
  let resolvedPosition: number = requestedPosition ?? 0;
  if (requestedPosition === undefined || requestedPosition === null) {
    if (categoryId) {
      const existing = await db
        .select({ position: fileLibraryTable.position })
        .from(fileLibraryTable)
        .where(eq(fileLibraryTable.categoryId, categoryId));
      if (existing.length > 0) {
        resolvedPosition = Math.max(...existing.map((r) => r.position)) + 1;
      }
    }
  }

  const [item] = await db.insert(fileLibraryTable).values({ ...parsed.data as any, position: resolvedPosition }).returning();

  let categoryName: string | null = null;
  if (item.categoryId) {
    const [cat] = await db.select({ name: fileCategoriesTable.name }).from(fileCategoriesTable).where(eq(fileCategoriesTable.id, item.categoryId));
    categoryName = cat?.name ?? null;
  }
  res.status(201).json(ListFileLibraryResponseItem.parse({ ...item, categoryName }));
});

router.patch("/file-library/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const allowed = ["name", "position", "siteId", "categoryId"] as const;
  const update: Record<string, unknown> = {};
  for (const f of allowed) {
    if (req.body?.[f] !== undefined) update[f] = req.body[f] === null ? null : req.body[f];
  }
  if (Object.keys(update).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  const [row] = await db.update(fileLibraryTable).set(update as any).where(eq(fileLibraryTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  let categoryName: string | null = null;
  if (row.categoryId) {
    const [cat] = await db.select({ name: fileCategoriesTable.name }).from(fileCategoriesTable).where(eq(fileCategoriesTable.id, row.categoryId));
    categoryName = cat?.name ?? null;
  }
  res.json({ ...row, categoryName });
});

router.delete("/file-library/:id", async (req, res): Promise<void> => {
  const params = DeleteFileLibraryItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(fileLibraryTable).where(eq(fileLibraryTable.id, params.data.id));
  res.status(204).end();
});

export default router;
