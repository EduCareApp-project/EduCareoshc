import { db, notificationsTable, notificationSettingsTable, childMedicationsTable, childrenTable, staffQualificationsTable, staffTable } from "@workspace/db";
import { and, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { createNotification } from "./notify";
import { isInAppChannelEnabled } from "./channelMap";

export function expiryReminderKey(type: string, id: number, expiry: string, staffId: number, today: string): string {
  // Overdue issues return daily; upcoming reminders retain monthly acknowledgement.
  const period = expiry < today ? today : today.slice(0, 7);
  return `live:${type}:${id}:${expiry}:${period}:${staffId}`;
}

type Recipient = { id: number; role: string; siteId?: number | null };
const pending = new Map<number, Promise<void>>();

/** Refresh only this staff member's inbox, without changing email reminder frequency. */
export async function syncExpiryInbox(user: Recipient): Promise<void> {
  const existing = pending.get(user.id);
  if (existing) return existing;
  const work = refresh(user);
  pending.set(user.id, work);
  try { await work; } finally { pending.delete(user.id); }
}

async function refresh(user: Recipient): Promise<void> {
  if (user.role === "onboarding") return;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const settings = await db.select().from(notificationSettingsTable).where(isNull(notificationSettingsTable.siteId));
  const keys: string[] = [];
  const fullAccess = !["educator", "coordinator"].includes(user.role);
  const setting = (type: string) => settings.find((s) => s.type === type);
  const withinWindow = (expiry: string, days: number) => {
    const end = new Date(`${today}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + days);
    return expiry <= end.toISOString().slice(0, 10);
  };

  if (setting("medication_expiry")?.enabled !== false && await isInAppChannelEnabled("medication_expiry")
      && (fullAccess || user.siteId != null)) {
    const meds = await db.select({
      id: childMedicationsTable.id, childId: childMedicationsTable.childId, slot: childMedicationsTable.slot,
      name: childMedicationsTable.name, expiry: childMedicationsTable.expiryDate,
      firstName: childrenTable.firstName, lastName: childrenTable.lastName,
    }).from(childMedicationsTable).innerJoin(childrenTable, and(
      eq(childrenTable.id, childMedicationsTable.childId), eq(childrenTable.status, "active"),
      ...(fullAccess ? [] : [eq(childrenTable.siteId, user.siteId!)]),
    ));
    for (const med of meds) {
      if (!med.name || !med.expiry || !withinWindow(med.expiry, setting("medication_expiry")?.advanceDays ?? 14)) continue;
      const key = expiryReminderKey("medication_expiry", med.id, med.expiry, user.id, today);
      keys.push(key);
      await createNotification({
        staffId: user.id, type: "medication_expiry",
        title: `${med.firstName} ${med.lastName} — ${med.name} ${med.expiry < today ? "expired" : "expires"} ${med.expiry}`,
        href: `/children/${med.childId}?tab=medical&slot=${med.slot}`,
        referenceId: med.id, referenceType: "child_medication", dedupeKey: key,
      });
    }
  }
  if (setting("staff_qualification_expiry")?.enabled !== false && await isInAppChannelEnabled("staff_qualification_expiry")) {
    const quals = await db.select({
      id: staffQualificationsTable.id, staffId: staffQualificationsTable.staffId,
      name: staffQualificationsTable.name, expiry: staffQualificationsTable.expiryDate,
      firstName: staffTable.firstName, lastName: staffTable.lastName,
    }).from(staffQualificationsTable).innerJoin(staffTable, and(
      eq(staffTable.id, staffQualificationsTable.staffId), eq(staffTable.status, "active"),
      ...(fullAccess ? [] : [eq(staffTable.id, user.id)]),
    )).where(isNull(staffQualificationsTable.archivedAt));
    for (const qual of quals) {
      if (!qual.expiry || !withinWindow(qual.expiry, setting("staff_qualification_expiry")?.advanceDays ?? 30)) continue;
      const key = expiryReminderKey("staff_qualification_expiry", qual.id, qual.expiry, user.id, today);
      keys.push(key);
      await createNotification({
        staffId: user.id, type: "staff_qualification_expiry",
        title: `${qual.firstName} ${qual.lastName} — ${qual.name ?? "qualification"} ${qual.expiry < today ? "expired" : "expires"} ${qual.expiry}`,
        href: `/staff/${qual.staffId}`, referenceId: qual.id, referenceType: "staff_qualification", dedupeKey: key,
      });
    }
  }
  // Retire resolved, superseded and previous-day reminders. Keep the current
  // day's read state intact, so polling never immediately undoes acknowledgement.
  await db.update(notificationsTable).set({ read: true }).where(and(
    eq(notificationsTable.staffId, user.id),
    inArray(notificationsTable.type, ["medication_expiry", "staff_qualification_expiry"]),
    eq(notificationsTable.read, false),
    ...(keys.length ? [or(isNull(notificationsTable.dedupeKey), notInArray(notificationsTable.dedupeKey, keys))] : []),
  ));
}
