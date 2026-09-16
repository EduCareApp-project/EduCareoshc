import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  documentMergeUploadsTable,
  emailSettingsTable,
  excursionsTable,
  mergedDocumentsTable,
  organisationTable,
  staffTable,
} from "@workspace/db";
import {
  DeleteMergedDocumentParams,
  DeleteMergedDocumentResponse,
  DownloadMergedDocumentParams,
  GenerateExcursionFormBody,
  ListExcursionFormManagersResponse,
  ListMergedDocumentsResponse,
  ListMergedDocumentsResponseItem,
  MergeDocumentsBody,
  RequestDocumentMergeUploadUrlBody,
  RequestDocumentMergeUploadUrlResponse,
  ViewMergedDocumentParams,
} from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import {
  DOCUMENT_MERGE_CONTENT_TYPES,
  mergeDocumentSources,
  type DocumentMergeContentType,
} from "../lib/documentMerge";
import { generateExcursionFormPdf } from "../lib/excursionFormPdf";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_TOTAL_SOURCE_BYTES = 100 * 1024 * 1024;

function requireStaff(req: Request, res: Response): number | null {
  const user = req.session.user;
  if (!user || user.type !== "staff") {
    res.status(403).json({ error: "Staff access required" });
    return null;
  }
  return user.id;
}

function hasMatchingExtension(name: string, contentType: DocumentMergeContentType): boolean {
  const lowerName = name.toLowerCase();
  if (contentType === "application/pdf") return lowerName.endsWith(".pdf");
  if (contentType === "image/jpeg") return lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");
  return lowerName.endsWith(".png");
}

function mergedDocumentName(sourceNames: string[]): string {
  const firstName = sourceNames[0]?.replace(/\.[^.]+$/, "").trim() || "Merged document";
  const safeFirstName = firstName.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  return sourceNames.length === 2
    ? `${safeFirstName} + 1 more.pdf`
    : `${safeFirstName} + ${sourceNames.length - 1} more.pdf`;
}

function fileNameForHeader(name: string): string {
  return name.replace(/["\r\n]/g, "").slice(0, 160) || "merged-document.pdf";
}

function canAccessExcursionSite(req: Request, siteId: number): boolean {
  const user = req.session.user;
  return user?.type === "staff"
    && (
      user.role === "admin"
      || user.role === "admin_support"
      || (user.role === "educational_leader" && user.siteId === siteId)
    );
}

router.get("/ai-tools/excursion-form/managers", async (req, res): Promise<void> => {
  const staffId = requireStaff(req, res);
  if (staffId == null) return;
  try {
    const managers = await db.select({
      id: staffTable.id,
      firstName: staffTable.firstName,
      lastName: staffTable.lastName,
      role: staffTable.role,
      phone: staffTable.phone,
      email: staffTable.email,
    }).from(staffTable).where(and(
      eq(staffTable.status, "active"),
      inArray(staffTable.role, ["admin", "admin_support", "educational_leader"]),
    ));
    managers.sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    );
    res.json(ListExcursionFormManagersResponse.parse(managers));
  } catch (err) {
    req.log.error({ err, staffId }, "Failed to list excursion form managers");
    res.status(500).json({ error: "Failed to load managers" });
  }
});

router.post("/ai-tools/excursion-form/generate", async (req, res): Promise<void> => {
  const staffId = requireStaff(req, res);
  if (staffId == null) return;
  const parsed = GenerateExcursionFormBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a published excursion and valid form options" });
    return;
  }

  try {
    const [excursion] = await db.select().from(excursionsTable)
      .where(eq(excursionsTable.id, parsed.data.excursionId))
      .limit(1);
    if (!excursion || excursion.status !== "sent") {
      res.status(400).json({ error: "Only published excursions can be used to generate a form" });
      return;
    }
    if (!canAccessExcursionSite(req, excursion.siteId)) {
      res.status(403).json({ error: "You do not have access to this excursion" });
      return;
    }

    let manager: typeof staffTable.$inferSelect | undefined;
    if (parsed.data.managerId != null) {
      [manager] = await db.select().from(staffTable)
        .where(and(
          eq(staffTable.id, parsed.data.managerId),
          eq(staffTable.status, "active"),
        ))
        .limit(1);
      if (!manager || !["admin", "admin_support", "educational_leader"].includes(manager.role)) {
        res.status(400).json({ error: "Select an active Admin, Admin Support, or Educational Leader" });
        return;
      }
    }
    const managerName = parsed.data.managerName?.trim()
      || (manager ? `${manager.firstName} ${manager.lastName}` : "");
    const managerPhone = parsed.data.managerPhone?.trim() || manager?.phone?.trim() || "";
    const managerEmail = parsed.data.managerEmail?.trim() || manager?.email?.trim() || "";
    if (parsed.data.includeManager && !managerName) {
      res.status(400).json({ error: "Enter the manager's name" });
      return;
    }
    if (parsed.data.includeManagerContact && (!managerPhone || !managerEmail)) {
      res.status(400).json({ error: "Enter the manager's phone and email" });
      return;
    }

    const [[organisation], [settings]] = await Promise.all([
      db.select().from(organisationTable).limit(1),
      db.select({ companyLogoPath: emailSettingsTable.companyLogoPath }).from(emailSettingsTable).limit(1),
    ]);
    if (!settings?.companyLogoPath) {
      res.status(400).json({ error: "Upload a company logo in Brand Kit before generating the form" });
      return;
    }
    const logoFile = await objectStorageService.getObjectEntityFile(settings.companyLogoPath);
    const [companyLogoBytes] = await logoFile.download();
    const pdf = await generateExcursionFormPdf({
      organisationName: organisation?.name || "OSHC Service",
      servicePhone: organisation?.servicePhone,
      serviceEmail: organisation?.serviceEmail,
      managerName,
      managerPhone,
      managerEmail,
      includeManager: parsed.data.includeManager,
      includeManagerContact: parsed.data.includeManagerContact,
      includeServiceContact: parsed.data.includeServiceContact,
      companyLogoBytes,
      excursion,
    });
    const safeHeading = excursion.heading.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80) || "Excursion";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileNameForHeader(`${safeHeading} Permission Form.pdf`)}"`);
    res.send(Buffer.from(pdf));
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "The uploaded company logo could not be found. Upload it again in Brand Kit." });
      return;
    }
    req.log.error({ err, staffId, excursionId: parsed.data.excursionId }, "Failed to generate excursion permission form");
    res.status(500).json({ error: "Failed to generate excursion permission form" });
  }
});

