import { addDays, format } from "date-fns";
import type { OrganisationCalendarEvent } from "@workspace/api-client-react";

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
export function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toYmd(parseYmd(s)) === s;
}
export function gridDays(month: Date): string[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const total = Math.ceil((last.getDate() + ((first.getDay() + 6) % 7)) / 7) * 7;
  return Array.from({ length: total }, (_, i) => toYmd(addDays(start, i)));
}
export function eventsOnDay(events: OrganisationCalendarEvent[], day: string) {
  return events
    .filter((e) => e.startDate <= day && e.endDate >= day)
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title));
}
export function timeLabel(e: OrganisationCalendarEvent): string {
  if (!e.startTime) return "All day";
  const f = (t: string) => format(new Date(2000, 0, 1, +t.slice(0, 2), +t.slice(3, 5)), "h:mm a");
  return e.endTime ? `${f(e.startTime)} - ${f(e.endTime)}` : f(e.startTime);
}
export function dateRangeLabel(e: OrganisationCalendarEvent): string {
  const a = format(parseYmd(e.startDate), "EEE d MMM yyyy");
  return e.endDate === e.startDate ? a : `${a} to ${format(parseYmd(e.endDate), "EEE d MMM yyyy")}`;
}
export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { error?: string; message?: string } | null; message?: string };
  return e?.data?.error || e?.data?.message || e?.message || fallback;
}
