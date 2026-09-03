import type {
  SchoolReportRow,
  SchoolReportStatistics,
  SchoolReportTerm,
} from "@workspace/db";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

type ReportTermWithRows = SchoolReportTerm & { rows: SchoolReportRow[] };

function attendanceValue(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function selectedTermNumbers(frequency: string, period: string): number[] | null {
  if (frequency === "term" && /^[1-4]$/.test(period)) return [Number(period)];
  if (frequency === "half-year" && period === "first-half") return [1, 2];
  if (frequency === "half-year" && period === "second-half") return [3, 4];
  if (frequency === "annual" && period === "annual") return [1, 2, 3, 4];
  return null;
}

export function reportPeriodLabel(frequency: string, period: string, reportYear: number): string | null {
  if (frequency === "term" && /^[1-4]$/.test(period)) return `Term ${period} ${reportYear}`;
  if (frequency === "half-year" && period === "first-half") return `First half ${reportYear}`;
  if (frequency === "half-year" && period === "second-half") return `Second half ${reportYear}`;
  if (frequency === "annual" && period === "annual") return `Annual ${reportYear}`;
  return null;
}

export function calculateSchoolReportStatistics(
  terms: ReportTermWithRows[],
  periodLabel: string,
): SchoolReportStatistics {
  const sortedTerms = [...terms].sort((a, b) => a.termNumber - b.termNumber);
  const standardRows = sortedTerms.flatMap((term) =>
    term.rows
      .filter((row) => row.serviceType === "BSC" || row.serviceType === "ASC")
      .map((row) => ({ ...row, termNumber: term.termNumber })),
  );
  const holidayRows = sortedTerms.flatMap((term) =>
    term.rows
      .filter((row) => row.serviceType === "VAC")
      .map((row) => ({ ...row, termNumber: term.termNumber })),
  );

  const weekdayAverages = DAYS.map((day, index) => {
    const bscRows = standardRows.filter((row) => row.serviceType === "BSC");
    const ascRows = standardRows.filter((row) => row.serviceType === "ASC");
    return {
      day: DAY_LABELS[index],
      bsc: round(bscRows.reduce((sum, row) => sum + attendanceValue(row[day]), 0) / Math.max(bscRows.length, 1)),
      asc: round(ascRows.reduce((sum, row) => sum + attendanceValue(row[day]), 0) / Math.max(ascRows.length, 1)),
    };
  });

  const weeklyAverages = sortedTerms.flatMap((term) => {
    const weekNumbers = Array.from(new Set(
      term.rows
        .filter((row) => row.serviceType === "BSC" || row.serviceType === "ASC")
        .map((row) => row.weekNumber),
    )).sort((a, b) => a - b);
    return weekNumbers.map((weekNumber) => {
      const bsc = term.rows.find((row) => row.serviceType === "BSC" && row.weekNumber === weekNumber);
      const asc = term.rows.find((row) => row.serviceType === "ASC" && row.weekNumber === weekNumber);
      return {
        label: sortedTerms.length === 1 ? `Week ${weekNumber}` : `T${term.termNumber} W${weekNumber}`,
        bsc: round(DAYS.reduce((sum, day) => sum + attendanceValue(bsc?.[day] ?? null), 0) / 5),
        asc: round(DAYS.reduce((sum, day) => sum + attendanceValue(asc?.[day] ?? null), 0) / 5),
      };
    });
  });

  const holidayWeekdayAverages = DAYS.map((day, index) => {
    const operatedValues = holidayRows
      .map((row) => attendanceValue(row[day]))
      .filter((value) => value > 0);
    return {
      day: DAY_LABELS[index],
      value: round(operatedValues.reduce((sum, value) => sum + value, 0) / Math.max(operatedValues.length, 1)),
    };
  });

  const holidayWeeklyAverages = holidayRows.map((row) => {
    const operatedValues = DAYS
      .map((day) => attendanceValue(row[day]))
      .filter((value) => value > 0);
    return {
      label: sortedTerms.length === 1 ? `Week ${row.weekNumber}` : `T${row.termNumber} W${row.weekNumber}`,
      value: round(operatedValues.reduce((sum, value) => sum + value, 0) / Math.max(operatedValues.length, 1)),
    };
  });

  return {
    periodLabel,
    termNumbers: sortedTerms.map((term) => term.termNumber),
    dateRange: {
      start: sortedTerms[0]?.termStartDate ?? "",
      end: sortedTerms.at(-1)?.termEndDate ?? "",
    },
    weekdayAverages,
    weeklyAverages,
    holidayWeekdayAverages,
    holidayWeeklyAverages,
  };
}