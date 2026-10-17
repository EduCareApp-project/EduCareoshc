import { Router, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import { GetDashboardPreferencesResponse, UpdateDashboardPreferencesBody } from "@workspace/api-zod";

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
const selection = { recentObservationsCollapsed: staffTable.recentObservationsCollapsed };

router.get("/auth/dashboard-preferences", requireStaff, async (req, res): Promise<void> => {
  try {
    const [staff] = await db.select(selection).from(staffTable)
      .where(eq(staffTable.id, req.session.user!.id)).limit(1);
    if (!staff) {
      res.status(404).json({ error: "Staff account not found" });
      return;
    }
    res.json(GetDashboardPreferencesResponse.parse(staff));
  } catch (err) {
    req.log.error({ err }, "Failed to load personal dashboard preferences");
    res.status(500).json({ error: "Could not load your saved dashboard preferences" });
  }
});

router.patch("/auth/dashboard-preferences", requireStaff, async (req, res): Promise<void> => {
  const parsed = UpdateDashboardPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "recentObservationsCollapsed must be true or false" });
    return;
  }
  try {
    const [staff] = await db.update(staffTable).set(parsed.data)
      .where(eq(staffTable.id, req.session.user!.id)).returning(selection);
    if (!staff) {
      res.status(404).json({ error: "Staff account not found" });
      return;
    }
    res.json(GetDashboardPreferencesResponse.parse(staff));
  } catch (err) {
    req.log.error({ err }, "Failed to save personal dashboard preferences");
    res.status(500).json({ error: "Could not save your dashboard preference. Please try again." });
  }
});

export default router;
