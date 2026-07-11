import { Router, type IRouter } from "express";
import { createNotification } from "../lib/notify";
import { logger } from "../lib/logger";
import { eq, desc, and } from "drizzle-orm";
import { db, staffAppraisalsTable, appraisalGoalNotesTable, staffTable } from "@workspace/db";

const EDUCATOR_ROLES = ["educator", "coordinator"] as const;

const router: IRouter = Router();

async function buildStaffMap() {
  const rows = await db
    .select({ id: staffTable.id, firstName: staffTable.firstName, lastName: staffTable.lastName, role: staffTable.role })
    .from(staffTable);
  return new Map(rows.map((s) => [s.id, s]));
}

function enrichAppraisal(row: typeof staffAppraisalsTable.$inferSelect, staffMap: Map<number, { id: number; firstName: string; lastName: string; role: string }>) {
  const staff = staffMap.get(row.staffId);
  const reviewer = row.reviewerId ? staffMap.get(row.reviewerId) : null;
  return {
    ...row,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : String(row.staffId),
    reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
  };
}

// ─── List ────────────────────────────────────────────────────────────────────

router.get("/appraisals", async (req, res): Promise<void> => {
  const staffIdParam = req.query.staffId ? Number(req.query.staffId) : undefined;
  const user = req.session?.user;
  const isEduRole = user && EDUCATOR_ROLES.includes(user.role as (typeof EDUCATOR_ROLES)[number]);

  let rows = await db.select().from(staffAppraisalsTable).orderBy(desc(staffAppraisalsTable.createdAt));

  if (isEduRole && user) {
    // Educators and coordinators can only see their own appraisals
    rows = rows.filter((r) => r.staffId === user.id);
  } else if (staffIdParam) {
    rows = rows.filter((r) => r.staffId === staffIdParam);
  }

  const staffMap = await buildStaffMap();
  res.json(rows.map((r) => enrichAppraisal(r, staffMap)));
});

// ─── Create ───────────────────────────────────────────────────────────────────

router.post("/appraisals", async (req, res): Promise<void> => {
  const { type, staffId, reviewerId, dueDate, absencesCount } = req.body ?? {};
  if (!staffId || !dueDate) {
    res.status(400).json({ error: "staffId and dueDate are required" });
    return;
  }
  const createdBy = req.session?.user?.id ?? null;
  const [row] = await db
    .insert(staffAppraisalsTable)
    .values({
      type: type ?? "educator_appraisal",
      staffId: Number(staffId),
      reviewerId: reviewerId ? Number(reviewerId) : null,
      createdBy: createdBy ? Number(createdBy) : null,
      dueDate: String(dueDate),
      absencesCount: absencesCount != null ? Number(absencesCount) : null,
      status: "stage1",
    } as any)
    .returning();
  const staffMap = await buildStaffMap();
  res.status(201).json(enrichAppraisal(row, staffMap));
});

// ─── Get single ───────────────────────────────────────────────────────────────

router.get("/appraisals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const user = req.session?.user;
  const isEduRole = user && EDUCATOR_ROLES.includes(user.role as (typeof EDUCATOR_ROLES)[number]);
  const [row] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!row) { res.status(404).json({ error: "Appraisal not found" }); return; }
  if (isEduRole && user && row.staffId !== user.id) {
    res.status(403).json({ error: "Not permitted" }); return;
  }
  const staffMap = await buildStaffMap();
  res.json(enrichAppraisal(row, staffMap));
});

// ─── Update general fields ────────────────────────────────────────────────────

