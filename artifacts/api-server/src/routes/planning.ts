import { Router, type IRouter } from "express";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { db, planningExperiencesTable, parentAccountsTable } from "@workspace/db";
import {
  CreatePlanningExperienceBody, UpdatePlanningExperienceParams, UpdatePlanningExperienceBody,
  UpdatePlanningExperienceResponse, DeletePlanningExperienceParams,
  ListPlanningExperiencesResponse, GetPlanningExperienceParams, GetPlanningExperienceResponse,
} from "@workspace/api-zod";
import { sendWeeklyPlanPublishedEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";

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
    const guardians = await db
      .select({ email: parentAccountsTable.guardianEmail })
      .from(parentAccountsTable)
      .where(and(isNotNull(parentAccountsTable.passwordHash), isNull(parentAccountsTable.blockedAt)));
    const recipients = guardians.map((g) => g.email);
    const weekOf = exp.startDate ? formatDateAU(exp.startDate as string) : null;
    getEmailBranding().then((branding) =>
      sendWeeklyPlanPublishedEmail(recipients, {
        planTitle: exp.title ?? "Weekly Program",
        weekOf,
        portalUrl: getPortalUrl(),
      }, branding)
    ).catch((err) => req.log.warn({ err }, "Weekly plan published email dispatch failed"));
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

export default router;
