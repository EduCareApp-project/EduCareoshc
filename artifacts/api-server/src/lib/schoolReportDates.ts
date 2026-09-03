const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function calculateReportWeekBeginnings(startDate: string, endDate: string): string[] {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end || end < start) return [];

  const day = start.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const firstMonday = new Date(start.getTime() - daysSinceMonday * DAY_MS);
  const weeks: string[] = [];

  for (let current = firstMonday; current <= end; current = new Date(current.getTime() + 7 * DAY_MS)) {
    weeks.push(formatDateOnly(current));
  }

  return weeks;
}

export function isValidDateRange(startDate: string, endDate: string): boolean {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  return Boolean(start && end && end >= start);
}