router.patch("/appraisals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const update: Record<string, unknown> = { updatedAt: new Date() };
  const allowed = ["reviewerId", "dueDate", "absencesCount"] as const;
  for (const f of allowed) {
    if (req.body?.[f] !== undefined) {
      update[f] = f === "reviewerId" && req.body[f] ? Number(req.body[f]) : req.body[f] === "" ? null : req.body[f];
    }
  }
  const [row] = await db.update(staffAppraisalsTable).set(update as any).where(eq(staffAppraisalsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Appraisal not found" }); return; }
  const staffMap = await buildStaffMap();
  res.json(enrichAppraisal(row, staffMap));
});

// ─── Delete ───────────────────────────────────────────────────────────────────

router.delete("/appraisals/:id", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (user && EDUCATOR_ROLES.includes(user.role as (typeof EDUCATOR_ROLES)[number])) {
    res.status(403).json({ error: "Not permitted" });
    return;
  }
  const id = Number(req.params.id);
  const [row] = await db.delete(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Appraisal not found" }); return; }
  res.sendStatus(204);
});

// ─── Stage 1: Employee ────────────────────────────────────────────────────────

router.put("/appraisals/:id/stage1/employee", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!current) { res.status(404).json({ error: "Appraisal not found" }); return; }
  if (current.status !== "stage1") { res.status(400).json({ error: "Appraisal is not in Stage 1" }); return; }

  const update: Record<string, unknown> = {
    employeeStage1: req.body,
    employeeStage1SubmittedAt: new Date(),
    updatedAt: new Date(),
    status: "stage2",
  };

  const [row] = await db.update(staffAppraisalsTable).set(update as any).where(eq(staffAppraisalsTable.id, id)).returning();
  const staffMap = await buildStaffMap();

  if (current.reviewerId) {
    createNotification({
      staffId: current.reviewerId,
      type: "appraisal_submitted",
      title: `Appraisal stage 1 submitted — awaiting your review`,
      href: `/appraisals/${id}`,
      referenceId: id,
      referenceType: "appraisal",
    }).catch((err) => logger.warn({ err }, "Failed to send appraisal_submitted notification"));
  }

  res.json(enrichAppraisal(row, staffMap));
});

// ─── Stage 1: Reviewer ────────────────────────────────────────────────────────

router.put("/appraisals/:id/stage1/reviewer", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!current) { res.status(404).json({ error: "Appraisal not found" }); return; }
  if (current.status !== "stage1" && current.status !== "stage2") {
    res.status(400).json({ error: "Reviewer Stage 1 can only be submitted during Stage 1 or Stage 2" }); return;
  }

  const [row] = await db.update(staffAppraisalsTable).set({
    reviewerStage1: req.body,
    reviewerStage1SubmittedAt: new Date(),
    updatedAt: new Date(),
  } as any).where(eq(staffAppraisalsTable.id, id)).returning();
  const staffMap = await buildStaffMap();

  createNotification({
    staffId: current.staffId,
    type: "appraisal_submitted",
    title: `Your reviewer has submitted their Stage 1 appraisal`,
    href: `/appraisals/${id}`,
    referenceId: id,
    referenceType: "appraisal",
  }).catch((err) => logger.warn({ err }, "Failed to send appraisal_submitted notification"));

  res.json(enrichAppraisal(row, staffMap));
});

// ─── Stage 1: Save draft (no submission) ─────────────────────────────────────

router.put("/appraisals/:id/stage1/draft", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!current) { res.status(404).json({ error: "Appraisal not found" }); return; }

  const { section, data } = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (section === "employee") update.employeeStage1 = data;
  else if (section === "reviewer") update.reviewerStage1 = data;
  else { res.status(400).json({ error: "section must be 'employee' or 'reviewer'" }); return; }

  const [row] = await db.update(staffAppraisalsTable).set(update as any).where(eq(staffAppraisalsTable.id, id)).returning();
  const staffMap = await buildStaffMap();
  res.json(enrichAppraisal(row, staffMap));
});

// ─── Stage 2 ──────────────────────────────────────────────────────────────────

router.put("/appraisals/:id/stage2", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!current) { res.status(404).json({ error: "Appraisal not found" }); return; }
  if (current.status !== "stage2") { res.status(400).json({ error: "Appraisal is not in Stage 2" }); return; }

  const [row] = await db.update(staffAppraisalsTable).set({
    stage2Data: req.body,
    stage2SubmittedAt: new Date(),
    status: "stage3",
    updatedAt: new Date(),
  } as any).where(eq(staffAppraisalsTable.id, id)).returning();
  const staffMap = await buildStaffMap();

  if (current.reviewerId) {
    createNotification({
      staffId: current.reviewerId,
      type: "appraisal_submitted",
      title: `Appraisal ready for Stage 3 joint meeting`,
      href: `/appraisals/${id}`,
      referenceId: id,
      referenceType: "appraisal",
    }).catch((err) => logger.warn({ err }, "Failed to send appraisal_submitted notification"));
  }

  res.json(enrichAppraisal(row, staffMap));
});

