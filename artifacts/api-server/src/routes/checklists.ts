import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db, checklistsTable, checklistCompletionsTable, staffTable,
  checklistTemplatesTable, checklistRoutinesTable, sitesTable,
  routineItemCompletionsTable,
} from "@workspace/db";
import {
  CreateChecklistBody, CompleteChecklistParams, CompleteChecklistBody,
  GetChecklistCompletionsParams, ListChecklistsResponse, ListChecklistsResponseItem,
  GetChecklistCompletionsResponseItem, GetChecklistCompletionsResponse,
  ListChecklistTemplatesResponse, CreateChecklistTemplateBody,
  UpdateChecklistTemplateParams, UpdateChecklistTemplateBody, UpdateChecklistTemplateResponse,
  DeleteChecklistTemplateParams,
  ListChecklistRoutinesResponse, CreateChecklistRoutineBody,
  UpdateChecklistRoutineParams, UpdateChecklistRoutineBody,
  DeleteChecklistRoutineParams,
  ListRoutineItemCompletionsQueryParams, ListRoutineItemCompletionsResponse,
  CreateRoutineItemCompletionBody, DeleteRoutineItemCompletionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Legacy flat checklists ──────────────────────────────────────────────────

router.get("/checklists", async (_req, res): Promise<void> => {
  const rows = await db.select().from(checklistsTable).orderBy(checklistsTable.createdAt);
  res.json(ListChecklistsResponse.parse(rows));
});

router.post("/checklists", async (req, res): Promise<void> => {
  const parsed = CreateChecklistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [checklist] = await db.insert(checklistsTable).values(parsed.data).returning();
  res.status(201).json(ListChecklistsResponseItem.parse(checklist));
});

router.post("/checklists/:id/complete", async (req, res): Promise<void> => {
  const params = CompleteChecklistParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CompleteChecklistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [completion] = await db.insert(checklistCompletionsTable).values({ checklistId: params.data.id, ...parsed.data }).returning();
  const staffList = await db.select().from(staffTable);
  const staff = staffList.find((s) => s.id === completion.staffId);
  res.status(201).json(GetChecklistCompletionsResponseItem.parse({
    ...completion,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
  }));
});

router.get("/checklists/:id/completions", async (req, res): Promise<void> => {
  const params = GetChecklistCompletionsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db.select().from(checklistCompletionsTable).where(eq(checklistCompletionsTable.checklistId, params.data.id));
  const staffList = await db.select().from(staffTable);
  const enriched = rows.map((c) => {
    const staff = staffList.find((s) => s.id === c.staffId);
    return { ...c, staffName: staff ? `${staff.firstName} ${staff.lastName}` : null };
  });
  res.json(GetChecklistCompletionsResponse.parse(enriched));
});

// ── Checklist Templates ─────────────────────────────────────────────────────

router.get("/checklist-templates", async (_req, res): Promise<void> => {
  const rows = await db.select().from(checklistTemplatesTable).orderBy(checklistTemplatesTable.createdAt);
  res.json(ListChecklistTemplatesResponse.parse(rows));
});

router.post("/checklist-templates", async (req, res): Promise<void> => {
  const parsed = CreateChecklistTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(checklistTemplatesTable).values({
    title: parsed.data.title,
    type: parsed.data.type,
    commencementMonth: parsed.data.commencementMonth ?? null,
    sections: parsed.data.sections as any,
  }).returning();
  res.status(201).json(ListChecklistTemplatesResponse.element.parse(row));
});

router.put("/checklist-templates/:id", async (req, res): Promise<void> => {
  const params = UpdateChecklistTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateChecklistTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(checklistTemplatesTable)
    .set({
      title: parsed.data.title,
      type: parsed.data.type,
      commencementMonth: parsed.data.commencementMonth ?? null,
      sections: parsed.data.sections as any,
    })
    .where(eq(checklistTemplatesTable.id, params.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(UpdateChecklistTemplateResponse.parse(row));
});

router.delete("/checklist-templates/:id", async (req, res): Promise<void> => {
  const params = DeleteChecklistTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(checklistTemplatesTable).where(eq(checklistTemplatesTable.id, params.data.id));
  res.status(204).send();
});

// ── Checklist Routines ──────────────────────────────────────────────────────

router.get("/checklist-routines", async (_req, res): Promise<void> => {
  const rows = await db.select().from(checklistRoutinesTable).orderBy(checklistRoutinesTable.createdAt);
  const sites = await db.select().from(sitesTable);
  const staff = await db.select().from(staffTable);
  const enriched = rows.map((r) => {
    const site = sites.find((s) => s.id === r.siteId);
    const member = staff.find((s) => s.id === r.staffId);
    return {
      ...r,
      siteName: site?.name ?? null,
      staffName: member ? `${member.firstName} ${member.lastName}` : null,
    };
  });
  res.json(ListChecklistRoutinesResponse.parse(enriched));
});

router.post("/checklist-routines", async (req, res): Promise<void> => {
  const parsed = CreateChecklistRoutineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(checklistRoutinesTable).values({
    templateId: parsed.data.templateId,
    title: parsed.data.title,
    siteId: parsed.data.siteId ?? null,
    staffId: parsed.data.staffId ?? null,
    targetDate: parsed.data.targetDate as any,
    isRepeating: parsed.data.isRepeating,
    frequency: parsed.data.frequency ?? null,
    sectionsSnapshot: parsed.data.sectionsSnapshot as any,
  }).returning();
  const sites = await db.select().from(sitesTable);
  const staff = await db.select().from(staffTable);
  const site = sites.find((s) => s.id === row.siteId);
  const member = staff.find((s) => s.id === row.staffId);
  res.status(201).json(ListChecklistRoutinesResponse.element.parse({
    ...row,
    siteName: site?.name ?? null,
    staffName: member ? `${member.firstName} ${member.lastName}` : null,
  }));
});

router.put("/checklist-routines/:id", async (req, res): Promise<void> => {
  const params = UpdateChecklistRoutineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateChecklistRoutineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.update(checklistRoutinesTable)
    .set({
      siteId: parsed.data.siteId ?? null,
      staffId: parsed.data.staffId ?? null,
      targetDate: parsed.data.targetDate as any,
      isRepeating: parsed.data.isRepeating,
      frequency: parsed.data.frequency ?? null,
    })
    .where(eq(checklistRoutinesTable.id, params.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const sites = await db.select().from(sitesTable);
  const staff = await db.select().from(staffTable);
  const site = sites.find((s) => s.id === row.siteId);
  const member = staff.find((s) => s.id === row.staffId);
  res.json(ListChecklistRoutinesResponse.element.parse({
    ...row,
    siteName: site?.name ?? null,
    staffName: member ? `${member.firstName} ${member.lastName}` : null,
  }));
});

router.delete("/checklist-routines/:id", async (req, res): Promise<void> => {
  const params = DeleteChecklistRoutineParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(checklistRoutinesTable).where(eq(checklistRoutinesTable.id, params.data.id));
  res.status(204).send();
});

// ── Routine Item Completions ─────────────────────────────────────────────────

router.get("/routine-item-completions", async (req, res): Promise<void> => {
  const params = ListRoutineItemCompletionsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const rows = await db
    .select()
    .from(routineItemCompletionsTable)
    .where(
      and(
        eq(routineItemCompletionsTable.routineId, params.data.routineId),
        eq(routineItemCompletionsTable.periodKey, params.data.periodKey),
      )
    );
  const staffList = await db.select().from(staffTable);
  const enriched = rows.map((r) => {
    const member = staffList.find((s) => s.id === r.completedByStaffId);
    return {
      ...r,
      completedByStaffName: member ? `${member.firstName} ${member.lastName}` : null,
    };
  });
  res.json(ListRoutineItemCompletionsResponse.parse(enriched));
});

router.post("/routine-item-completions", async (req, res): Promise<void> => {
  const parsed = CreateRoutineItemCompletionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(routineItemCompletionsTable).values({
    routineId: parsed.data.routineId,
    periodKey: parsed.data.periodKey,
    sectionIndex: parsed.data.sectionIndex,
    itemIndex: parsed.data.itemIndex,
    completedByStaffId: parsed.data.completedByStaffId ?? null,
  }).returning();
  const staffList = await db.select().from(staffTable);
  const member = staffList.find((s) => s.id === row.completedByStaffId);
  res.status(201).json({
    ...row,
    completedByStaffName: member ? `${member.firstName} ${member.lastName}` : null,
  });
});

router.delete("/routine-item-completions/:id", async (req, res): Promise<void> => {
  const params = DeleteRoutineItemCompletionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(routineItemCompletionsTable).where(eq(routineItemCompletionsTable.id, params.data.id));
  res.status(204).send();
});

export default router;
