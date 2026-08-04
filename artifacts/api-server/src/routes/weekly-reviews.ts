import { Router, type IRouter } from "express";
import { eq, and, gte, lt, count, sql, desc } from "drizzle-orm";
import {
  db, weeklyReviewsTable, sitesTable, staffTable,
  jottingsTable, childrenTable, observationsTable, postsTable,
} from "@workspace/db";
import {
  ListWeeklyReviewsResponse,
  CreateWeeklyReviewBody,
  UpdateWeeklyReviewBody,
  GetWeeklyReviewStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function weekEndStr(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

async function fetchStats(siteId: number, weekStart: string) {
  const weekEnd = weekEndStr(weekStart);

  const [postsRow] = await db.select({ cnt: count() })
    .from(postsTable)
    .where(and(
      eq(postsTable.siteId, siteId),
      gte(postsTable.date, weekStart as any),
      lt(postsTable.date, weekEnd as any),
    ));

  const [obsRow] = await db.select({ cnt: count() })
    .from(observationsTable)
    .innerJoin(childrenTable, eq(observationsTable.childId, childrenTable.id))
    .where(and(
      eq(childrenTable.siteId, siteId),
      gte(observationsTable.observationDate, weekStart as any),
      lt(observationsTable.observationDate, weekEnd as any),
    ));

  const [jotRow] = await db.select({ cnt: count() })
    .from(jottingsTable)
    .innerJoin(childrenTable, eq(jottingsTable.childId, childrenTable.id))
    .where(and(
      eq(childrenTable.siteId, siteId),
      sql`${jottingsTable.createdAt}::date >= ${weekStart}::date`,
      sql`${jottingsTable.createdAt}::date < ${weekEnd}::date`,
    ));

  return {
    postsCount: Number(postsRow?.cnt ?? 0),
    observationsCount: Number(obsRow?.cnt ?? 0),
    jottingsCount: Number(jotRow?.cnt ?? 0),
  };
}

async function buildReview(row: typeof weeklyReviewsTable.$inferSelect) {
  const [site] = await db.select({ name: sitesTable.name }).from(sitesTable).where(eq(sitesTable.id, row.siteId));
  const [staff] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
    .from(staffTable).where(eq(staffTable.id, row.completedById));
  return {
    ...row,
    weekStart: row.weekStart as string,
    siteName: site?.name ?? "",
    completedByName: staff ? `${staff.firstName} ${staff.lastName}` : "",
    completedAt: row.completedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// GET /api/weekly-reviews/stats
router.get("/weekly-reviews/stats", async (req, res): Promise<void> => {
  const siteId = typeof req.query.siteId === "string" ? parseInt(req.query.siteId, 10) : NaN;
  const weekStart = typeof req.query.weekStart === "string" ? req.query.weekStart : null;
  if (isNaN(siteId) || !weekStart) {
    res.status(400).json({ error: "siteId and weekStart are required" });
    return;
  }
  try {
    const stats = await fetchStats(siteId, weekStart);
    res.json(GetWeeklyReviewStatsResponse.parse(stats));
  } catch (err) {
    req.log.error({ err, siteId, weekStart }, "Failed to fetch weekly review stats");
    res.status(500).json({ error: "Failed to fetch weekly review stats" });
  }
});

// GET /api/weekly-reviews
router.get("/weekly-reviews", async (req, res): Promise<void> => {
  const siteIdFilter = typeof req.query.siteId === "string" ? parseInt(req.query.siteId, 10) : null;
  try {
    const rows = await db.select().from(weeklyReviewsTable)
      .where(siteIdFilter ? eq(weeklyReviewsTable.siteId, siteIdFilter) : undefined)
      .orderBy(desc(weeklyReviewsTable.weekStart));
    const reviews = await Promise.all(rows.map(buildReview));
    res.json(ListWeeklyReviewsResponse.parse(reviews));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch weekly reviews");
    res.status(500).json({ error: "Failed to fetch weekly reviews" });
  }
});

// POST /api/weekly-reviews
router.post("/weekly-reviews", async (req, res): Promise<void> => {
  const parsed = CreateWeeklyReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const { siteId, weekStart, completedById, ...fields } = parsed.data;
    const stats = await fetchStats(siteId, weekStart);
    const [row] = await db.insert(weeklyReviewsTable).values({
      siteId, weekStart: weekStart as any, completedById,
      ...fields,
      ...stats,
    }).returning();
    res.status(201).json(await buildReview(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create weekly review");
    res.status(500).json({ error: "Failed to create weekly review" });
  }
});

// GET /api/weekly-reviews/:id
router.get("/weekly-reviews/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  try {
    const [row] = await db.select().from(weeklyReviewsTable).where(eq(weeklyReviewsTable.id, id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await buildReview(row));
  } catch (err) {
    req.log.error({ err, id }, "Failed to fetch weekly review");
    res.status(500).json({ error: "Failed to fetch weekly review" });
  }
});

// PUT /api/weekly-reviews/:id
router.put("/weekly-reviews/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const parsed = UpdateWeeklyReviewBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [row] = await db.update(weeklyReviewsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(weeklyReviewsTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await buildReview(row));
  } catch (err) {
    req.log.error({ err, id }, "Failed to update weekly review");
    res.status(500).json({ error: "Failed to update weekly review" });
  }
});

// DELETE /api/weekly-reviews/:id
router.delete("/weekly-reviews/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  try {
    await db.delete(weeklyReviewsTable).where(eq(weeklyReviewsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err, id }, "Failed to delete weekly review");
    res.status(500).json({ error: "Failed to delete weekly review" });
  }
});

export default router;
