import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, wellbeingReportsTable, childrenTable } from "@workspace/db";
import {
  CreateWellbeingReportBody, GetWellbeingReportParams, GetWellbeingReportResponse,
  ListWellbeingReportsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichReport(r: typeof wellbeingReportsTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, r.childId));
  return { ...r, childName: child ? `${child.firstName} ${child.lastName}` : null };
}

router.get("/wellbeing", async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(wellbeingReportsTable).orderBy(wellbeingReportsTable.reportedAt);
    const childList = await db.select().from(childrenTable);
    const enriched = rows.map((r) => {
      const child = childList.find((c) => c.id === r.childId);
      return { ...r, childName: child ? `${child.firstName} ${child.lastName}` : null };
    });
    res.json(ListWellbeingReportsResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch wellbeing reports");
    res.status(500).json({ error: "Failed to fetch wellbeing reports" });
  }
});

router.post("/wellbeing", async (req, res): Promise<void> => {
  const parsed = CreateWellbeingReportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [report] = await db.insert(wellbeingReportsTable).values(parsed.data as any).returning();
    res.status(201).json(GetWellbeingReportResponse.parse(await enrichReport(report)));
  } catch (err) {
    req.log.error({ err }, "Failed to create wellbeing report");
    res.status(500).json({ error: "Failed to create wellbeing report" });
  }
});

router.get("/wellbeing/:id", async (req, res): Promise<void> => {
  const params = GetWellbeingReportParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const [report] = await db.select().from(wellbeingReportsTable).where(eq(wellbeingReportsTable.id, params.data.id));
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    res.json(GetWellbeingReportResponse.parse(await enrichReport(report)));
  } catch (err) {
    req.log.error({ err, id: params.data.id }, "Failed to fetch wellbeing report");
    res.status(500).json({ error: "Failed to fetch wellbeing report" });
  }
});

export default router;
