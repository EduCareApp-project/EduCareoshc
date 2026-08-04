import { Router, type IRouter } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, jottingsTable, childrenTable, staffTable } from "@workspace/db";
import { ArchiveJottingParams, CreateJottingBody, DeleteJottingParams, ListJottingsResponse, ListJottingsResponseItem } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jottings", async (req, res): Promise<void> => {
  const includeArchived = req.query.includeArchived === "true";
  try {
    const rows = await db.select().from(jottingsTable)
      .where(includeArchived ? undefined : isNull(jottingsTable.archivedAt))
      .orderBy(jottingsTable.createdAt);
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
  } catch (err) {
    req.log.error({ err }, "Failed to fetch jottings");
    res.status(500).json({ error: "Failed to fetch jottings" });
  }
});

router.post("/jottings", async (req, res): Promise<void> => {
  const parsed = CreateJottingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
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
  } catch (err) {
    req.log.error({ err }, "Failed to create jotting");
    res.status(500).json({ error: "Failed to create jotting" });
  }
});

router.patch("/jottings/:id/archive", async (req, res): Promise<void> => {
  const params = ArchiveJottingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
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
  } catch (err) {
    req.log.error({ err, jottingId: params.data.id }, "Failed to archive jotting");
    res.status(500).json({ error: "Failed to archive jotting" });
  }
});

router.patch("/jottings/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { content, childId } = req.body as { content?: string; childId?: number | null };
  if (!content?.trim()) { res.status(400).json({ error: "content is required" }); return; }
  try {
    const [jotting] = await db.update(jottingsTable)
      .set({ content: content.trim(), ...("childId" in req.body ? { childId: childId ?? null } : {}) })
      .where(eq(jottingsTable.id, id))
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
  } catch (err) {
    req.log.error({ err, jottingId: id }, "Failed to update jotting");
    res.status(500).json({ error: "Failed to update jotting" });
  }
});

router.delete("/jottings/:id", async (req, res): Promise<void> => {
  const params = DeleteJottingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  try {
    const [jotting] = await db.delete(jottingsTable).where(eq(jottingsTable.id, params.data.id)).returning();
    if (!jotting) { res.status(404).json({ error: "Jotting not found" }); return; }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, jottingId: params.data.id }, "Failed to delete jotting");
    res.status(500).json({ error: "Failed to delete jotting" });
  }
});

export default router;
