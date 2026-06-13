import { Router, type IRouter } from "express";
import { eq, and, isNotNull, isNull, desc } from "drizzle-orm";
import { db, planningExperiencesTable, parentAccountsTable, childrenTable, planningCommentsTable, staffTable } from "@workspace/db";
import {
  CreatePlanningExperienceBody, UpdatePlanningExperienceParams, UpdatePlanningExperienceBody,
  UpdatePlanningExperienceResponse, DeletePlanningExperienceParams,
  ListPlanningExperiencesResponse, GetPlanningExperienceParams, GetPlanningExperienceResponse,
} from "@workspace/api-zod";
import { sendWeeklyPlanPublishedEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { isTypeEnabled } from "../lib/notify";
import { isEmailChannelEnabled } from "../lib/channelMap";

const router: IRouter = Router();

function getPortalUrl(): string {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  return `https://${domains[0] ?? "localhost"}`;
}

function formatDateAU(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${day} ${months[month - 1]} ${year}`;
}

router.get("/planning", async (_req, res): Promise<void> => {
  const rows = await db.select().from(planningExperiencesTable).orderBy(planningExperiencesTable.createdAt);
  res.json(ListPlanningExperiencesResponse.parse(rows));
});

router.post("/planning", async (req, res): Promise<void> => {
  const parsed = CreatePlanningExperienceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [exp] = await db.insert(planningExperiencesTable).values(parsed.data as any).returning();
  res.status(201).json(UpdatePlanningExperienceResponse.parse(exp));
});

router.get("/planning/:id", async (req, res): Promise<void> => {
  const params = GetPlanningExperienceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [exp] = await db.select().from(planningExperiencesTable).where(eq(planningExperiencesTable.id, params.data.id));
  if (!exp) { res.status(404).json({ error: "Planning experience not found" }); return; }
  res.json(GetPlanningExperienceResponse.parse(exp));
});

router.patch("/planning/:id", async (req, res): Promise<void> => {
  const params = UpdatePlanningExperienceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePlanningExperienceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db
    .select({ stage: planningExperiencesTable.stage })
    .from(planningExperiencesTable)
    .where(eq(planningExperiencesTable.id, params.data.id));

  const [exp] = await db.update(planningExperiencesTable).set(parsed.data as any).where(eq(planningExperiencesTable.id, params.data.id)).returning();
  if (!exp) { res.status(404).json({ error: "Planning experience not found" }); return; }

  const wasJustPublished = existing?.stage !== "published" && exp.stage === "published";
  if (wasJustPublished) {
    const weekOf = exp.startDate ? formatDateAU(exp.startDate as string) : null;
    // Only notify guardians whose active children are enrolled at the same site as the plan.
    // If the plan has no siteId, fall back to notifying all sites.
    const siteFilter = exp.siteId != null ? eq(childrenTable.siteId, exp.siteId) : undefined;
    const guardians = await db
      .selectDistinct({ email: parentAccountsTable.guardianEmail })
      .from(parentAccountsTable)
      .innerJoin(
        childrenTable,
        and(
          eq(childrenTable.guardianEmail, parentAccountsTable.guardianEmail),
          eq(childrenTable.status, "active"),
          siteFilter,
        ),
      )
      .where(and(isNotNull(parentAccountsTable.passwordHash), isNull(parentAccountsTable.blockedAt)));
    const recipients = guardians.map((g) => g.email);
    Promise.all([isTypeEnabled("planning_published"), isEmailChannelEnabled("guardian_weekly_plan")]).then(([typeEnabled, emailEnabled]) => {
      if (!typeEnabled || !emailEnabled || recipients.length === 0) return;
      return getEmailBranding().then((branding) =>
        sendWeeklyPlanPublishedEmail(recipients, {
          planTitle: exp.title ?? "Calendar",
          weekOf,
          portalUrl: getPortalUrl(),
        }, branding)
      );
    }).catch((err) => req.log.warn({ err }, "Weekly plan published email dispatch failed"));
  }

  res.json(UpdatePlanningExperienceResponse.parse(exp));
});

router.delete("/planning/:id", async (req, res): Promise<void> => {
  const params = DeletePlanningExperienceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [exp] = await db.delete(planningExperiencesTable).where(eq(planningExperiencesTable.id, params.data.id)).returning();
  if (!exp) { res.status(404).json({ error: "Planning experience not found" }); return; }
  res.sendStatus(204);
});

// ── GET /planning/:id/comments ────────────────────────────────────────────────
router.get("/planning/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(planningCommentsTable)
    .where(eq(planningCommentsTable.planningExperienceId, id))
    .orderBy(planningCommentsTable.createdAt);
  res.json(rows);
});

// ── POST /planning/:id/comments ───────────────────────────────────────────────
router.post("/planning/:id/comments", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { body } = req.body as { body?: string };
  if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

  const sessionUser = req.session?.user;
  let authorName = "Unknown";
  let staffId: number | null = null;
  if (sessionUser?.type === "staff") {
    staffId = sessionUser.id;
    const [s] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
      .from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
    if (s) authorName = `${s.firstName} ${s.lastName}`;
  }

  const [comment] = await db.insert(planningCommentsTable).values({
    planningExperienceId: id,
    staffId,
    authorName,
    body: body.trim(),
  }).returning();

  res.status(201).json(comment);
});

// ── DELETE /planning/:id/comments/:commentId ──────────────────────────────────
router.delete("/planning/:id/comments/:commentId", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const commentId = parseInt(req.params.commentId);
  if (isNaN(id) || isNaN(commentId)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(planningCommentsTable).where(
    and(eq(planningCommentsTable.id, commentId), eq(planningCommentsTable.planningExperienceId, id))
  );
  res.sendStatus(204);
});

export default router;
