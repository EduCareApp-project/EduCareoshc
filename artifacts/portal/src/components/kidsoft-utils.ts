export function melbourneToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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
