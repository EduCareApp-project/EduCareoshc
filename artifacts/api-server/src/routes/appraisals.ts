import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, staffAppraisalsTable, staffTable } from "@workspace/db";

const router: IRouter = Router();

async function buildStaffMap() {
  const rows = await db
    .select({ id: staffTable.id, firstName: staffTable.firstName, lastName: staffTable.lastName })
    .from(staffTable);
  return new Map(rows.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
}

router.get("/appraisals", async (req, res): Promise<void> => {
  const staffId = req.query.staffId ? Number(req.query.staffId) : undefined;

  const rows = await db
    .select()
    .from(staffAppraisalsTable)
    .orderBy(desc(staffAppraisalsTable.createdAt));

  const staffMap = await buildStaffMap();

  const filtered = staffId ? rows.filter((r) => r.staffId === staffId) : rows;

  res.json(
    filtered.map((r) => ({
      ...r,
      staffName: staffMap.get(r.staffId) ?? String(r.staffId),
      reviewerName: r.reviewerId ? (staffMap.get(r.reviewerId) ?? null) : null,
    }))
  );
});

router.get("/appraisals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(staffAppraisalsTable).where(eq(staffAppraisalsTable.id, id));
  if (!row) { res.status(404).json({ error: "Appraisal not found" }); return; }

  const staffMap = await buildStaffMap();
  res.json({
    ...row,
    staffName: staffMap.get(row.staffId) ?? String(row.staffId),
    reviewerName: row.reviewerId ? (staffMap.get(row.reviewerId) ?? null) : null,
  });
});

router.post("/appraisals", async (req, res): Promise<void> => {
  const { staffId, reviewerId, period, scheduledDate } = req.body ?? {};
  if (!staffId || !period) {
    res.status(400).json({ error: "staffId and period are required" });
    return;
  }
  const [row] = await db
    .insert(staffAppraisalsTable)
    .values({
      staffId: Number(staffId),
      reviewerId: reviewerId ? Number(reviewerId) : null,
      period: String(period),
      scheduledDate: scheduledDate ?? null,
      status: "draft",
    } as any)
    .returning();
  res.status(201).json(row);
});

router.patch("/appraisals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const fields = [
    "status", "scheduledDate", "reviewerId",
    "managerRating", "managerStrengths", "managerDevelopment", "managerComments",
    "selfRating", "selfStrengths", "selfDevelopment", "selfComments",
    "agreedGoals",
  ] as const;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of fields) {
    if (req.body?.[f] !== undefined) {
      update[f] = f === "reviewerId" && req.body[f]
        ? Number(req.body[f])
        : req.body[f] === "" ? null : req.body[f];
    }
  }

  if (req.body?.status === "complete" && !update.completedAt) {
    update.completedAt = new Date();
  } else if (req.body?.status !== "complete") {
    update.completedAt = null;
  }

  const [row] = await db
    .update(staffAppraisalsTable)
    .set(update as any)
    .where(eq(staffAppraisalsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Appraisal not found" }); return; }
  res.json(row);
});

router.delete("/appraisals/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db
    .delete(staffAppraisalsTable)
    .where(eq(staffAppraisalsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Appraisal not found" }); return; }
  res.sendStatus(204);
});

export default router;