router.post("/ai-tools/document-merge/upload-url", async (req, res): Promise<void> => {
  const staffId = requireStaff(req, res);
  if (staffId == null) return;

  const parsed = RequestDocumentMergeUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a PDF, JPEG, or PNG file up to 25 MB" });
    return;
  }

  const { name, size, contentType } = parsed.data;
  if (
    !DOCUMENT_MERGE_CONTENT_TYPES.includes(contentType)
    || !hasMatchingExtension(name, contentType)
  ) {
    res.status(400).json({ error: "The filename and file type do not match a supported PDF, JPEG, or PNG file" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    await db.insert(documentMergeUploadsTable).values({
      staffId,
      objectPath,
      originalName: name,
      contentType,
      sizeBytes: size,
    });

    res.json(RequestDocumentMergeUploadUrlResponse.parse({
      uploadURL,
      objectPath,
      name,
      contentType,
    }));
  } catch (err) {
    req.log.error({ err, staffId }, "Failed to prepare document merge upload");
    res.status(500).json({ error: "Failed to prepare document upload" });
  }
});

router.get("/ai-tools/document-merges", async (req, res): Promise<void> => {
  const staffId = requireStaff(req, res);
  if (staffId == null) return;

  try {
    const rows = await db.select({
      id: mergedDocumentsTable.id,
      name: mergedDocumentsTable.name,
      sourceNames: mergedDocumentsTable.sourceNames,
      pageCount: mergedDocumentsTable.pageCount,
      createdAt: mergedDocumentsTable.createdAt,
    })
      .from(mergedDocumentsTable)
      .where(eq(mergedDocumentsTable.staffId, staffId))
      .orderBy(desc(mergedDocumentsTable.createdAt));

    res.json(ListMergedDocumentsResponse.parse(rows));
  } catch (err) {
    req.log.error({ err, staffId }, "Failed to list merged documents");
    res.status(500).json({ error: "Failed to list merged documents" });
  }
});

router.post("/ai-tools/document-merges/merge", async (req, res): Promise<void> => {
  const staffId = requireStaff(req, res);
  if (staffId == null) return;

  const parsed = MergeDocumentsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Select between 2 and 20 documents to merge" });
    return;
  }

  const requestedPaths = parsed.data.files.map((file) => file.objectPath);
  if (
    new Set(requestedPaths).size !== requestedPaths.length
    || requestedPaths.some((path) => !path.startsWith("/objects/") || path.includes(".."))
  ) {
    res.status(400).json({ error: "Each selected document must be a unique uploaded file" });
    return;
  }

  let mergedObjectPath: string | null = null;

  try {
    const uploadRows = await db.select()
      .from(documentMergeUploadsTable)
      .where(and(
        eq(documentMergeUploadsTable.staffId, staffId),
        inArray(documentMergeUploadsTable.objectPath, requestedPaths),
      ));
    const byPath = new Map(uploadRows.map((row) => [row.objectPath, row]));
    const orderedRows = requestedPaths.map((path) => byPath.get(path));

    if (orderedRows.some((row) => !row)) {
      res.status(400).json({ error: "One or more uploaded documents are unavailable" });
      return;
    }

    const ownedRows = orderedRows as typeof uploadRows;
    const totalBytes = ownedRows.reduce((sum, row) => sum + row.sizeBytes, 0);
    if (totalBytes > MAX_TOTAL_SOURCE_BYTES) {
      res.status(400).json({ error: "The selected documents exceed the 100 MB merge limit" });
      return;
    }

    const sources = await Promise.all(ownedRows.map(async (row) => {
      const file = await objectStorageService.getObjectEntityFile(row.objectPath);
      const [bytes] = await file.download();
      return {
        name: row.originalName,
        contentType: row.contentType as DocumentMergeContentType,
        bytes,
      };
    }));
    const merged = await mergeDocumentSources(sources);
    const outputUploadURL = await objectStorageService.getObjectEntityUploadURL();
    mergedObjectPath = objectStorageService.normalizeObjectEntityPath(outputUploadURL);
    const uploadResponse = await fetch(outputUploadURL, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.from(merged.bytes),
    });
    if (!uploadResponse.ok) {
      throw new Error(`Merged PDF upload failed with status ${uploadResponse.status}`);
    }

    const sourceNames = ownedRows.map((row) => row.originalName);
    const [document] = await db.insert(mergedDocumentsTable).values({
      staffId,
      name: mergedDocumentName(sourceNames),
      sourceNames,
      pageCount: merged.pageCount,
      objectPath: mergedObjectPath,
    }).returning();

    const cleanupResults = await Promise.allSettled(ownedRows.map(async (row) => {
      const file = await objectStorageService.getObjectEntityFile(row.objectPath);
      await file.delete();
    }));
    const cleanupFailures = cleanupResults.filter((result) => result.status === "rejected").length;
    if (cleanupFailures > 0) {
      req.log.warn({ staffId, cleanupFailures }, "Some document merge source files could not be removed");
    }
    await db.delete(documentMergeUploadsTable).where(inArray(
      documentMergeUploadsTable.id,
      ownedRows.map((row) => row.id),
    ));

    res.status(201).json(ListMergedDocumentsResponseItem.parse(document));
  } catch (err) {
    if (mergedObjectPath) {
      try {
        const file = await objectStorageService.getObjectEntityFile(mergedObjectPath);
        await file.delete();
      } catch {
        // The database write or upload failed; best-effort cleanup avoids masking the original error.
      }
    }
    req.log.error({ err, staffId }, "Failed to merge documents");
    res.status(400).json({ error: "The documents could not be merged. Check that each PDF or image is valid and try again." });
  }
});

