import { db, notificationsTable, notificationSettingsTable, staffTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

export type NotificationType =
  | "post_comment"
  | "appraisal_submitted"
  | "incident_submitted"
  | "incident_closed"
  | "condition_submitted"
  | "condition_closed"
  | "policy_new"
  | "policy_updated"
  | "planning_published"
  | "qip_deadline"
  | "qip_deadline_expired"
  | "weekly_plan_missing"
  | "staff_qualification_expiry"
  | "checklist_overdue";

async function isTypeEnabled(type: NotificationType): Promise<boolean> {
  const [setting] = await db.select({ enabled: notificationSettingsTable.enabled })
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.type, type));
  return setting?.enabled !== false;
}

export async function createNotification(params: {
  staffId: number;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  referenceId?: number;
  referenceType?: string;
  dedupeKey?: string;
}): Promise<void> {
  if (!(await isTypeEnabled(params.type))) return;

  if (params.dedupeKey) {
    const [existing] = await db.select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.staffId, params.staffId),
        eq(notificationsTable.dedupeKey, params.dedupeKey),
      ))
      .limit(1);
    if (existing) return;
  }

  await db.insert(notificationsTable).values({
    staffId: params.staffId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    href: params.href ?? null,
    referenceId: params.referenceId ?? null,
    referenceType: params.referenceType ?? null,
    dedupeKey: params.dedupeKey ?? null,
  });
}

export async function createNotificationsForRoles(params: {
  roles: string[];
  siteId?: number | null;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  referenceId?: number;
  referenceType?: string;
  dedupeKeyPrefix?: string;
}): Promise<void> {
  if (!(await isTypeEnabled(params.type))) return;

  const staffList = await db.select({ id: staffTable.id, siteId: staffTable.siteId })
    .from(staffTable)
    .where(and(
      inArray(staffTable.role, params.roles),
      eq(staffTable.status, "active"),
    ));

  const targets = params.siteId != null
    ? staffList.filter((s) => s.siteId === params.siteId)
    : staffList;

  for (const s of targets) {
    await createNotification({
      staffId: s.id,
      type: params.type,
      title: params.title,
      body: params.body,
      href: params.href,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      dedupeKey: params.dedupeKeyPrefix
        ? `${params.dedupeKeyPrefix}:${s.id}`
        : undefined,
    });
  }
}

export function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
