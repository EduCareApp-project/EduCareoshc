import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, fileLibraryTable, fileCategoriesTable } from "@workspace/db";

const router: IRouter = Router();

const PUBLIC_CATEGORIES = ["Prescribed Information", "Parent Notices"];

router.get("/service-docs/public", async (_req, res): Promise<void> => {
  const cats = await db
    .select({ id: fileCategoriesTable.id, name: fileCategoriesTable.name, sortOrder: fileCategoriesTable.sortOrder })
    .from(fileCategoriesTable)
    .where(inArray(fileCategoriesTable.name, PUBLIC_CATEGORIES));

  if (cats.length === 0) {
    res.json({ sections: [] });
    return;
  }

  const catIds = cats.map((c) => c.id);
  const files = await db
    .select({
      id: fileLibraryTable.id,
      categoryId: fileLibraryTable.categoryId,
      name: fileLibraryTable.name,
      documentPath: fileLibraryTable.documentPath,
      documentName: fileLibraryTable.documentName,
      createdAt: fileLibraryTable.createdAt,
    })
    .from(fileLibraryTable)
    .where(inArray(fileLibraryTable.categoryId, catIds))
    .orderBy(fileLibraryTable.name);

  const sections = PUBLIC_CATEGORIES
    .map((catName) => {
      const cat = cats.find((c) => c.name === catName);
      if (!cat) return null;
      return {
        category: catName,
        items: files.filter((f) => f.categoryId === cat.id).map((f) => ({
          id: f.id,
          name: f.name,
          documentPath: f.documentPath,
          documentName: f.documentName,
          createdAt: f.createdAt,
        })),
      };
    })
    .filter(Boolean);

  res.json({ sections });
});

export default router;
