import { Router, type IRouter } from "express";
import { eq, inArray, isNull, and } from "drizzle-orm";
import { db, staffQualificationsTable, qualificationDocumentsTable } from "@workspace/db";
import {
  GetStaffQualificationsParams,
  GetStaffQualificationsResponse,
  CreateStaffQualificationParams,
  CreateStaffQualificationBody,
  UpdateStaffQualificationParams,
  UpdateStaffQualificationBody,
  ArchiveStaffQualificationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function isOnboarding(req: { session?: { user?: { role?: string; id?: number } } }): boolean {
  return req.session?.user?.role === "onboarding";
}

router.use((req, res, next) => {
  if (isOnboarding(req) && req.method !== "GET") {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  next();
});

async function attachDocuments(quals: (typeof staffQualificationsTable.$inferSelect)[]) {
  if (quals.length === 0) return quals.map((q) => ({ ...q, documents: [] }));
  const ids = quals.map((q) => q.id);
  const docs = await db
    .select()
    .from(qualificationDocumentsTable)
    .where(inArray(qualificationDocumentsTable.qualificationId, ids))
    .orderBy(qualificationDocumentsTable.uploadedAt);
  const byQualId = new Map<number, typeof docs>();
  for (const doc of docs) {
    if (!byQualId.has(doc.qualificationId)) byQualId.set(doc.qualificationId, []);
    byQualId.get(doc.qualificationId)!.push(doc);
  }
  return quals.map((q) => ({ ...q, documents: byQualId.get(q.id) ?? [] }));
}

router.get("/staff/:id/qualifications", async (req, res): Promise<void> => {
  const params = GetStaffQualificationsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (isOnboarding(req) && params.data.id !== req.session.user?.id) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(staffQualificationsTable)
      .where(eq(staffQualificationsTable.staffId, params.data.id))
      .orderBy(staffQualificationsTable.createdAt);
    const withDocs = await attachDocuments(rows);
    res.json(GetStaffQualificationsResponse.parse(withDocs));
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to fetch qualifications");
    res.status(500).json({ error: "Failed to fetch qualifications" });
  }
});

router.post("/staff/:id/qualifications", async (req, res): Promise<void> => {
  const params = CreateStaffQualificationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateStaffQualificationBody.safeParse({ ...req.body, staffId: params.data.id });
  if (!parsed.success) {
    req.log.warn({ body: req.body, issues: parsed.error.issues }, "POST qualification validation failed");
    res.status(400).json({ error: parsed.error.message, issues: parsed.error.issues });
    return;
  }
  try {
    const { documentName, ...qualData } = parsed.data as any;
    const [row] = await db.insert(staffQualificationsTable).values(qualData as any).returning();
    if (row.documentPath) {
      await db.insert(qualificationDocumentsTable).values({
        qualificationId: row.id,
        documentPath: row.documentPath,
        documentName: documentName ?? row.documentPath.split("/").pop() ?? null,
        active: true,
      });
    }
    const [withDocs] = await attachDocuments([row]);
    res.status(201).json(withDocs);
  } catch (err) {
    req.log.error({ err, staffId: params.data.id }, "Failed to create qualification");
    res.status(500).json({ error: "Failed to create qualification" });
  }
});

router.patch("/qualifications/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffQualificationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateStaffQualificationBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ body: req.body, issues: parsed.error.issues }, "PATCH qualification validation failed");
    res.status(400).json({ error: parsed.error.message, issues: parsed.error.issues });
    return;
  }

  try {
    const existing = await db.select().from(staffQualificationsTable).where(eq(staffQualificationsTable.id, params.data.id));
    if (!existing[0]) { res.status(404).json({ error: "Qualification not found" }); return; }

    const { documentName, ...updateData } = parsed.data as any;
    const newDocPath: string | undefined = updateData.documentPath;
    const oldDocPath = existing[0].documentPath;

    const [row] = await db
      .update(staffQualificationsTable)
      .set(updateData as any)
      .where(eq(staffQualificationsTable.id, params.data.id))
      .returning();

    if (newDocPath && newDocPath !== oldDocPath) {
      await db
        .update(qualificationDocumentsTable)
        .set({ active: false })
        .where(eq(qualificationDocumentsTable.qualificationId, params.data.id));
      await db.insert(qualificationDocumentsTable).values({
        qualificationId: params.data.id,
        documentPath: newDocPath,
        documentName: documentName ?? newDocPath.split("/").pop() ?? null,
        active: true,
      });
    }

    const [withDocs] = await attachDocuments([row]);
    res.json(withDocs);
  } catch (err) {
    req.log.error({ err, qualificationId: params.data.id }, "Failed to update qualification");
    res.status(500).json({ error: "Failed to update qualification" });
  }
});

router.delete("/qualification-documents/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [row] = await db
      .delete(qualificationDocumentsTable)
      .where(eq(qualificationDocumentsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Document not found" }); return; }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, documentId: id }, "Failed to delete qualification document");
    res.status(500).json({ error: "Failed to delete qualification document" });
  }
});

router.patch("/qualifications/:id/archive", async (req, res): Promise<void> => {
  const params = ArchiveStaffQualificationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  try {
    // Check the record exists before attempting the update
    const existing = await db
      .select()
      .from(staffQualificationsTable)
      .where(eq(staffQualificationsTable.id, params.data.id));
    if (!existing[0]) { res.status(404).json({ error: "Qualification not found" }); return; }

    const [row] = await db
      .update(staffQualificationsTable)
      .set({ archivedAt: new Date() })
      .where(and(
        eq(staffQualificationsTable.id, params.data.id),
        isNull(staffQualificationsTable.archivedAt),
      ))
      .returning();

    // If row is undefined the record was already archived — fetch and return it as-is
    const result = row ?? existing[0];
    const [withDocs] = await attachDocuments([result]);
    res.json(withDocs);
  } catch (err) {
    req.log.error({ err, qualificationId: params.data.id }, "Failed to archive qualification");
    res.status(500).json({ error: "Failed to archive qualification" });
  }
});

router.delete("/qualifications/:id", async (req, res): Promise<void> => {
  const params = ArchiveStaffQualificationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const [row] = await db
      .delete(staffQualificationsTable)
      .where(eq(staffQualificationsTable.id, params.data.id))
      .returning();
    if (!row) { res.status(404).json({ error: "Qualification not found" }); return; }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, qualificationId: params.data.id }, "Failed to delete qualification");
    res.status(500).json({ error: "Failed to delete qualification" });
  }
});

export default router;
