const WEEK_MS = 7 * 86400000;

export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Calendar-only service dates and Monday week boundaries stay in UTC.
export function getWeekStartUTC(date: Date): string {
  const day = date.getUTCDay();
  const monday = new Date(date.getTime() + (day === 0 ? -6 : 1 - day) * 86400000);
  return monday.toISOString().slice(0, 10);
}

export function subtractWeeks(date: string, count: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - count * WEEK_MS).toISOString().slice(0, 10);
}

export function isEligibleRollWeek(serviceStartDate: string | null | undefined, weekStart: string): boolean {
  return !serviceStartDate || getWeekStartUTC(new Date(`${serviceStartDate}T00:00:00Z`)) <= weekStart;
}

type Submission = { siteId: number; weekStart: string; submitted: boolean; accurate: boolean };

export function buildRollPeriodCell(
  site: { id: number; serviceStartDate?: string | null },
  submissions: Submission[],
  currentWeekStart: string,
  weeksCount: number,
) {
  const cutoff = subtractWeeks(currentWeekStart, weeksCount);
  const openingWeek = site.serviceStartDate ? getWeekStartUTC(new Date(`${site.serviceStartDate}T00:00:00Z`)) : cutoff;
  const firstEligibleWeek = openingWeek > cutoff ? openingWeek : cutoff;
  const totalPossible = Math.max(0, Math.round(
    (new Date(`${currentWeekStart}T00:00:00Z`).getTime() - new Date(`${firstEligibleWeek}T00:00:00Z`).getTime()) / WEEK_MS,
  ));
  const submitted = new Set(submissions
    .filter((s) => s.siteId === site.id && s.submitted && s.accurate &&
      s.weekStart >= firstEligibleWeek && s.weekStart < currentWeekStart)
    .map((s) => s.weekStart)).size;
  return { submitted, totalPossible, pct: totalPossible > 0 ? Math.round(submitted / totalPossible * 100) : 0 };
}
