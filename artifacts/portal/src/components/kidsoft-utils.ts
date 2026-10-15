import type { KidsoftRollBooking } from "@workspace/api-client-react";

const melbourneDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
});

export function melbourneToday(now = new Date()): string {
  return melbourneDayFormatter.format(now);
}

/** Locate the next local day boundary, including 23/25-hour daylight-saving days. */
export function millisecondsUntilMelbourneTomorrow(now = new Date()): number {
  const today = melbourneToday(now);
  let start = now.getTime();
  let end = start + 27 * 60 * 60 * 1000;
  while (end - start > 1) {
    const middle = Math.floor((start + end) / 2);
    if (melbourneToday(new Date(middle)) === today) start = middle;
    else end = middle;
  }
  return end - now.getTime();
}

export function schoolCareSession(name: string): "Before School Care" | "After School Care" | null {
  const lower = name.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, "");
  if (compact.includes("beforeschool") || /\bbsc\b/.test(lower) || compact === "casualbsc" || compact === "earlymorning") {
    return "Before School Care";
  }
  if (compact.includes("afterschool") || /\basc\b/.test(lower) || compact === "casualasc" || compact === "latepickup") {
    return "After School Care";
  }
  return null;
}

export function groupSchoolCareBookings(bookings: KidsoftRollBooking[]) {
  return (["Before School Care", "After School Care"] as const).map((name) => ({
    name,
    bookings: bookings.filter((booking) => schoolCareSession(booking.sessionName) === name)
      .sort((a, b) => a.childName.localeCompare(b.childName) || a.startTime.localeCompare(b.startTime)),
  }));
}

export function formatMelbourneDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown time";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(d);
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const e = error as { data?: { error?: unknown }; message?: unknown } | null;
  const raw = typeof e?.data?.error === "string" ? e.data.error : typeof e?.message === "string" ? e.message : "";
  const clean = raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 200) return fallback;
  return clean;
}
