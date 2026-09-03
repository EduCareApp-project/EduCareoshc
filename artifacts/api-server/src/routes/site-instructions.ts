import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, siteInstructionsTable } from "@workspace/db";

const router: IRouter = Router();

const ADMIN_ROLES = new Set(["admin", "admin_support", "educational_leader"]);

function canEdit(req: any): boolean {
  const user = req.session?.user;
  return user?.type === "staff" && ADMIN_ROLES.has(user.role);
}

// GET /site-instructions/:siteId
router.get("/site-instructions/:siteId", async (req, res): Promise<void> => {
  const siteId = parseInt(req.params.siteId);
  if (isNaN(siteId)) {
    res.status(400).json({ error: "Invalid siteId" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(siteInstructionsTable)
      .where(eq(siteInstructionsTable.siteId, siteId))
      .limit(1);
    if (!row) {
      res.json({ siteId, quickRef: {}, sections: [], contacts: [], photos: [], documents: [], updatedAt: null, updatedById: null });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err, siteId }, "Failed to fetch site instructions");
    res.status(500).json({ error: "Failed to fetch site instructions" });
  }
});

// PUT /site-instructions/:siteId
router.put("/site-instructions/:siteId", async (req, res): Promise<void> => {
  if (!canEdit(req)) {
    res.status(403).json({ error: "Admin or Educational Leader access required." });
    return;
  }
  const siteId = parseInt(req.params.siteId);
  if (isNaN(siteId)) {
    res.status(400).json({ error: "Invalid siteId" });
    return;
  }
  const { quickRef, sections, contacts, photos, documents } = req.body;
  const staffId = (req.session as any).user?.id ?? null;

  const payload = {
    quickRef: quickRef ?? {},
    sections: sections ?? [],
    contacts: contacts ?? [],
    photos: photos ?? [],
    documents: documents ?? [],
    updatedAt: new Date(),
    updatedById: staffId,
  };

  try {
    const existing = await db
      .select({ id: siteInstructionsTable.id })
      .from(siteInstructionsTable)
      .where(eq(siteInstructionsTable.siteId, siteId))
      .limit(1);

    if (existing.length > 0) {
      const [row] = await db
        .update(siteInstructionsTable)
        .set(payload)
        .where(eq(siteInstructionsTable.siteId, siteId))
        .returning();
      res.json(row);
    } else {
      const [row] = await db
        .insert(siteInstructionsTable)
        .values({ siteId, ...payload })
        .returning();
      res.json(row);
    }
  } catch (err) {
    req.log.error({ err, siteId }, "Failed to save site instructions");
    res.status(500).json({ error: "Failed to save site instructions" });
  }
});

export default router;
