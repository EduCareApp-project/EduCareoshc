import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organisationTable } from "@workspace/db";

const router: IRouter = Router();

const ORG_ID_REGEX = /^\d{6}[A-Z]$/;

// GET /api/organisation
router.get("/organisation", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(organisationTable).limit(1);
    res.json(row ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch organisation");
    res.status(500).json({ error: "Failed to fetch organisation" });
  }
});

// PUT /api/organisation
router.put("/organisation", async (req, res): Promise<void> => {
  const { organisationId, name, approvalNumber, abn, servicePhone, serviceEmail } = req.body ?? {};

  if (organisationId !== undefined && organisationId !== null && organisationId !== "") {
    if (!ORG_ID_REGEX.test(String(organisationId))) {
      res.status(400).json({
        error: "Invalid Organisation ID format. Must be exactly 6 digits followed by 1 uppercase letter (e.g. 123456A).",
      });
      return;
    }
  }

  try {
    const [existing] = await db.select().from(organisationTable).limit(1);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (organisationId !== undefined) patch.organisationId = organisationId ?? null;
    if (name !== undefined) patch.name = name?.trim() || null;
    if (approvalNumber !== undefined) patch.approvalNumber = approvalNumber?.trim() || null;
    if (abn !== undefined) patch.abn = abn?.trim() || null;
    if (servicePhone !== undefined) patch.servicePhone = servicePhone?.trim() || null;
    if (serviceEmail !== undefined) patch.serviceEmail = serviceEmail?.trim() || null;

    if (existing) {
      const [updated] = await db
        .update(organisationTable)
        .set(patch as any)
        .where(eq(organisationTable.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(organisationTable)
        .values(patch as any)
        .returning();
      res.status(201).json(created);
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update organisation");
    res.status(500).json({ error: "Failed to update organisation" });
  }
});

export default router;