// ─── Stage 2: Save draft ──────────────────────────────────────────────────────

router.put("/appraisals/:id/stage2/draft", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!current) { res.status(404).json({ error: "Appraisal not found" }); return; }

  const [row] = await db.update(staffAppraisalsTable).set({
    stage2Data: req.body,
    updatedAt: new Date(),
  } as any).where(eq(staffAppraisalsTable.id, id)).returning();
  const staffMap = await buildStaffMap();
  res.json(enrichAppraisal(row, staffMap));
});

// ─── Stage 3 ──────────────────────────────────────────────────────────────────

router.put("/appraisals/:id/stage3", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!current) { res.status(404).json({ error: "Appraisal not found" }); return; }
  if (current.status !== "stage3") { res.status(400).json({ error: "Appraisal is not in Stage 3" }); return; }

  const [row] = await db.update(staffAppraisalsTable).set({
    stage3Data: req.body,
    status: "completed",
    completedAt: new Date(),
    updatedAt: new Date(),
  } as any).where(eq(staffAppraisalsTable.id, id)).returning();
  const staffMap = await buildStaffMap();

  createNotification({
    staffId: current.staffId,
    type: "appraisal_submitted",
    title: `Your appraisal has been completed`,
    href: `/appraisals/${id}`,
    referenceId: id,
    referenceType: "appraisal",
  }).catch((err) => logger.warn({ err }, "Failed to send appraisal_submitted notification"));

  res.json(enrichAppraisal(row, staffMap));
});

// ─── Stage 3: Save draft ──────────────────────────────────────────────────────

router.put("/appraisals/:id/stage3/draft", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [current] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!current) { res.status(404).json({ error: "Appraisal not found" }); return; }

  const [row] = await db.update(staffAppraisalsTable).set({
    stage3Data: req.body,
    updatedAt: new Date(),
  } as any).where(eq(staffAppraisalsTable.id, id)).returning();
  const staffMap = await buildStaffMap();
  res.json(enrichAppraisal(row, staffMap));
});

// ─── Goal Notes ───────────────────────────────────────────────────────────────

router.get("/appraisals/:id/goal-notes", async (req, res): Promise<void> => {
  const appraisalId = Number(req.params.id);
  const notes = await db
    .select()
    .from(appraisalGoalNotesTable)
    .where(eq(appraisalGoalNotesTable.appraisalId, appraisalId))
    .orderBy(desc(appraisalGoalNotesTable.createdAt));
  res.json(notes);
});

router.post("/appraisals/:id/goal-notes", async (req, res): Promise<void> => {
  const appraisalId = Number(req.params.id);
  const { goalId, note } = req.body ?? {};
  if (!goalId || !note?.trim()) {
    res.status(400).json({ error: "goalId and note are required" });
    return;
  }
  const createdBy = req.session?.user?.id ?? null;
  const [row] = await db.insert(appraisalGoalNotesTable).values({
    appraisalId,
    goalId: String(goalId),
    note: String(note).trim(),
    createdBy: createdBy ? Number(createdBy) : null,
  } as any).returning();
  res.status(201).json(row);
});

router.delete("/appraisals/:id/goal-notes/:noteId", async (req, res): Promise<void> => {
  const noteId = Number(req.params.noteId);
  const appraisalId = Number(req.params.id);
  const [row] = await db
    .delete(appraisalGoalNotesTable)
    .where(and(eq(appraisalGoalNotesTable.id, noteId), eq(appraisalGoalNotesTable.appraisalId, appraisalId)))
    .returning();
  if (!row) { res.status(404).json({ error: "Note not found" }); return; }
  res.sendStatus(204);
});

export default router;
