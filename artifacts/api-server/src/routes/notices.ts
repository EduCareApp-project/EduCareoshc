import { Router, type IRouter } from "express";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { db, noticesTable, parentAccountsTable } from "@workspace/db";
import { CreateNoticeBody, DeleteNoticeParams, ListNoticesResponse, ListNoticesResponseItem, UpdateNoticeBody, UpdateNoticeParams } from "@workspace/api-zod";
import { sendGuardianNoticeEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";

const router: IRouter = Router();

function getPortalUrl(): string {
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  return `https://${domains[0] ?? "localhost"}`;
}

router.get("/notices", async (req, res): Promise<void> => {
  const audience = req.query.audience as string | undefined;
  const rows = audience
    ? await db.select().from(noticesTable).where(eq(noticesTable.audience, audience)).orderBy(noticesTable.createdAt)
    : await db.select().from(noticesTable).orderBy(noticesTable.createdAt);
  res.json(ListNoticesResponse.parse(rows));
});

router.post("/notices", async (req, res): Promise<void> => {
  const parsed = CreateNoticeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [notice] = await db.insert(noticesTable).values(parsed.data as any).returning();

  if (notice.audience === "guardian") {
    const guardians = await db
      .select({ email: parentAccountsTable.guardianEmail })
      .from(parentAccountsTable)
      .where(and(isNotNull(parentAccountsTable.passwordHash), isNull(parentAccountsTable.blockedAt)));
    const recipients = guardians.map((g) => g.email);
    const strippedContent = notice.content.replace(/<[^>]*>/g, "").trim().slice(0, 300);
    getEmailBranding().then((branding) =>
      sendGuardianNoticeEmail(recipients, {
        noticeTitle: notice.title,
        priority: notice.priority,
        content: strippedContent,
        portalUrl: getPortalUrl(),
      }, branding)
    ).catch((err) => req.log.warn({ err }, "Guardian notice email dispatch failed"));
  }

  res.status(201).json(ListNoticesResponseItem.parse(notice));
});

router.patch("/notices/:id", async (req, res): Promise<void> => {
  const params = UpdateNoticeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = UpdateNoticeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [notice] = await db
    .update(noticesTable)
    .set(body.data as any)
    .where(eq(noticesTable.id, params.data.id))
    .returning();
  if (!notice) { res.status(404).json({ error: "Notice not found" }); return; }
  res.json(ListNoticesResponseItem.parse(notice));
});

router.delete("/notices/:id", async (req, res): Promise<void> => {
  const params = DeleteNoticeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [notice] = await db.delete(noticesTable).where(eq(noticesTable.id, params.data.id)).returning();
  if (!notice) { res.status(404).json({ error: "Notice not found" }); return; }
  res.sendStatus(204);
});

export default router;
