import { Router, type Request, type Response, type NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import { GetEmergencyRecordHeadingPreferencesResponse, UpdateEmergencyRecordHeadingPreferencesBody } from "@workspace/api-zod";

const router = Router();

function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  if (req.session.user.type !== "staff") {
    res.status(403).json({ error: "Staff account required" });
    return;
  }
  next();
}

router.get("/auth/emergency-record-headings", requireStaff, async (req, res) => {
  try {
    const [staff] = await db.select({ collapsedHeadings: staffTable.emergencyRecordHeadings })
      .from(staffTable).where(eq(staffTable.id, req.session.user!.id)).limit(1);
    if (!staff) {
      res.status(404).json({ error: "Staff account not found" });
      return;
    }
    res.json(GetEmergencyRecordHeadingPreferencesResponse.parse({ collapsedHeadings: staff.collapsedHeadings ?? null }));
  } catch (err) {
    req.log.error({ err }, "Failed to load emergency heading preferences");
    res.status(500).json({ error: "Could not load your saved heading settings" });
  }
});

router.patch("/auth/emergency-record-headings", requireStaff, async (req, res) => {
  const parsed = UpdateEmergencyRecordHeadingPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Heading settings must be true or false" });
    return;
  }
  try {
    // Merge changed headings atomically; do not overwrite the other headings.
    const [staff] = await db.update(staffTable).set({
      emergencyRecordHeadings: sql`COALESCE(${staffTable.emergencyRecordHeadings}, '{}'::jsonb) || ${JSON.stringify(parsed.data)}::jsonb`,
    }).where(eq(staffTable.id, req.session.user!.id))
      .returning({ collapsedHeadings: staffTable.emergencyRecordHeadings });
    if (!staff) {
      res.status(404).json({ error: "Staff account not found" });
      return;
    }
    res.json(GetEmergencyRecordHeadingPreferencesResponse.parse({ collapsedHeadings: staff.collapsedHeadings }));
  } catch (err) {
    req.log.error({ err }, "Failed to save emergency heading preferences");
    res.status(500).json({ error: "Could not save your heading settings" });
  }
});

export default router;
