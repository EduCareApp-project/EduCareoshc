import { Router, type IRouter } from "express";
import { eq, inArray, asc } from "drizzle-orm";
import { Readable } from "stream";
import { db, fileLibraryTable, fileCategoriesTable, sitesTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

const objectStorageService = new ObjectStorageService();

const router: IRouter = Router();

const PUBLIC_CATEGORIES = ["Prescribed Information", "Parent Notices"];

router.get("/service-docs/public", async (req, res): Promise<void> => {
  const siteIdParam = req.query.siteId ? parseInt(req.query.siteId as string) : null;

  const cats = await db
    .select({ id: fileCategoriesTable.id, name: fileCategoriesTable.name })
    .from(fileCategoriesTable)
    .where(inArray(fileCategoriesTable.name, PUBLIC_CATEGORIES));

  if (cats.length === 0) {
    res.json({ sections: [], sites: [], siteName: null });
    return;
  }

  const catIds = cats.map((c) => c.id);

  const allFiles = await db
    .select({
      id: fileLibraryTable.id,
      categoryId: fileLibraryTable.categoryId,
      siteId: fileLibraryTable.siteId,
      name: fileLibraryTable.name,
      documentPath: fileLibraryTable.documentPath,
      documentName: fileLibraryTable.documentName,
      position: fileLibraryTable.position,
      createdAt: fileLibraryTable.createdAt,
    })
    .from(fileLibraryTable)
    .where(inArray(fileLibraryTable.categoryId, catIds))
    .orderBy(asc(fileLibraryTable.position), asc(fileLibraryTable.name));

  const siteIdsWithDocs = [...new Set(allFiles.map((f) => f.siteId).filter((id): id is number => id != null))];

  const siteRows = siteIdsWithDocs.length > 0
    ? await db.select({ id: sitesTable.id, name: sitesTable.name }).from(sitesTable).where(inArray(sitesTable.id, siteIdsWithDocs))
    : [];

  let siteName: string | null = null;
  if (siteIdParam) {
    siteName = siteRows.find((s) => s.id === siteIdParam)?.name ?? null;
    if (!siteName) {
      const [s] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, siteIdParam));
      siteName = s?.name ?? null;
    }
  }

  const files = siteIdParam
    ? allFiles.filter((f) => f.siteId === siteIdParam)
    : allFiles;

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
          position: f.position,
          createdAt: f.createdAt,
        })),
      };
    })
    .filter(Boolean);

  res.json({
    sections,
    sites: siteRows.sort((a, b) => a.name.localeCompare(b.name)),
    siteName,
  });
});

// Public file serving — streams a file_library item without requiring auth.
// Only files in the PUBLIC_CATEGORIES are accessible this way.
router.get("/service-docs/public/file/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [file] = await db
    .select({
      documentPath: fileLibraryTable.documentPath,
      categoryId: fileLibraryTable.categoryId,
    })
    .from(fileLibraryTable)
    .where(eq(fileLibraryTable.id, id))
    .limit(1);

  if (!file) { res.status(404).json({ error: "Not found" }); return; }

  const cats = await db
    .select({ id: fileCategoriesTable.id })
    .from(fileCategoriesTable)
    .where(inArray(fileCategoriesTable.name, PUBLIC_CATEGORIES));

  const publicCatIds = cats.map((c) => c.id);
  if (!publicCatIds.includes(file.categoryId!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const objectFile = await objectStorageService.getObjectEntityFile(file.documentPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch {
    res.status(404).json({ error: "File not found in storage" });
  }
});

export default router;
