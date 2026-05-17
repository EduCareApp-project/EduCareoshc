import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, lte, gte, inArray, not } from "drizzle-orm";
import {
  db,
  notificationsTable,
  notificationSettingsTable,
  staffTable,
  staffQualificationsTable,
  qipItemsTable,
  checklistRoutinesTable,
  planningExperiencesTable,
  sitesTable,
} from "@workspace/db";
import { createNotification, createNotificationsForRoles, getISOWeek, getYearMonth } from "../lib/notify";

const router: IRouter = Router();

async function getAdvanceDays(type: string): Promise<number> {
  const [s] = await db.select({ advanceDays: notificationSettingsTable.advanceDays })
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.type, type));
  return s?.advanceDays ?? 14;
}

async function isEnabled(type: string): Promise<boolean> {
  const [s] = await db.select({ enabled: notificationSettingsTable.enabled })
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.type, type));
  return s?.enabled !== false;
}

async function computeDeadlineNotifications(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekKey = getISOWeek(today);

  // ── 1. QIP deadlines ────────────────────────────────────────────────────────
  if (await isEnabled("qip_deadline") || await isEnabled("qip_deadline_expired")) {
    const advanceDays = await getAdvanceDays("qip_deadline");
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + advanceDays);
    const windowEndStr = windowEnd.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const items = await db.select().from(qipItemsTable).where(isNull(qipItemsTable.archivedAt));

    for (const item of items) {
      if (!item.dueDate) continue;
      const dueStr = typeof item.dueDate === "string" ? item.dueDate : item.dueDate;

      if (await isEnabled("qip_deadline") && dueStr >= todayStr && dueStr <= windowEndStr) {
        const key = `qip_deadline:${item.id}:${weekKey}`;
        const recipients = [
          ...(await db.select({ id: staffTable.id, siteId: staffTable.siteId })
            .from(staffTable)
            .where(and(eq(staffTable.role, "coordinator"), eq(staffTable.status, "active")))),
          ...(await db.select({ id: staffTable.id, siteId: staffTable.siteId })
            .from(staffTable)
            .where(and(eq(staffTable.role, "educational_leader"), eq(staffTable.status, "active")))),
        ];
        for (const s of recipients) {
          if (item.siteId && s.siteId !== item.siteId && s.siteId != null) continue;
          await createNotification({
            staffId: s.id,
            type: "qip_deadline",
            title: `QIP item due ${dueStr}`,
            body: item.issueIdentified ?? item.outcomeGoal ?? undefined,
            href: "/qip",
            referenceId: item.id,
            referenceType: "qip_item",
            dedupeKey: `${key}:${s.id}`,
          });
        }
      }

      if (await isEnabled("qip_deadline_expired") && dueStr < todayStr) {
        const monthKey = getYearMonth(today);
        const key = `qip_deadline_expired:${item.id}:${monthKey}`;
        const recipients = [
          ...(await db.select({ id: staffTable.id, siteId: staffTable.siteId })
            .from(staffTable)
            .where(and(eq(staffTable.role, "coordinator"), eq(staffTable.status, "active")))),
          ...(await db.select({ id: staffTable.id, siteId: staffTable.siteId })
            .from(staffTable)
            .where(and(eq(staffTable.role, "educational_leader"), eq(staffTable.status, "active")))),
        ];
        for (const s of recipients) {
          if (item.siteId && s.siteId !== item.siteId && s.siteId != null) continue;
          await createNotification({
            staffId: s.id,
            type: "qip_deadline_expired",
            title: `QIP item overdue (was due ${dueStr})`,
            body: item.issueIdentified ?? item.outcomeGoal ?? undefined,
            href: "/qip",
            referenceId: item.id,
            referenceType: "qip_item",
            dedupeKey: `${key}:${s.id}`,
          });
        }
      }
    }
  }

  // ── 2. Staff compliance (qualifying expiry) ──────────────────────────────────
  if (await isEnabled("staff_compliance_due")) {
    const advanceDays = await getAdvanceDays("staff_compliance_due");
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + advanceDays);
    const windowEndStr = windowEnd.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];
    const monthKey = getYearMonth(today);

    const quals = await db.select({
      id: staffQualificationsTable.id,
      staffId: staffQualificationsTable.staffId,
      type: staffQualificationsTable.type,
      expiryDate: staffQualificationsTable.expiryDate,
    }).from(staffQualificationsTable);

    for (const qual of quals) {
      if (!qual.expiryDate) continue;
      const expiryStr = typeof qual.expiryDate === "string" ? qual.expiryDate : qual.expiryDate;
      if (expiryStr < todayStr || expiryStr > windowEndStr) continue;

      const [member] = await db.select({ firstName: staffTable.firstName, lastName: staffTable.lastName })
        .from(staffTable).where(eq(staffTable.id, qual.staffId));
      const name = member ? `${member.firstName} ${member.lastName}` : `Staff #${qual.staffId}`;

      const recipients = await db.select({ id: staffTable.id })
        .from(staffTable)
        .where(and(
          inArray(staffTable.role, ["admin", "educational_leader"]),
          eq(staffTable.status, "active"),
        ));

      for (const r of recipients) {
        await createNotification({
          staffId: r.id,
          type: "staff_compliance_due",
          title: `${name} — ${qual.type ?? "qualification"} expires ${expiryStr}`,
          href: `/staff/${qual.staffId}`,
          referenceId: qual.staffId,
          referenceType: "staff",
          dedupeKey: `staff_compliance_due:${qual.id}:${monthKey}:${r.id}`,
        });
      }
    }
  }

  // ── 3. No published plan for current week ────────────────────────────────────
  if (await isEnabled("no_published_plan")) {
    const sites = await db.select({ id: sitesTable.id }).from(sitesTable);
    for (const site of sites) {
      // A "published" plan is one with weeklyPlanData set for this week's window
      // We check if there's any planning experience for this site with weeklyPlanData
      const plans = await db.select({ id: planningExperiencesTable.id })
        .from(planningExperiencesTable)
        .where(and(
          eq(planningExperiencesTable.siteId, site.id),
          not(isNull(planningExperiencesTable.weeklyPlanData)),
        ))
        .limit(1);

      if (plans.length === 0) {
        const coordinators = await db.select({ id: staffTable.id })
          .from(staffTable)
          .where(and(
            eq(staffTable.role, "coordinator"),
            eq(staffTable.status, "active"),
            eq(staffTable.siteId, site.id),
          ));
        for (const c of coordinators) {
          await createNotification({
            staffId: c.id,
            type: "no_published_plan",
            title: "No published plan for the current week",
            href: "/planning",
            dedupeKey: `no_published_plan:${site.id}:${weekKey}:${c.id}`,
          });
        }
      }
    }
  }

  // ── 4. Checklist deadlines ───────────────────────────────────────────────────
  if (await isEnabled("checklist_deadline")) {
    const advanceDays = await getAdvanceDays("checklist_deadline");
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + advanceDays);
    const windowEndStr = windowEnd.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    const routines = await db.select().from(checklistRoutinesTable);
    for (const routine of routines) {
      const targetStr = typeof routine.targetDate === "string"
        ? routine.targetDate
        : (routine.targetDate as Date).toISOString().split("T")[0];
      if (targetStr < todayStr || targetStr > windowEndStr) continue;

      const dedupeBase = `checklist_deadline:${routine.id}:${targetStr}`;

      if (routine.staffId) {
        await createNotification({
          staffId: routine.staffId,
          type: "checklist_deadline",
          title: `Checklist due ${targetStr}: ${routine.title}`,
          href: "/checklists",
          referenceId: routine.id,
          referenceType: "checklist_routine",
          dedupeKey: `${dedupeBase}:${routine.staffId}`,
        });
      } else {
        const coordinators = await db.select({ id: staffTable.id })
          .from(staffTable)
          .where(and(
            eq(staffTable.role, "coordinator"),
            eq(staffTable.status, "active"),
            ...(routine.siteId ? [eq(staffTable.siteId, routine.siteId)] : []),
          ));
        for (const c of coordinators) {
          await createNotification({
            staffId: c.id,
            type: "checklist_deadline",
            title: `Checklist due ${targetStr}: ${routine.title}`,
            href: "/checklists",
            referenceId: routine.id,
            referenceType: "checklist_routine",
            dedupeKey: `${dedupeBase}:${c.id}`,
          });
        }
      }
    }
  }
}

