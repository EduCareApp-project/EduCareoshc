import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, observationsTable, childrenTable, staffTable, programsTable, sitesTable, observationCommentsTable } from "@workspace/db";
import { createNotification } from "../lib/notify";
import {
  CreateObservationBody,
  GetObservationParams,
  GetObservationResponse,
  UpdateObservationParams,
  UpdateObservationBody,
  UpdateObservationResponse,
  DeleteObservationParams,
  ListObservationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichObservation(obs: typeof observationsTable.$inferSelect) {
  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, obs.childId));
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, obs.staffId));
  const program = obs.programId
    ? (await db.select().from(programsTable).where(eq(programsTable.id, obs.programId)))[0]
    : null;
  const site = child?.siteId
    ? (await db.select().from(sitesTable).where(eq(sitesTable.id, child.siteId)))[0]
    : null;
  return {
    ...obs,
    childName: child ? `${child.firstName} ${child.lastName}` : null,
    staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
    siteName: site ? site.name : null,
    programName: program ? program.title : null,
  };
}

router.get("/observations", async (req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(observationsTable)
      .orderBy(desc(observationsTable.observationDate));

    const [childList, staffList, programList, siteList, commentCounts] = await Promise.all([
      db.select().from(childrenTable),
      db.select().from(staffTable),
      db.select().from(programsTable),
      db.select().from(sitesTable),
      db.select({ observationId: observationCommentsTable.observationId, count: count() })
        .from(observationCommentsTable)
        .groupBy(observationCommentsTable.observationId),
    ]);

    const countMap = new Map(commentCounts.map((r) => [r.observationId, r.count]));

    const enriched = rows.map((obs) => {
      const child = childList.find((c) => c.id === obs.childId);
      const staff = staffList.find((s) => s.id === obs.staffId);
      const program = programList.find((p) => p.id === obs.programId);
      const site = child?.siteId ? siteList.find((s) => s.id === child.siteId) : null;
      return {
        ...obs,
        childName: child ? `${child.firstName} ${child.lastName}` : null,
        staffName: staff ? `${staff.firstName} ${staff.lastName}` : null,
        siteName: site ? site.name : null,
        programName: program ? program.title : null,
        commentCount: countMap.get(obs.id) ?? 0,
      };
    });

    res.json(ListObservationsResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch observations");
    res.status(500).json({ error: "Failed to fetch observations" });
  }
});

router.post("/observations", async (req, res): Promise<void> => {
  const parsed = CreateObservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [obs] = await db.insert(observationsTable).values(parsed.data as any).returning();
    const enriched = await enrichObservation(obs);
    res.status(201).json(GetObservationResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err }, "Failed to create observation");
    res.status(500).json({ error: "Failed to create observation" });
  }
});

router.get("/observations/:id", async (req, res): Promise<void> => {
  const params = GetObservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [obs] = await db.select().from(observationsTable).where(eq(observationsTable.id, params.data.id));
    if (!obs) {
      res.status(404).json({ error: "Observation not found" });
      return;
    }
    const enriched = await enrichObservation(obs);
    res.json(GetObservationResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err, observationId: params.data.id }, "Failed to fetch observation");
    res.status(500).json({ error: "Failed to fetch observation" });
  }
});

router.patch("/observations/:id", async (req, res): Promise<void> => {
  const params = UpdateObservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateObservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [obs] = await db
      .update(observationsTable)
      .set({ ...(parsed.data as any), updatedAt: new Date() })
      .where(eq(observationsTable.id, params.data.id))
      .returning();
    if (!obs) {
      res.status(404).json({ error: "Observation not found" });
      return;
    }
    const enriched = await enrichObservation(obs);
    res.json(UpdateObservationResponse.parse(enriched));
  } catch (err) {
    req.log.error({ err, observationId: params.data.id }, "Failed to update observation");
    res.status(500).json({ error: "Failed to update observation" });
  }
});

router.delete("/observations/:id", async (req, res): Promise<void> => {
  const params = DeleteObservationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  try {
    const [obs] = await db
      .delete(observationsTable)
      .where(eq(observationsTable.id, params.data.id))
      .returning();
    if (!obs) {
      res.status(404).json({ error: "Observation not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, observationId: params.data.id }, "Failed to delete observation");
    res.status(500).json({ error: "Failed to delete observation" });
  }
});

// ── GET /observations/:id/comments ────────────────────────────────────────────
router.get("/observations/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const rows = await db.select().from(observationCommentsTable)
      .where(eq(observationCommentsTable.observationId, id))
      .orderBy(observationCommentsTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err, observationId: id }, "Failed to fetch observation comments");
    res.status(500).json({ error: "Failed to fetch observation comments" });
  }
});

// ── POST /observations/:id/comments ───────────────────────────────────────────
router.post("/observations/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { body } = req.body as { body?: string };
  if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

  try {
    const sessionUser = req.session?.user;
    let authorName = "Unknown";
    let staffId: number | null = null;
    if (sessionUser?.type === "staff") {
      staffId = sessionUser.id;
      const [s] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
        .from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
      if (s) authorName = `${s.firstName} ${s.lastName}`;
    }

    const [comment] = await db.insert(observationCommentsTable).values({
      observationId: id,
      staffId,
      authorName,
      body: body.trim(),
    }).returning();

    // Notify observation author + prior commenters (fire-and-forget)
    (async () => {
      try {
        const [obs] = await db.select({ staffId: observationsTable.staffId })
          .from(observationsTable).where(eq(observationsTable.id, id)).limit(1);
        const allPriorCommenters = await db.select({ staffId: observationCommentsTable.staffId })
          .from(observationCommentsTable)
          .where(eq(observationCommentsTable.observationId, id));

        const recipientIds = new Set<number>();
        if (obs?.staffId) recipientIds.add(obs.staffId);
        for (const c of allPriorCommenters) {
          if (c.staffId) recipientIds.add(c.staffId);
        }
        // Don't notify the person who just commented
        if (staffId) recipientIds.delete(staffId);

        for (const rid of recipientIds) {
          await createNotification({
            staffId: rid,
            type: "observation_comment",
            title: `New comment on an observation by ${authorName}`,
            body: body.trim().slice(0, 120),
            href: `/observations/${id}`,
            referenceId: id,
            referenceType: "observation",
            dedupeKey: `observation_comment:${id}:${comment.id}:${rid}`,
          });
        }
      } catch (_) { /* non-critical */ }
    })();

    res.status(201).json(comment);
  } catch (err) {
    req.log.error({ err, observationId: id }, "Failed to create observation comment");
    res.status(500).json({ error: "Failed to create observation comment" });
  }
});

// ── DELETE /observations/:id/comments/:commentId ──────────────────────────────
router.delete("/observations/:id/comments/:commentId", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const commentId = parseInt(req.params.commentId);
  if (isNaN(id) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(observationCommentsTable).where(
      and(eq(observationCommentsTable.id, commentId), eq(observationCommentsTable.observationId, id))
    );
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err, observationId: id, commentId }, "Failed to delete observation comment");
    res.status(500).json({ error: "Failed to delete observation comment" });
  }
});

export default router;
