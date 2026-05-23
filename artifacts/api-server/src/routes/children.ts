import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, childrenTable, observationsTable, staffTable, outcomesTable, programsTable, childDocumentsTable } from "@workspace/db";
import {
  CreateChildBody,
  GetChildParams,
  GetChildResponse,
  UpdateChildParams,
  UpdateChildBody,
  UpdateChildResponse,
  DeleteChildParams,
  ListChildrenResponse,
  GetChildObservationsParams,
  GetChildObservationsResponse,
  ListChildDocumentsParams,
  ListChildDocumentsResponse,
  CreateChildDocumentParams,
  CreateChildDocumentBody,
  ListChildDocumentsResponseItem,
  DeleteChildDocumentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Normalise an incoming child payload from external systems.
// Handles snake_case keys and AU spelling variants ("enrolment") before Zod validation runs.
function normalizeChildPayload(body: unknown): unknown {
  if (typeof body !== "object" || body === null) return body;
  const raw = body as Record<string, unknown>;

  const keyMap: Record<string, string> = {
    first_name: "firstName",
    last_name: "lastName",
    date_of_birth: "dateOfBirth",
    dob: "dateOfBirth",
    birth_date: "dateOfBirth",
    enrollment_date: "enrollmentDate",
    enrolment_date: "enrollmentDate",
    start_date: "enrollmentDate",
    guardian_name: "guardianName",
    guardian_email: "guardianEmail",
    guardian_phone: "guardianPhone",
    medical_notes: "medicalNotes",
    site_id: "siteId",
    profile_picture_path: "profilePicturePath",
  };

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const mapped = keyMap[k.toLowerCase()] ?? k;
    out[mapped] = v;
  }

  return out;
}

router.get("/children", async (_req, res): Promise<void> => {
  const children = await db.select().from(childrenTable).orderBy(asc(childrenTable.firstName), asc(childrenTable.lastName));
  res.json(ListChildrenResponse.parse(children));
});

router.post("/children", async (req, res): Promise<void> => {
  const normalized = normalizeChildPayload(req.body);
  const parsed = CreateChildBody.safeParse(normalized);
  if (!parsed.success) {
    req.log.warn({ body: req.body, normalized, issues: parsed.error.issues }, "POST /children validation failed");
    res.status(400).json({ error: parsed.error.message, issues: parsed.error.issues });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [child] = await db.insert(childrenTable).values(parsed.data as any).returning();
  res.status(201).json(GetChildResponse.parse(child));
});

router.get("/children/:id", async (req, res): Promise<void> => {
  const params = GetChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, params.data.id));
  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.json(GetChildResponse.parse(child));
});

router.patch("/children/:id", async (req, res): Promise<void> => {
  const params = UpdateChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateChildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [child] = await db
    .update(childrenTable)
    .set(parsed.data as any)
    .where(eq(childrenTable.id, params.data.id))
    .returning();
  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.json(UpdateChildResponse.parse(child));
});

router.delete("/children/:id", async (req, res): Promise<void> => {
  const params = DeleteChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [child] = await db.delete(childrenTable).where(eq(childrenTable.id, params.data.id)).returning();
  if (!child) {
    res.status(404).json({ error: "Child not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/children/:id/documents", async (req, res): Promise<void> => {
  const params = ListChildDocumentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const docs = await db.select().from(childDocumentsTable).where(eq(childDocumentsTable.childId, params.data.id)).orderBy(childDocumentsTable.uploadedAt);
  res.json(ListChildDocumentsResponse.parse(docs));
});

router.post("/children/:id/documents", async (req, res): Promise<void> => {
  const params = CreateChildDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateChildDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [doc] = await db.insert(childDocumentsTable).values({ childId: params.data.id, ...parsed.data }).returning();
  res.status(201).json(ListChildDocumentsResponseItem.parse(doc));
});

router.delete("/children/:id/documents/:docId", async (req, res): Promise<void> => {
  const params = DeleteChildDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [doc] = await db.delete(childDocumentsTable).where(eq(childDocumentsTable.id, params.data.docId)).returning();
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  res.sendStatus(204);
});

router.get("/children/:id/observations", async (req, res): Promise<void> => {
  const params = GetChildObservationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const staffList = await db.select().from(staffTable);
  const childList = await db.select().from(childrenTable);
  const programList = await db.select().from(programsTable);

  const observations = await db
    .select()
    .from(observationsTable)
    .where(eq(observationsTable.childId, params.data.id))
    .orderBy(observationsTable.observationDate);

  const enriched = observations.map((obs) => {
    const child = childList.find((c) => c.id === obs.childId);
    const staff = staffList.find((s) => s.id === obs.staffId);
    const program = programList.find((p) => p.id === obs.programId);
    return {
      ...obs,
      childName: child ? `${child.firstName} ${child.lastName}` : null,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
      programName: program ? program.title : null,
    };
  });

  res.json(GetChildObservationsResponse.parse(enriched));
});

export default router;
