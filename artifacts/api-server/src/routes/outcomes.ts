import { Router, type IRouter } from "express";
import { db, outcomesTable } from "@workspace/db";
import { ListOutcomesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/outcomes", async (_req, res): Promise<void> => {
  const outcomes = await db.select().from(outcomesTable).orderBy(outcomesTable.number);
  res.json(ListOutcomesResponse.parse(outcomes));
});

export default router;
