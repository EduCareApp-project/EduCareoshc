import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, confidentialNotesTable, staffTable } from "@workspace/db";

const router: IRouter = Router();

async function enrichNote(note: typeof confidentialNotesTable.$inferSelect, staffList: (typeof staffTable.$inferSelect)[]) {
  const staff = staffList.find((s) => s.id === note.staffId);
  return {
    ...note,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
  };
}

router.get("/children/:id/confidential-notes", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [notes, staffList] = await Promise.all([
    db.select().from(confidentialNotesTable).where(eq(confidentialNotesTable.childId, childId)).orderBy(confidentialNotesTable.createdAt),
    db.select().from(staffTable),
  ]);
  res.json(await Promise.all(notes.map((n) => enrichNote(n, staffList))));
});

router.post("/confidential-notes", async (req, res): Promise<void> => {
  const { childId, staffId, content } = req.body;
  if (!childId || !content) { res.status(400).json({ error: "childId and content are required" }); return; }
  const [note] = await db.insert(confidentialNotesTable).values({ childId, staffId: staffId ?? null, content }).returning();
  const staffList = await db.select().from(staffTable);
  res.status(201).json(await enrichNote(note, staffList));
});

router.patch("/confidential-notes/:id", async (req, res): Promise<void> => {
  const noteId = parseInt(req.params.id);
  if (isNaN(noteId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: "content is required" }); return; }
  const [note] = await db.update(confidentialNotesTable).set({ content }).where(eq(confidentialNotesTable.id, noteId)).returning();
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  const staffList = await db.select().from(staffTable);
  res.json(await enrichNote(note, staffList));
});

router.delete("/confidential-notes/:id", async (req, res): Promise<void> => {
  const noteId = parseInt(req.params.id);
  if (isNaN(noteId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [note] = await db.delete(confidentialNotesTable).where(eq(confidentialNotesTable.id, noteId)).returning();
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  res.sendStatus(204);
});

export default router;
