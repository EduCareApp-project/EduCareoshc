import { Router, type IRouter } from "express";
import { eq, desc, or, inArray, sql, and } from "drizzle-orm";
import {
  db,
  behaviouralNotificationsTable,
  childrenTable,
  staffTable,
} from "@workspace/db";
import { sendBehaviouralNotificationEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { logger } from "../lib/logger";
import { isEmailChannelEnabled } from "../lib/channelMap";

const router: IRouter = Router();

// ── GET /children/:id/behavioural-notifications ────────────────────────────
router.get("/children/:id/behavioural-notifications", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db
    .select({
      id: behaviouralNotificationsTable.id,
      childId: behaviouralNotificationsTable.childId,
      sentByStaffId: behaviouralNotificationsTable.sentByStaffId,
      behaviourDescription: behaviouralNotificationsTable.behaviourDescription,
      supportRequest: behaviouralNotificationsTable.supportRequest,
      recipientEmails: behaviouralNotificationsTable.recipientEmails,
      sentAt: behaviouralNotificationsTable.sentAt,
      createdAt: behaviouralNotificationsTable.createdAt,
      sentByStaffName: sql<string | null>`CASE WHEN ${staffTable.id} IS NOT NULL THEN ${staffTable.firstName} || ' ' || ${staffTable.lastName} ELSE NULL END`,
    })
    .from(behaviouralNotificationsTable)
    .leftJoin(staffTable, eq(behaviouralNotificationsTable.sentByStaffId, staffTable.id))
    .where(eq(behaviouralNotificationsTable.childId, childId))
    .orderBy(desc(behaviouralNotificationsTable.sentAt));

  res.json(rows.map(r => ({
    ...r,
    childName: null,
    sentAt: r.sentAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  })));
});

// ── POST /children/:id/behavioural-notifications ───────────────────────────
router.post("/children/:id/behavioural-notifications", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  if (isNaN(childId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { behaviourDescription, supportRequest, recipientEmails } = req.body as { behaviourDescription?: string; supportRequest?: string; recipientEmails?: string[] };
  if (!behaviourDescription?.trim() || !supportRequest?.trim()) {
    res.status(400).json({ error: "behaviourDescription and supportRequest are required" }); return;
  }

  const [child] = await db.select().from(childrenTable).where(eq(childrenTable.id, childId));
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }

  const allGuardianEmails = [child.guardianEmail, child.guardian2Email].filter(Boolean) as string[];
  const recipients = (Array.isArray(recipientEmails) && recipientEmails.length > 0)
    ? recipientEmails.filter(e => allGuardianEmails.includes(e))
    : allGuardianEmails;

  const sessionUser = req.session?.user;
  const sentByStaffId = sessionUser?.type === "staff" ? sessionUser.id : null;

  const [row] = await db.insert(behaviouralNotificationsTable).values({
    childId,
    sentByStaffId,
    behaviourDescription,
    supportRequest,
    recipientEmails: recipients,
  }).returning();

  if (recipients.length > 0) {
    setImmediate(async () => {
      try {
        if (!await isEmailChannelEnabled("guardian_behavioural")) return;
        const branding = await getEmailBranding();
        await sendBehaviouralNotificationEmail(recipients, {
          childName: `${child.firstName} ${child.lastName}`,
          behaviourDescription,
          supportRequest,
          branding,
        });
      } catch (err) {
        logger.error({ err }, "Failed to send behavioural notification email");
      }
    });
  }

  let sentByStaffName: string | null = null;
  if (sentByStaffId) {
    const [s] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
      .from(staffTable).where(eq(staffTable.id, sentByStaffId)).limit(1);
    sentByStaffName = s ? `${s.firstName} ${s.lastName}` : null;
  }

  res.status(201).json({
    ...row,
    childName: `${child.firstName} ${child.lastName}`,
    sentByStaffName,
    sentAt: row.sentAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  });
});

// ── DELETE /children/:id/behavioural-notifications/:notifId ────────────────
router.delete("/children/:id/behavioural-notifications/:notifId", async (req, res): Promise<void> => {
  const childId = parseInt(req.params.id);
  const notifId = parseInt(req.params.notifId);
  if (isNaN(childId) || isNaN(notifId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select({ id: behaviouralNotificationsTable.id })
    .from(behaviouralNotificationsTable)
    .where(and(
      eq(behaviouralNotificationsTable.id, notifId),
      eq(behaviouralNotificationsTable.childId, childId),
    ));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(behaviouralNotificationsTable)
    .where(eq(behaviouralNotificationsTable.id, notifId));

  res.json({ ok: true });
});

// ── GET /guardians/:email/behavioural-notifications ────────────────────────
router.get("/guardians/:email/behavioural-notifications", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);

  const children = await db
    .select({ id: childrenTable.id, firstName: childrenTable.firstName, lastName: childrenTable.lastName })
    .from(childrenTable)
    .where(or(
      eq(childrenTable.guardianEmail, email),
      eq(childrenTable.guardian2Email, email),
    ));

  if (children.length === 0) { res.json([]); return; }

  const childIds = children.map(c => c.id);
  const childMap = Object.fromEntries(children.map(c => [c.id, `${c.firstName} ${c.lastName}`]));

  const rows = await db
    .select({
      id: behaviouralNotificationsTable.id,
      childId: behaviouralNotificationsTable.childId,
      sentByStaffId: behaviouralNotificationsTable.sentByStaffId,
      behaviourDescription: behaviouralNotificationsTable.behaviourDescription,
      supportRequest: behaviouralNotificationsTable.supportRequest,
      recipientEmails: behaviouralNotificationsTable.recipientEmails,
      sentAt: behaviouralNotificationsTable.sentAt,
      createdAt: behaviouralNotificationsTable.createdAt,
      sentByStaffName: sql<string | null>`CASE WHEN ${staffTable.id} IS NOT NULL THEN ${staffTable.firstName} || ' ' || ${staffTable.lastName} ELSE NULL END`,
    })
    .from(behaviouralNotificationsTable)
    .leftJoin(staffTable, eq(behaviouralNotificationsTable.sentByStaffId, staffTable.id))
    .where(inArray(behaviouralNotificationsTable.childId, childIds))
    .orderBy(desc(behaviouralNotificationsTable.sentAt));

  res.json(rows.map(r => ({
    ...r,
    childName: childMap[r.childId] ?? null,
    sentAt: r.sentAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  })));
});

export default router;
