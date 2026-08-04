import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, nqsAreasTable } from "@workspace/db";
import {
  UpdateNqsAreaParams,
  UpdateNqsAreaBody,
  UpdateNqsAreaResponse,
  ListNqsAreasResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/nqs", async (req, res): Promise<void> => {
  try {
    const areas = await db.select().from(nqsAreasTable).orderBy(nqsAreasTable.number);
    res.json(ListNqsAreasResponse.parse(areas));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch NQS areas");
    res.status(500).json({ error: "Failed to fetch NQS areas" });
  }
});

router.patch("/nqs/:id", async (req, res): Promise<void> => {
  const params = UpdateNqsAreaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateNqsAreaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const updateData: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status || parsed.data.notes) {
      updateData.lastReviewedAt = new Date();
    }
    const [area] = await db
      .update(nqsAreasTable)
      .set(updateData)
      .where(eq(nqsAreasTable.id, params.data.id))
      .returning();
    if (!area) {
      res.status(404).json({ error: "NQS area not found" });
      return;
    }
    res.json(UpdateNqsAreaResponse.parse(area));
  } catch (err) {
    req.log.error({ err, areaId: params.data.id }, "Failed to update NQS area");
    res.status(500).json({ error: "Failed to update NQS area" });
  }
});

export default router;
