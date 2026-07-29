import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { eq, and, desc, isNull, lte, gte, inArray, not, isNotNull } from "drizzle-orm";
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
  childMedicationsTable,
  childrenTable,
  parentAccountsTable,
  emailSendLogTable,
} from "@workspace/db";
import { createNotification, createNotificationsForRoles, getISOWeek, getYearMonth } from "../lib/notify";
import { sendMedicationExpiryEmail, sendGuardianMedicationExpiryEmail } from "../lib/email";
import { getEmailBranding } from "../lib/emailBranding";
import { isEmailChannelEnabled, isInAppChannelEnabled } from "../lib/channelMap";
import { getAppUrl } from "../lib/appUrl";

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
  if (await isEnabled("staff_qualification_expiry")) {
    const advanceDays = await getAdvanceDays("staff_qualification_expiry");
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + advanceDays);
    const windowEndStr = windowEnd.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];
    const monthKey = getYearMonth(today);

    const quals = await db.select({
      id: staffQualificationsTable.id,
      staffId: staffQualificationsTable.staffId,
      name: staffQualificationsTable.name,
      expiryDate: staffQualificationsTable.expiryDate,
      staffFirstName: staffTable.firstName,
      staffLastName: staffTable.lastName,
    })
      .from(staffQualificationsTable)
      .innerJoin(staffTable, and(
        eq(staffTable.id, staffQualificationsTable.staffId),
        eq(staffTable.status, "active"),
      ));

    for (const qual of quals) {
      if (!qual.expiryDate) continue;
      const expiryStr = typeof qual.expiryDate === "string" ? qual.expiryDate : qual.expiryDate;
      if (expiryStr < todayStr || expiryStr > windowEndStr) continue;

      const name = `${qual.staffFirstName} ${qual.staffLastName}`;

      const recipients = await db.select({ id: staffTable.id })
        .from(staffTable)
        .where(and(
          inArray(staffTable.role, ["admin", "educational_leader"]),
          eq(staffTable.status, "active"),
        ));

      for (const r of recipients) {
        await createNotification({
          staffId: r.id,
          type: "staff_qualification_expiry",
          title: `${name} — ${qual.name ?? "qualification"} expires ${expiryStr}`,
          href: `/staff/${qual.staffId}`,
          referenceId: qual.staffId,
          referenceType: "staff",
          dedupeKey: `staff_qualification_expiry:${qual.id}:${monthKey}:${r.id}`,
        });
      }
    }
  }

  // ── 3. No published plan for current week ────────────────────────────────────
  if (await isEnabled("weekly_plan_missing")) {
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
            type: "weekly_plan_missing",
            title: "No published plan for the current week",
            href: "/planning",
            dedupeKey: `weekly_plan_missing:${site.id}:${weekKey}:${c.id}`,
          });
        }
      }
    }
  }

  // ── 4. Medication expiry ─────────────────────────────────────────────────────
  if (await isEnabled("medication_expiry")) {
    const advanceDays = await getAdvanceDays("medication_expiry");
    const monthKey = getYearMonth(today);
    const todayStr = today.toISOString().split("T")[0];
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + advanceDays);
    const windowEndStr = windowEnd.toISOString().split("T")[0];

    const meds = await db.select({
      id: childMedicationsTable.id,
      name: childMedicationsTable.name,
      expiryDate: childMedicationsTable.expiryDate,
      childId: childMedicationsTable.childId,
    }).from(childMedicationsTable)
      .where(and(
        isNotNull(childMedicationsTable.expiryDate),
        isNotNull(childMedicationsTable.name),
      ));

    for (const med of meds) {
      if (!med.expiryDate || !med.name) continue;
      const expiryStr = typeof med.expiryDate === "string" ? med.expiryDate : (med.expiryDate as Date).toISOString().split("T")[0];
      // Alert window: from today through advanceDays ahead (or already expired — still alert once per month)
      if (expiryStr > windowEndStr) continue;

      const [child] = await db.select({
        firstName: childrenTable.firstName,
        lastName: childrenTable.lastName,
        siteId: childrenTable.siteId,
        guardianEmail: childrenTable.guardianEmail,
        guardian2Email: childrenTable.guardian2Email,
      }).from(childrenTable).where(eq(childrenTable.id, med.childId));

      if (!child) continue;

      const childName = `${child.firstName} ${child.lastName}`;
      const childProfileUrl = `${getAppUrl()}/children/${med.childId}`;
      const medicationLogsUrl = `${getAppUrl()}/medication-logs`;

      // ── In-app notifications → active staff at the child's site ─────────────
      if (await isInAppChannelEnabled("medication_expiry")) {
        const siteStaff = await db.select({ id: staffTable.id })
          .from(staffTable)
          .where(and(
            inArray(staffTable.role, ["admin", "educational_leader", "coordinator", "educator"]),
            eq(staffTable.status, "active"),
            ...(child.siteId ? [eq(staffTable.siteId, child.siteId)] : []),
          ));

        for (const s of siteStaff) {
          await createNotification({
            staffId: s.id,
            type: "medication_expiry",
            title: `${childName} — ${med.name} expires ${expiryStr}`,
            href: `/children/${med.childId}`,
            referenceId: med.id,
            referenceType: "child_medication",
            dedupeKey: `medication_expiry:${med.id}:${monthKey}:${s.id}`,
          });
        }
      }

      // ── Email → site staff + guardians with portal accounts ─────────────────
      if (await isEmailChannelEnabled("medication_expiry")) {
        // Staff emails
        const staffEmailRows = await db.select({ email: staffTable.email })
          .from(staffTable)
          .where(and(
            inArray(staffTable.role, ["admin", "educational_leader", "coordinator", "educator"]),
            eq(staffTable.status, "active"),
            ...(child.siteId ? [eq(staffTable.siteId, child.siteId)] : []),
          ));
        const staffEmailSet = new Set(
          staffEmailRows.map((s) => s.email).filter((e): e is string => !!e),
        );

        // Guardian emails (only those with parent accounts)
        const guardianCandidates = [child.guardianEmail, child.guardian2Email].filter((e): e is string => !!e);
        const guardianAccounts = guardianCandidates.length > 0
          ? await db.select({ guardianEmail: parentAccountsTable.guardianEmail })
              .from(parentAccountsTable)
              .where(inArray(parentAccountsTable.guardianEmail, guardianCandidates))
          : [];
        const guardianEmailSet = new Set(
          guardianAccounts.map((a) => a.guardianEmail).filter((e): e is string => !!e),
        );

        const allCandidateEmails = [
          ...staffEmailSet,
          ...guardianEmailSet,
        ].filter((e, idx, arr) => arr.indexOf(e) === idx);

        if (allCandidateEmails.length > 0) {
          // ── Per-recipient monthly deduplification ───────────────────────────
          // Attempt to insert a dedupe record for each candidate. ON CONFLICT DO
          // NOTHING returns 0 rows when the record already exists — meaning this
          // recipient already received the email this month for this medication.
          const branding = await getEmailBranding();
          for (const email of allCandidateEmails) {
            const key = `medication_expiry_email:${med.id}:${monthKey}:${email}`;
            // Check dedupe before sending — skip if already recorded this month
            const existing = await db.select({ id: emailSendLogTable.id })
              .from(emailSendLogTable)
              .where(eq(emailSendLogTable.dedupeKey, key))
              .limit(1);
            if (existing.length > 0) continue;

            // Guardians receive a plain-language reminder linking to their portal;
            // staff receive the detailed admin template linking to the child profile.
            const isGuardian = guardianEmailSet.has(email) && !staffEmailSet.has(email);
            const { sent } = isGuardian
              ? await sendGuardianMedicationExpiryEmail([email], {
                  childName,
                  medicationName: med.name,
                  expiryDate: expiryStr,
                  medicationLogsUrl,
                }, branding)
              : await sendMedicationExpiryEmail([email], {
                  childName,
                  medicationName: med.name,
                  expiryDate: expiryStr,
                  childProfileUrl,
                }, branding);

            // Only record the dedupe key when delivery was confirmed.
            // If send failed, `sent` is empty and no row is written, so
            // the next scheduled run will retry this recipient.
            if (sent.includes(email)) {
              await db.insert(emailSendLogTable)
                .values({ dedupeKey: key })
                .onConflictDoNothing();
            }
          }
        }
      }
    }
  }

  // ── 5. Checklist deadlines ───────────────────────────────────────────────────
  if (await isEnabled("checklist_overdue")) {
    const advanceDays = await getAdvanceDays("checklist_overdue");
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

      const dedupeBase = `checklist_overdue:${routine.id}:${targetStr}`;

      if (routine.staffId) {
        await createNotification({
          staffId: routine.staffId,
          type: "checklist_overdue",
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
            type: "checklist_overdue",
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

  computeDeadlineNotifications().catch((err) => logger.warn({ err }, "Deadline notification computation failed"));

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
router.get("/notification-settings", async (req, res): Promise<void> => {
  const siteId = req.query.siteId ? parseInt(req.query.siteId as string) : null;

  // Always fetch global (siteId IS NULL) settings as the base
  const globalSettings = await db.select()
    .from(notificationSettingsTable)
    .where(isNull(notificationSettingsTable.siteId))
    .orderBy(notificationSettingsTable.id);

  if (!siteId) {
    res.json(globalSettings);
    return;
  }

  // Fetch site-specific overrides
  const siteSettings = await db.select()
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.siteId, siteId));

  // Merge: site-specific overrides take precedence over global
  const merged = globalSettings.map((g) => {
    const override = siteSettings.find((s) => s.type === g.type);
    if (override) return override;
    // Return a "virtual" site-scoped row from global defaults (id=0 flags it as unsaved)
    return { ...g, id: 0, siteId };
  });

  res.json(merged);
});

// ── PUT /notification-settings ────────────────────────────────────────────────
router.put("/notification-settings", async (req, res): Promise<void> => {
  const updates = req.body as Array<{ type: string; enabled: boolean; advanceDays?: number | null; siteId?: number | null }>;
  for (const u of updates) {
    if (u.siteId) {
      // Upsert a site-specific override
      const [existing] = await db.select({ id: notificationSettingsTable.id })
        .from(notificationSettingsTable)
        .where(and(
          eq(notificationSettingsTable.type, u.type),
          eq(notificationSettingsTable.siteId, u.siteId),
        ));
      if (existing) {
        await db.update(notificationSettingsTable)
          .set({ enabled: u.enabled, advanceDays: u.advanceDays ?? null })
          .where(eq(notificationSettingsTable.id, existing.id));
      } else {
        const [globalRow] = await db.select()
          .from(notificationSettingsTable)
          .where(and(eq(notificationSettingsTable.type, u.type), isNull(notificationSettingsTable.siteId)));
        await db.insert(notificationSettingsTable).values({
          type: u.type,
          label: globalRow?.label ?? u.type,
          description: globalRow?.description,
          enabled: u.enabled,
          advanceDays: u.advanceDays ?? null,
          siteId: u.siteId,
        });
      }
    } else {
      // Update global setting
      await db.update(notificationSettingsTable)
        .set({ enabled: u.enabled, advanceDays: u.advanceDays ?? null })
        .where(and(eq(notificationSettingsTable.type, u.type), isNull(notificationSettingsTable.siteId)));
    }
  }
  res.json({ ok: true });
});

export default router;