async function sendMergedDocument(
  req: Request,
  res: Response,
  id: number,
  disposition: "inline" | "attachment",
): Promise<void> {
  const staffId = requireStaff(req, res);
  if (staffId == null) return;

  try {
    const [document] = await db.select()
      .from(mergedDocumentsTable)
      .where(and(
        eq(mergedDocumentsTable.id, id),
        eq(mergedDocumentsTable.staffId, staffId),
      ))
      .limit(1);
    if (!document) {
      res.status(404).json({ error: "Merged document not found" });
      return;
    }

    const file = await objectStorageService.getObjectEntityFile(document.objectPath);
    const response = await objectStorageService.downloadObject(file, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${fileNameForHeader(document.name)}"`);

    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Merged document file not found" });
      return;
    }
    req.log.error({ err, staffId, documentId: id }, "Failed to serve merged document");
    res.status(500).json({ error: "Failed to open merged document" });
  }
}

router.get("/ai-tools/document-merges/:id/view", async (req, res): Promise<void> => {
  const parsed = ViewMergedDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  await sendMergedDocument(req, res, parsed.data.id, "inline");
});

router.get("/ai-tools/document-merges/:id/download", async (req, res): Promise<void> => {
  const parsed = DownloadMergedDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  await sendMergedDocument(req, res, parsed.data.id, "attachment");
});

router.delete("/ai-tools/document-merges/:id", async (req, res): Promise<void> => {
  const staffId = requireStaff(req, res);
  if (staffId == null) return;

  const parsed = DeleteMergedDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  try {
    const [document] = await db.select()
      .from(mergedDocumentsTable)
      .where(and(
        eq(mergedDocumentsTable.id, parsed.data.id),
        eq(mergedDocumentsTable.staffId, staffId),
      ))
      .limit(1);
    if (!document) {
      res.status(404).json({ error: "Merged document not found" });
      return;
    }

    try {
      const file = await objectStorageService.getObjectEntityFile(document.objectPath);
      await file.delete();
    } catch (err) {
      if (!(err instanceof ObjectNotFoundError)) throw err;
    }

    await db.delete(mergedDocumentsTable).where(and(
      eq(mergedDocumentsTable.id, parsed.data.id),
      eq(mergedDocumentsTable.staffId, staffId),
    ));
    res.json(DeleteMergedDocumentResponse.parse({ ok: true }));
  } catch (err) {
    req.log.error({ err, staffId, documentId: parsed.data.id }, "Failed to delete merged document");
    res.status(500).json({ error: "Failed to delete merged document" });
  }
});

export default router;