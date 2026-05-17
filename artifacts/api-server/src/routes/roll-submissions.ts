import { Router, type IRouter } from "express";
import { eq, desc, and, gte } from "drizzle-orm";
import { db, rollSubmissionsTable } from "@workspace/db";

const router: IRouter = Router();

// Return the Monday (week start) for a given date
function getWeekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/roll-submissions?weeks=8
// Returns the last N weeks newest-first, filling gaps with empty records
router.get("/roll-submissions", async (req, res): Promise<void> => {
  const weeks = Math.min(parseInt(String(req.query.weeks ?? "8"), 10) || 8, 52);

  const currentWeekStart = getWeekStart(new Date());
  const weekStarts: string[] = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() - i * 7);
    weekStarts.push(toDateStr(d));
  }

  const cutoff = weekStarts[weekStarts.length - 1];
  const rows = await db
    .select()
    .from(rollSubmissionsTable)
    .where(gte(rollSubmissionsTable.weekStart, cutoff))
    .orderBy(desc(rollSubmissionsTable.weekStart));

  const byWeek = new Map(rows.map((r) => [r.weekStart, r]));

  const result = weekStarts.map((ws) => byWeek.get(ws) ?? {
    id: null,
    weekStart: ws,
    submitted: false,
    accurate: false,
    notes: null,
    createdAt: null,
    updatedAt: null,
  });

  res.json(result);
});

// PUT /api/roll-submissions/:weekStart  (weekStart = YYYY-MM-DD Monday)
router.put("/roll-submissions/:weekStart", async (req, res): Promise<void> => {
  const { weekStart } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    res.status(400).json({ error: "weekStart must be YYYY-MM-DD" });
    return;
  }

  const { submitted, accurate, notes } = req.body ?? {};

  const [existing] = await db
    .select()
    .from(rollSubmissionsTable)
    .where(eq(rollSubmissionsTable.weekStart, weekStart))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(rollSubmissionsTable)
      .set({
        submitted: submitted !== undefined ? Boolean(submitted) : existing.submitted,
        accurate: accurate !== undefined ? Boolean(accurate) : existing.accurate,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(rollSubmissionsTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(rollSubmissionsTable)
      .values({
        weekStart: weekStart as any,
        submitted: submitted !== undefined ? Boolean(submitted) : false,
        accurate: accurate !== undefined ? Boolean(accurate) : false,
        notes: notes?.trim() || null,
      })
      .returning();
    res.status(201).json(created);
  }
});

export default router;
