import { Router, type IRouter } from "express";
import { db, outcomesTable } from "@workspace/db";
import { ListOutcomesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/outcomes", async (req, res): Promise<void> => {
  try {
    const outcomes = await db.select().from(outcomesTable).orderBy(outcomesTable.number);
    res.json(ListOutcomesResponse.parse(outcomes));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch outcomes");
    res.status(500).json({ error: "Failed to fetch outcomes" });
  }
});

export default router;
