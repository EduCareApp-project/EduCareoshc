import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accessSettingsTable } from "@workspace/db";

const router: IRouter = Router();

const ROLES = ["educational_leader", "educator", "guardian"] as const;

router.get("/settings/access", async (_req, res): Promise<void> => {
  const rows = await db.select().from(accessSettingsTable);
  const result: Record<string, string[]> = {};
  for (const role of ROLES) {
    const row = rows.find((r) => r.role === role);
    result[role] = row?.disabledHrefs ?? [];
  }
  res.json(result);
});

router.put("/settings/access", async (req, res): Promise<void> => {
  const body = req.body as Record<string, string[]>;
  for (const role of ROLES) {
    const disabled = Array.isArray(body[role]) ? body[role] : [];
    await db
      .insert(accessSettingsTable)
      .values({ role, disabledHrefs: disabled })
      .onConflictDoUpdate({
        target: accessSettingsTable.role,
        set: { disabledHrefs: disabled },
      });
  }
  const rows = await db.select().from(accessSettingsTable);
  const result: Record<string, string[]> = {};
  for (const role of ROLES) {
    const row = rows.find((r) => r.role === role);
    result[role] = row?.disabledHrefs ?? [];
  }
  res.json(result);
});

export default router;
