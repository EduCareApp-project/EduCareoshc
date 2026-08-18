import { Router, type IRouter } from "express";
import { and, eq, inArray, isNotNull, asc } from "drizzle-orm";
import { Readable } from "stream";
import { db, fileLibraryTable, fileCategoriesTable, sitesTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";

const objectStorageService = new ObjectStorageService();

const router: IRouter = Router();

function buildFileErrorPage(title: string, message: string, code: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — EduCare</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f9fafb;
      color: #111827;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 1rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      max-width: 440px;
      width: 100%;
      padding: 2.5rem 2rem;
      text-align: center;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #fef2f2;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
    }
    .icon svg { width: 28px; height: 28px; color: #ef4444; }
    h1 { font-size: 1.125rem; font-weight: 700; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #6b7280; line-height: 1.6; margin-bottom: 1.5rem; }
    .code { font-size: 0.75rem; color: #9ca3af; margin-bottom: 1.5rem; }
    .btn {
      display: inline-block;
      padding: 0.5rem 1.25rem;
      background: #111827;
      color: #fff;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
    }
    .btn:hover { background: #1f2937; }
    .brand {
      margin-top: 2rem;
      font-size: 0.75rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="code">Error ${code}</p>
    <a class="btn" onclick="window.close()" href="javascript:void(0)">Close this tab</a>
    <p class="brand">EduCare Service Documentation</p>
  </div>
</body>
</html>`;
}

const PUBLIC_CATEGORIES = ["Prescribed Information", "Parent Notices", "Policies and Procedures"];

// Default site when none is specified in the URL — Aldercourt (id=1)
const DEFAULT_SITE_ID = 1;

router.get("/service-docs/public", async (req, res): Promise<void> => {
  // Always lock to a single site — default to Aldercourt if not specified
  const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : DEFAULT_SITE_ID;
  if (isNaN(siteId)) {
    res.status(400).json({ error: "Invalid siteId" });
    return;
  }

  try {
    const [siteRow] = await db
      .select({ name: sitesTable.name })
      .from(sitesTable)
      .where(eq(sitesTable.id, siteId));

    const cats = await db
      .select({ id: fileCategoriesTable.id, name: fileCategoriesTable.name })
      .from(fileCategoriesTable)
      .where(inArray(fileCategoriesTable.name, PUBLIC_CATEGORIES));

    if (cats.length === 0) {
      res.json({ sections: [], siteName: siteRow?.name ?? null });
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
        position: fileLibraryTable.position,
        createdAt: fileLibraryTable.createdAt,
      })
      .from(fileLibraryTable)
      // Both conditions required — only public-category docs for this site
      .where(and(inArray(fileLibraryTable.categoryId, catIds), eq(fileLibraryTable.siteId, siteId)))
      .orderBy(asc(fileLibraryTable.position), asc(fileLibraryTable.name));

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

    // Never expose the sites list — each page is locked to one site
    res.json({ sections, siteName: siteRow?.name ?? null });
  } catch (err) {
    req.log.error({ err, siteId }, "Failed to fetch public service docs");
    res.status(500).json({ error: "Failed to fetch public service docs" });
  }
});

// Protected: list all service-doc items (siteId IS NOT NULL) for the manage page
router.get("/service-docs", async (req, res): Promise<void> => {
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
      .where(isNotNull(fileLibraryTable.siteId))
      .orderBy(asc(fileCategoriesTable.sortOrder), asc(fileLibraryTable.position), asc(fileLibraryTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch service docs");
    res.status(500).json({ error: "Failed to fetch service docs" });
  }
});

// Public file serving — streams a file_library item without requiring auth.
// Only files in the PUBLIC_CATEGORIES are accessible this way.
router.get("/service-docs/public/file/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [file] = await db
      .select({
        documentPath: fileLibraryTable.documentPath,
        categoryId: fileLibraryTable.categoryId,
      })
      .from(fileLibraryTable)
      .where(eq(fileLibraryTable.id, id))
      .limit(1);

    if (!file) {
      res.status(404).type("html").send(buildFileErrorPage(
        "Document not found",
        "This document link is no longer valid. It may have been removed or the link may be incorrect.",
        404,
      ));
      return;
    }

    const cats = await db
      .select({ id: fileCategoriesTable.id })
      .from(fileCategoriesTable)
      .where(inArray(fileCategoriesTable.name, PUBLIC_CATEGORIES));

    const publicCatIds = cats.map((c) => c.id);
    if (!publicCatIds.includes(file.categoryId!)) {
      res.status(403).type("html").send(buildFileErrorPage(
        "Access denied",
        "This document is not publicly accessible.",
        403,
      ));
      return;
    }

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
  } catch (err: any) {
    if (err?.name === "ObjectNotFoundError" || err?.constructor?.name === "ObjectNotFoundError") {
      res.status(404).type("html").send(buildFileErrorPage(
        "File unavailable",
        "This document's file could not be found. It may have been deleted or moved. Please contact the service for assistance.",
        404,
      ));
    } else {
      req.log.error({ err, fileId: id }, "Failed to serve public service doc file");
      res.status(500).type("html").send(buildFileErrorPage(
        "Something went wrong",
        "We were unable to load this document right now. Please try again later.",
        500,
      ));
    }
  }
});

export default router;
