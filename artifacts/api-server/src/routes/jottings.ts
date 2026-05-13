import { Router, type IRouter } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, jottingsTable, childrenTable, staffTable } from "@workspace/db";
import { ArchiveJottingParams, CreateJottingBody, DeleteJottingParams, ListJottingsResponse, ListJottingsResponseItem } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jottings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(jottingsTable).where(isNull(jottingsTable.archivedAt)).orderBy(jottingsTable.createdAt);
  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const enriched = rows.map((j) => {
    const child = childList.find((c) => c.id === j.childId);
    const staff = staffList.find((s) => s.id === j.staffId);
    return {
      ...j,
      childName: child ? `${child.firstName} ${child.lastName}` : null,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
    };
  });
  res.json(ListJottingsResponse.parse(enriched));
});

router.post("/jottings", async (req, res): Promise<void> => {
  const parsed = CreateJottingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [jotting] = await db.insert(jottingsTable).values(parsed.data).returning();
  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const child = childList.find((c) => c.id === jotting.childId);
  const staff = staffList.find((s) => s.id === jotting.staffId);
  res.status(201).json(ListJottingsResponseItem.parse({
    ...jotting,
    childName: child ? `${child.firstName} ${child.lastName}` : null,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
  }));
});

router.patch("/jottings/:id/archive", async (req, res): Promise<void> => {
  const params = ArchiveJottingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [jotting] = await db.update(jottingsTable)
    .set({ archivedAt: new Date() })
    .where(eq(jottingsTable.id, params.data.id))
    .returning();
  if (!jotting) { res.status(404).json({ error: "Jotting not found" }); return; }
  const childList = await db.select().from(childrenTable);
  const staffList = await db.select().from(staffTable);
  const child = childList.find((c) => c.id === jotting.childId);
  const staff = staffList.find((s) => s.id === jotting.staffId);
  res.json(ListJottingsResponseItem.parse({
    ...jotting,
    childName: child ? `${child.firstName} ${child.lastName}` : null,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
  }));
});

router.delete("/jottings/:id", async (req, res): Promise<void> => {
  const params = DeleteJottingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [jotting] = await db.delete(jottingsTable).where(eq(jottingsTable.id, params.data.id)).returning();
  if (!jotting) { res.status(404).json({ error: "Jotting not found" }); return; }
  res.sendStatus(204);
});

export default router;
