import { Router, type IRouter } from "express";
import { eq, and, isNotNull, isNull, inArray } from "drizzle-orm";
import { db, noticesTable, parentAccountsTable, childrenTable } from "@workspace/db";
import { CreateNoticeBody, DeleteNoticeParams, ListNoticesResponse, ListNoticesResponseItem, UpdateNoticeBody, UpdateNoticeParams } from "@workspace/api-zod";
import { sendGuardianNoticeEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { isEmailChannelEnabled } from "../lib/channelMap";
import { getAppUrl } from "../lib/appUrl";

const router: IRouter = Router();

router.get("/notices", async (req, res): Promise<void> => {
  const audience = req.query.audience as string | undefined;
  const siteIdParam = req.query.siteId as string | undefined;
  const siteId = siteIdParam ? parseInt(siteIdParam) : null;

  let query = db.select().from(noticesTable).$dynamic();

  const conditions = [];
  if (audience) conditions.push(eq(noticesTable.audience, audience));
  if (siteId) conditions.push(eq(noticesTable.siteId, siteId));

  if (conditions.length > 0) {
    query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
  }

  const rows = await query.orderBy(noticesTable.createdAt);
  res.json(ListNoticesResponse.parse(rows));
});

router.post("/notices", async (req, res): Promise<void> => {
  const parsed = CreateNoticeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [notice] = await db.insert(noticesTable).values(parsed.data as any).returning();

  if (notice.audience === "guardian") {
    // Build the guardian query — scope to site when notice has a siteId
    const baseConditions = [
      isNotNull(parentAccountsTable.passwordHash),
      isNull(parentAccountsTable.blockedAt),
    ];

    let guardians;
    if (notice.siteId) {
      guardians = await db
        .selectDistinct({ email: parentAccountsTable.guardianEmail })
        .from(parentAccountsTable)
        .innerJoin(
          childrenTable,
          and(
            eq(childrenTable.guardianEmail, parentAccountsTable.guardianEmail),
            eq(childrenTable.status, "active"),
            eq(childrenTable.siteId, notice.siteId),
          ),
        )
        .where(and(...baseConditions));
    } else {
      guardians = await db
        .selectDistinct({ email: parentAccountsTable.guardianEmail })
        .from(parentAccountsTable)
        .innerJoin(
          childrenTable,
          and(
            eq(childrenTable.guardianEmail, parentAccountsTable.guardianEmail),
            eq(childrenTable.status, "active"),
          ),
        )
        .where(and(...baseConditions));
    }

    const recipients = guardians.map((g) => g.email);
    const strippedContent = notice.content.replace(/<[^>]*>/g, "").trim().slice(0, 300);
    isEmailChannelEnabled("guardian_notice").then((emailEnabled) => {
      if (!emailEnabled || recipients.length === 0) return;
      return getEmailBranding().then((branding) =>
        sendGuardianNoticeEmail(recipients, {
          noticeTitle: notice.title,
          priority: notice.priority,
          content: strippedContent,
          portalUrl: getAppUrl(),
        }, branding)
      );
    }).catch((err) => req.log.warn({ err }, "Guardian notice email dispatch failed"));
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
