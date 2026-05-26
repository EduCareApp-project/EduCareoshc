import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, welfareNotesTable, staffTable, childrenTable } from "@workspace/db";
import { createNotificationsForRoles } from "../lib/notify";
import { logger } from "../lib/logger";
import {
  GetChildWelfareNotesParams,
  GetChildWelfareNotesResponse,
  GetChildWelfareNotesResponseItem,
  CreateWelfareNoteBody,
  DeleteWelfareNoteParams,
  UpdateWelfareNoteParams,
  UpdateWelfareNoteBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/children/:id/welfare-notes", async (req, res): Promise<void> => {
  const params = GetChildWelfareNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const staffList = await db.select().from(staffTable);
  const notes = await db
    .select()
    .from(welfareNotesTable)
    .where(eq(welfareNotesTable.childId, params.data.id))
    .orderBy(welfareNotesTable.occurredAt);

  const enriched = notes.map((n) => {
    const staff = staffList.find((s) => s.id === n.staffId);
    return {
      ...n,
      staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
    };
  });

  res.json(GetChildWelfareNotesResponse.parse(enriched));
});

router.post("/welfare-notes", async (req, res): Promise<void> => {
  const parsed = CreateWelfareNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [note] = await db
    .insert(welfareNotesTable)
    .values(parsed.data as any)
    .returning();
  const staffList = await db.select().from(staffTable);
  const staff = staffList.find((s) => s.id === note.staffId);
  res.status(201).json(
    GetChildWelfareNotesResponseItem.parse({ ...note, staffName: staff ? `${staff.firstName} ${staff.lastName}` : null })
  );

  if (note.mandatoryReportRequired) {
    setImmediate(async () => {
      try {
        const [child] = await db.select({ firstName: childrenTable.firstName, lastName: childrenTable.lastName })
          .from(childrenTable).where(eq(childrenTable.id, note.childId));
        const childName = child ? `${child.firstName} ${child.lastName}` : `Child #${note.childId}`;
        await createNotificationsForRoles({
          roles: ["admin", "coordinator", "educational_leader"],
          type: "welfare_mandatory_report",
          title: `Mandatory report submitted — ${childName}`,
          body: note.mandatoryReportNotes ?? undefined,
          href: `/children/${note.childId}`,
          referenceId: note.childId,
          referenceType: "child",
          dedupeKeyPrefix: `welfare_mandatory_report:${note.id}`,
        });
      } catch (err) {
        logger.warn({ err }, "Failed to send mandatory report notification");
      }
    });
  }
});

router.patch("/welfare-notes/:id", async (req, res): Promise<void> => {
  const params = UpdateWelfareNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWelfareNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [note] = await db
    .update(welfareNotesTable)
    .set(parsed.data as any)
    .where(eq(welfareNotesTable.id, params.data.id))
    .returning();
  if (!note) {
    res.status(404).json({ error: "Welfare note not found" });
    return;
  }
  const staffList = await db.select().from(staffTable);
  const staff = staffList.find((s) => s.id === note.staffId);
  res.json(
    GetChildWelfareNotesResponseItem.parse({ ...note, staffName: staff ? `${staff.firstName} ${staff.lastName}` : null })
  );

  if (note.mandatoryReportRequired) {
    setImmediate(async () => {
      try {
        const [child] = await db.select({ firstName: childrenTable.firstName, lastName: childrenTable.lastName })
          .from(childrenTable).where(eq(childrenTable.id, note.childId));
        const childName = child ? `${child.firstName} ${child.lastName}` : `Child #${note.childId}`;
        await createNotificationsForRoles({
          roles: ["admin", "coordinator", "educational_leader"],
          type: "welfare_mandatory_report",
          title: `Mandatory report submitted — ${childName}`,
          body: note.mandatoryReportNotes ?? undefined,
          href: `/children/${note.childId}`,
          referenceId: note.childId,
          referenceType: "child",
          dedupeKeyPrefix: `welfare_mandatory_report:${note.id}`,
        });
      } catch (err) {
        logger.warn({ err }, "Failed to send mandatory report notification");
      }
    });
  }
});

router.delete("/welfare-notes/:id", async (req, res): Promise<void> => {
  const params = DeleteWelfareNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [note] = await db
    .delete(welfareNotesTable)
    .where(eq(welfareNotesTable.id, params.data.id))
    .returning();
  if (!note) {
    res.status(404).json({ error: "Welfare note not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
