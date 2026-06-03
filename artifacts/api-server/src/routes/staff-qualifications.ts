import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
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
  const rows = await db
    .select()
    .from(staffQualificationsTable)
    .where(eq(staffQualificationsTable.staffId, params.data.id))
    .orderBy(staffQualificationsTable.createdAt);
  const withDocs = await attachDocuments(rows);
  res.json(GetStaffQualificationsResponse.parse(withDocs));
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
});

router.delete("/qualification-documents/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db
    .delete(qualificationDocumentsTable)
    .where(eq(qualificationDocumentsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Document not found" }); return; }
  res.sendStatus(204);
});

router.patch("/qualifications/:id/archive", async (req, res): Promise<void> => {
  const params = ArchiveStaffQualificationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db
    .update(staffQualificationsTable)
    .set({ archivedAt: new Date() as any })
    .where(eq(staffQualificationsTable.id, params.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Qualification not found" }); return; }
  const [withDocs] = await attachDocuments([row]);
  res.json(withDocs);
});

router.delete("/qualifications/:id", async (req, res): Promise<void> => {
  const params = ArchiveStaffQualificationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [row] = await db
    .delete(staffQualificationsTable)
    .where(eq(staffQualificationsTable.id, params.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Qualification not found" }); return; }
  res.sendStatus(204);
});

export default router;