// ── GET /notifications ────────────────────────────────────────────────────────
router.get("/notifications", async (req, res): Promise<void> => {
  const userId = req.session.user!.id;

  computeDeadlineNotifications().catch(() => {});

  const items = await db.select()
    .from(notificationsTable)
    .where(eq(notificationsTable.staffId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(items);
});

// ── GET /notifications/count ─────────────────────────────────────────────────
router.get("/notifications/count", async (req, res): Promise<void> => {
  const userId = req.session.user!.id;
  const items = await db.select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.staffId, userId),
      eq(notificationsTable.read, false),
    ));
  res.json({ count: items.length });
});

// ── PUT /notifications/mark-all-read ─────────────────────────────────────────
router.put("/notifications/mark-all-read", async (req, res): Promise<void> => {
  const userId = req.session.user!.id;
  await db.update(notificationsTable).set({ read: true })
    .where(and(
      eq(notificationsTable.staffId, userId),
      eq(notificationsTable.read, false),
    ));
  res.json({ ok: true });
});

// ── PUT /notifications/:id/read ───────────────────────────────────────────────
router.put("/notifications/:id/read", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(notificationsTable).set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.staffId, req.session.user!.id)));
  res.json({ ok: true });
});

// ── GET /notification-settings ────────────────────────────────────────────────
router.get("/notification-settings", async (_req, res): Promise<void> => {
  const items = await db.select().from(notificationSettingsTable).orderBy(notificationSettingsTable.id);
  res.json(items);
});

// ── PUT /notification-settings ────────────────────────────────────────────────
router.put("/notification-settings", async (req, res): Promise<void> => {
  const updates = req.body as Array<{ type: string; enabled: boolean; advanceDays?: number | null }>;
  for (const u of updates) {
    await db.update(notificationSettingsTable)
      .set({ enabled: u.enabled, advanceDays: u.advanceDays ?? null })
      .where(eq(notificationSettingsTable.type, u.type));
  }
  res.json({ ok: true });
});

export default router;
