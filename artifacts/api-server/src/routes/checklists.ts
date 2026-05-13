import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, checklistsTable, checklistCompletionsTable, staffTable } from "@workspace/db";
import {
  CreateChecklistBody, CompleteChecklistParams, CompleteChecklistBody,
  GetChecklistCompletionsParams, ListChecklistsResponse, ListChecklistsResponseItem,
  GetChecklistCompletionsResponseItem, GetChecklistCompletionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

export default router;
