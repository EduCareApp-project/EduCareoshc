import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, fileLibraryTable, fileCategoriesTable } from "@workspace/db";
import {
  CreateFileLibraryItemBody, DeleteFileLibraryItemParams,
  ListFileLibraryResponse, ListFileLibraryResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/file-library", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: fileLibraryTable.id,
      categoryId: fileLibraryTable.categoryId,
      categoryName: fileCategoriesTable.name,
      siteId: fileLibraryTable.siteId,
      name: fileLibraryTable.name,
      documentPath: fileLibraryTable.documentPath,
      documentName: fileLibraryTable.documentName,
      createdAt: fileLibraryTable.createdAt,
    })
    .from(fileLibraryTable)
    .leftJoin(fileCategoriesTable, eq(fileLibraryTable.categoryId, fileCategoriesTable.id))
    .orderBy(fileCategoriesTable.sortOrder, fileCategoriesTable.name, fileLibraryTable.name);
  res.json(ListFileLibraryResponse.parse(rows));
});

router.post("/file-library", async (req, res): Promise<void> => {
  const parsed = CreateFileLibraryItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(fileLibraryTable).values(parsed.data as any).returning();

  // Fetch category name for response
  let categoryName: string | null = null;
  if (item.categoryId) {
    const [cat] = await db.select({ name: fileCategoriesTable.name }).from(fileCategoriesTable).where(eq(fileCategoriesTable.id, item.categoryId));
    categoryName = cat?.name ?? null;
  }
  res.status(201).json(ListFileLibraryResponseItem.parse({ ...item, categoryName }));
});

router.delete("/file-library/:id", async (req, res): Promise<void> => {
  const params = DeleteFileLibraryItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(fileLibraryTable).where(eq(fileLibraryTable.id, params.data.id));
  res.status(204).end();
});

export default router;
