import { Router, type IRouter } from "express";
import { eq, asc, inArray, and, isNotNull } from "drizzle-orm";
import { db, childrenTable, observationsTable, staffTable, outcomesTable, programsTable, childDocumentsTable, childMedicationsTable } from "@workspace/db";
import {
  CreateChildBody,
  GetChildParams,
  GetChildResponse,
  GetChildMedicalPlansPrintParams,
  GetChildMedicalPlansPrintResponse,
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

router.get("/children", async (req, res): Promise<void> => {
  try {
    const children = await db.select().from(childrenTable).orderBy(asc(childrenTable.firstName), asc(childrenTable.lastName));
    const medRows = children.length
      ? await db.selectDistinct({ childId: childMedicationsTable.childId })
          .from(childMedicationsTable)
          .where(inArray(childMedicationsTable.childId, children.map((c) => c.id)))
      : [];
    const medChildIds = new Set(medRows.map((r) => r.childId));
    const result = children.map((c) => ({ ...c, hasMedications: medChildIds.has(c.id) }));
    res.json(ListChildrenResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to list children");
    res.status(500).json({ error: "Failed to list children" });
  }
});

router.post("/children", async (req, res): Promise<void> => {
  const normalized = normalizeChildPayload(req.body);
  const parsed = CreateChildBody.safeParse(normalized);
  if (!parsed.success) {
    req.log.warn({ body: req.body, normalized, issues: parsed.error.issues }, "POST /children validation failed");
    res.status(400).json({ error: parsed.error.message, issues: parsed.error.issues });
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [child] = await db.insert(childrenTable).values({
      ...parsed.data, organisationId: res.locals.organisationId,
    } as any).returning();
    res.status(201).json(GetChildResponse.parse(child));
  } catch (err) {
    req.log.error({ err }, "Failed to create child");
    res.status(500).json({ error: "Failed to create child" });
  }
});

router.get("/children/:id", async (req, res): Promise<void> => {
  const params = GetChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, params.data.id));
    if (!child) {
      res.status(404).json({ error: "Child not found" });
      return;
    }
    res.json(GetChildResponse.parse(child));
  } catch (err) {
    req.log.error({ err, childId: params.data.id }, "Failed to fetch child");
    res.status(500).json({ error: "Failed to fetch child" });
  }
});

// Print data is deliberately a separate, staff-only endpoint. Do not reuse the
// broad child profile response here: this route is opened in a new tab and must
// never expose medical plans to guardian sessions by an arbitrary child ID.
router.get("/children/:id/medical-plans/print", async (req, res): Promise<void> => {
  if (!req.session.user || req.session.user.type !== "staff") {
    res.status(403).json({ error: "Staff access required" });
    return;
  }

  const params = GetChildMedicalPlansPrintParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const [child] = await db
      .select({
        id: childrenTable.id,
        firstName: childrenTable.firstName,
        lastName: childrenTable.lastName,
        hasMedicalCondition: childrenTable.hasMedicalCondition,
        medicalRiskPlan: childrenTable.medicalRiskPlan,
        communicationPlan: childrenTable.communicationPlan,
      })
      .from(childrenTable)
      .where(eq(childrenTable.id, params.data.id));
    if (!child) {
      res.status(404).json({ error: "Child not found" });
      return;
    }
    res.json(GetChildMedicalPlansPrintResponse.parse(child));
  } catch (err) {
    req.log.error({ err, childId: params.data.id }, "Failed to fetch medical plan print data");
    res.status(500).json({ error: "Failed to fetch medical plans" });
  }
});

router.patch("/children/:id", async (req, res): Promise<void> => {
  const params = UpdateChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateChildBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ body: req.body, issues: parsed.error.issues }, "PATCH /children/:id validation failed");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "No supported child fields were provided." });
    return;
  }
  req.log.info({ id: params.data.id, body: req.body, parsedKeys: Object.keys(parsed.data) }, "PATCH /children/:id");
  try {
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
    req.log.info({ id: params.data.id, hasMedicalCondition: child.hasMedicalCondition }, "PATCH /children/:id result");
    res.json(UpdateChildResponse.parse(child));
  } catch (err) {
    req.log.error({ err, childId: params.data.id }, "Failed to update child");
    res.status(500).json({ error: "Failed to update child" });
  }
});

router.delete("/children/:id", async (req, res): Promise<void> => {
  const params = DeleteChildParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [child] = await db.delete(childrenTable).where(eq(childrenTable.id, params.data.id)).returning();
    if (!child) {
      res.status(404).json({ error: "Child not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, childId: params.data.id }, "Failed to delete child");
    res.status(500).json({ error: "Failed to delete child" });
  }
});

router.get("/children/:id/documents", async (req, res): Promise<void> => {
  const params = ListChildDocumentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const docs = await db.select().from(childDocumentsTable).where(eq(childDocumentsTable.childId, params.data.id)).orderBy(childDocumentsTable.uploadedAt);
    res.json(ListChildDocumentsResponse.parse(docs));
  } catch (err) {
    req.log.error({ err, childId: params.data.id }, "Failed to list child documents");
    res.status(500).json({ error: "Failed to list child documents" });
  }
});

router.post("/children/:id/documents", async (req, res): Promise<void> => {
  const params = CreateChildDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateChildDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [doc] = await db.insert(childDocumentsTable).values({ childId: params.data.id, ...parsed.data }).returning();
    res.status(201).json(ListChildDocumentsResponseItem.parse(doc));
  } catch (err) {
    req.log.error({ err, childId: params.data.id }, "Failed to create child document");
    res.status(500).json({ error: "Failed to create child document" });
  }
});

router.delete("/children/:id/documents/:docId", async (req, res): Promise<void> => {
  const params = DeleteChildDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const [doc] = await db.delete(childDocumentsTable).where(eq(childDocumentsTable.id, params.data.docId)).returning();
    if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, docId: params.data.docId }, "Failed to delete child document");
    res.status(500).json({ error: "Failed to delete child document" });
  }
});

router.get("/children/:id/observations", async (req, res): Promise<void> => {
  const params = GetChildObservationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const staffList = await db.select().from(staffTable);
    const childList = await db.select().from(childrenTable);
    const programList = await db.select().from(programsTable);

    const observations = await db
      .select()
      .from(observationsTable)
      .where(and(
        eq(observationsTable.childId, params.data.id),
        isNotNull(observationsTable.publishedAt),
      ))
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
  } catch (err) {
    req.log.error({ err, childId: params.data.id }, "Failed to fetch child observations");
    res.status(500).json({ error: "Failed to fetch child observations" });
  }
});

export default router;
