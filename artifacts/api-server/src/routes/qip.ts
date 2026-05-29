import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, qipItemsTable, qipSourcesTable, qipStrengthsTable, childrenTable, sitesTable } from "@workspace/db";
import {
  CreateQipItemBody, UpdateQipItemParams, UpdateQipItemBody, UpdateQipItemResponse,
  DeleteQipItemParams, ListQipItemsResponse,
  CreateQipSourceBody, UpdateQipSourceParams, UpdateQipSourceBody, UpdateQipSourceResponse,
  DeleteQipSourceParams, ListQipSourcesResponse,
  UpsertQipStrengthParams, UpsertQipStrengthBody, UpsertQipStrengthResponse,
  ListQipStrengthsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Public view endpoint (no auth, names redacted) ─────────────────────────────

router.get("/qip/public", async (req, res): Promise<void> => {
  const siteId = req.query.siteId ? Number(req.query.siteId) : null;

  const [children, strengths, sitesRows] = await Promise.all([
    db.select({ firstName: childrenTable.firstName, lastName: childrenTable.lastName }).from(childrenTable),
    db.select().from(qipStrengthsTable).orderBy(qipStrengthsTable.qualityArea),
    db.select({ id: sitesTable.id, name: sitesTable.name }).from(sitesTable),
  ]);

  const allItems = siteId
    ? await db.select().from(qipItemsTable).where(eq(qipItemsTable.siteId, siteId))
    : await db.select().from(qipItemsTable);

  const activeItems = allItems.filter((i) => !i.archivedAt);

  const names: string[] = children
    .flatMap((c) => [c.firstName, c.lastName])
    .filter((n): n is string => !!n && n.length > 2);

  function redact(text: string | null | undefined): string | null {
    if (!text) return null;
    let result = text;
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "child");
    }
    return result;
  }

  const redactedItems = activeItems.map((item) => ({
    ...item,
    issueIdentified: redact(item.issueIdentified),
    outcomeGoal: redact(item.outcomeGoal),
    howToAchieve: redact(item.howToAchieve),
    successMeasure: redact(item.successMeasure),
    progressNotes: redact(item.progressNotes),
  }));

  const siteName = siteId ? (sitesRows.find((s) => s.id === siteId)?.name ?? null) : null;

  res.json({ strengths, items: redactedItems, siteName, sites: sitesRows });
});

// ── QIP Items ──────────────────────────────────────────────────────────────────

router.get("/qip", async (_req, res): Promise<void> => {
  const rows = await db.select().from(qipItemsTable).orderBy(qipItemsTable.createdAt);
  res.json(ListQipItemsResponse.parse(rows));
});

router.post("/qip", async (req, res): Promise<void> => {
  const parsed = CreateQipItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.insert(qipItemsTable).values(parsed.data as any).returning();
  res.status(201).json(UpdateQipItemResponse.parse(item));
});

router.patch("/qip/:id", async (req, res): Promise<void> => {
  const params = UpdateQipItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateQipItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [item] = await db.update(qipItemsTable).set(parsed.data as any).where(eq(qipItemsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "QIP item not found" }); return; }
  res.json(UpdateQipItemResponse.parse(item));
});

router.delete("/qip/:id", async (req, res): Promise<void> => {
  const params = DeleteQipItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [item] = await db.delete(qipItemsTable).where(eq(qipItemsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "QIP item not found" }); return; }
  res.sendStatus(204);
});

// ── QIP Sources ────────────────────────────────────────────────────────────────

router.get("/qip-sources", async (_req, res): Promise<void> => {
  const rows = await db.select().from(qipSourcesTable).orderBy(qipSourcesTable.sortOrder, qipSourcesTable.name);
  res.json(ListQipSourcesResponse.parse(rows));
});

router.post("/qip-sources", async (req, res): Promise<void> => {
  const parsed = CreateQipSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [source] = await db.insert(qipSourcesTable).values(parsed.data).returning();
  res.status(201).json(UpdateQipSourceResponse.parse(source));
});

router.patch("/qip-sources/:id", async (req, res): Promise<void> => {
  const params = UpdateQipSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateQipSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [source] = await db.update(qipSourcesTable).set(parsed.data).where(eq(qipSourcesTable.id, params.data.id)).returning();
  if (!source) { res.status(404).json({ error: "QIP source not found" }); return; }
  res.json(UpdateQipSourceResponse.parse(source));
});

router.delete("/qip-sources/:id", async (req, res): Promise<void> => {
  const params = DeleteQipSourceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [source] = await db.delete(qipSourcesTable).where(eq(qipSourcesTable.id, params.data.id)).returning();
  if (!source) { res.status(404).json({ error: "QIP source not found" }); return; }
  res.sendStatus(204);
});

// ── QIP Strengths ──────────────────────────────────────────────────────────────

router.get("/qip-strengths", async (req, res): Promise<void> => {
  const siteId = req.query.siteId ? Number(req.query.siteId) : null;
  const rows = await db.select().from(qipStrengthsTable).orderBy(qipStrengthsTable.qualityArea);
  const filtered = siteId != null
    ? rows.filter((r) => r.siteId === siteId)
    : rows;
  res.json(ListQipStrengthsResponse.parse(filtered));
});

router.put("/qip-strengths/:qualityArea", async (req, res): Promise<void> => {
  const params = UpsertQipStrengthParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpsertQipStrengthBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const qa = params.data.qualityArea;
  const siteId: number | null = typeof parsed.data.siteId === "number" ? parsed.data.siteId : null;
  const content: string = parsed.data.content;

  const [existing] = await db.select()
    .from(qipStrengthsTable)
    .where(siteId != null
      ? and(eq(qipStrengthsTable.qualityArea, qa), eq(qipStrengthsTable.siteId, siteId))
      : and(eq(qipStrengthsTable.qualityArea, qa), isNull(qipStrengthsTable.siteId))
    );

  let strength;
  if (existing) {
    [strength] = await db.update(qipStrengthsTable)
      .set({ content, updatedAt: new Date() })
      .where(eq(qipStrengthsTable.id, existing.id))
      .returning();
  } else {
    [strength] = await db.insert(qipStrengthsTable)
      .values({ qualityArea: qa, siteId, content })
      .returning();
  }

  res.json(UpsertQipStrengthResponse.parse(strength));
});

export default router;
