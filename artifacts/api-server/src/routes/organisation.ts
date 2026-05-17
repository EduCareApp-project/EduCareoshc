import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organisationTable } from "@workspace/db";

const router: IRouter = Router();

const ORG_ID_REGEX = /^\d{6}[A-Z]$/;

// GET /api/organisation
router.get("/organisation", async (req, res): Promise<void> => {
  const [row] = await db.select().from(organisationTable).limit(1);
  res.json(row ?? null);
});

// PUT /api/organisation
router.put("/organisation", async (req, res): Promise<void> => {
  const { organisationId, name } = req.body ?? {};

  if (organisationId !== undefined && organisationId !== null && organisationId !== "") {
    if (!ORG_ID_REGEX.test(String(organisationId))) {
      res.status(400).json({
        error: "Invalid Organisation ID format. Must be exactly 6 digits followed by 1 uppercase letter (e.g. 123456A).",
      });
      return;
    }
  }

  const [existing] = await db.select().from(organisationTable).limit(1);

  if (existing) {
    const [updated] = await db
      .update(organisationTable)
      .set({
        organisationId: organisationId ?? existing.organisationId,
        name: name !== undefined ? (name?.trim() || null) : existing.name,
        updatedAt: new Date(),
      })
      .where(eq(organisationTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(organisationTable)
      .values({
        organisationId: organisationId ?? null,
        name: name?.trim() || null,
      })
      .returning();
    res.status(201).json(created);
  }
});

export default router;
