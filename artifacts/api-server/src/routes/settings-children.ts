import { currentOrganisationId } from "@workspace/db";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organisationTable } from "@workspace/db";

const router: IRouter = Router();

const VALID_MODES = ["letter_icon", "profile_picture"] as const;

router.get("/settings/children", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select({ childDisplayMode: organisationTable.childDisplayMode })
      .from(organisationTable).where(eq(organisationTable.id, currentOrganisationId())).limit(1);
    res.json({ childDisplayMode: row?.childDisplayMode ?? "letter_icon" });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch children settings");
    res.status(500).json({ error: "Failed to fetch children settings" });
  }
});

router.put("/settings/children", async (req, res): Promise<void> => {
  const { childDisplayMode } = req.body ?? {};
  if (!VALID_MODES.includes(childDisplayMode)) {
    res.status(400).json({ error: "childDisplayMode must be 'letter_icon' or 'profile_picture'" });
    return;
  }

  try {
    const [existing] = await db.select().from(organisationTable).where(eq(organisationTable.id, currentOrganisationId())).limit(1);
    if (existing) {
      await db.update(organisationTable)
        .set({ childDisplayMode, updatedAt: new Date() })
        .where(eq(organisationTable.id, existing.id));
    } else {
      res.status(404).json({ error: "Company not found" }); return;
    }
    res.json({ childDisplayMode });
  } catch (err) {
    req.log.error({ err }, "Failed to update children settings");
    res.status(500).json({ error: "Failed to update children settings" });
  }
});

export default router;
