import type {
  SchoolReportRow,
  SchoolReportStatistics,
  SchoolReportTerm,
} from "@workspace/db";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;

type ReportTermWithRows = SchoolReportTerm & { rows: SchoolReportRow[] };
type AttendanceDay = (typeof DAYS)[number];
type PupilFreeField = `${AttendanceDay}PupilFree`;

export type SchoolLiveReportStatistics = {
  rangeStart: string;
  rangeEnd: string;
  weekdayAverages: Array<{ day: string; bsc: number; asc: number; vac: number }>;
  weeklyAverages: Array<{ weekBeginning: string; bsc: number; asc: number; vac: number }>;
  overallAverages: { bsc: number; asc: number; vac: number | null };
  hasVacationCare: boolean;
};

function pupilFreeField(day: AttendanceDay): PupilFreeField {
  return `${day}PupilFree` as PupilFreeField;
}

function attendanceValue(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function metricsForDay(
  bsc: SchoolReportRow | undefined,
  asc: SchoolReportRow | undefined,
  day: AttendanceDay,
) {
  const bscIsPupilFree = bsc?.[pupilFreeField(day)] === true;
  const ascIsPupilFree = asc?.[pupilFreeField(day)] === true;
  const ascAttendance = attendanceValue(asc?.[day] ?? null);
  return {
    bsc: bscIsPupilFree ? 0 : attendanceValue(bsc?.[day] ?? null),
    asc: ascIsPupilFree || bscIsPupilFree ? 0 : ascAttendance,
    pupilFree: bscIsPupilFree && !ascIsPupilFree ? ascAttendance : 0,
  };
}

type AttendanceMetric = keyof ReturnType<typeof metricsForDay>;

function weekHasAttendance(
  bsc: SchoolReportRow | undefined,
  asc: SchoolReportRow | undefined,
  metric: AttendanceMetric,
): boolean {
  return DAYS.some((day) => metricsForDay(bsc, asc, day)[metric] > 0);
}

function vacationWeekHasAttendance(row: SchoolReportRow | undefined): boolean {
  return DAYS.some((day) => attendanceValue(row?.[day] ?? null) > 0);
}

export function calculateLiveSchoolReportStatistics(
  rows: SchoolReportRow[],
  rangeStart: string,
  rangeEnd: string,
): SchoolLiveReportStatistics {
  const groupedWeeks = new Map<string, {
    bsc?: SchoolReportRow;
    asc?: SchoolReportRow;
    vac?: SchoolReportRow;
  }>();
  for (const row of rows) {
    const week = groupedWeeks.get(row.weekBeginning) ?? {};
    if (row.serviceType === "BSC") week.bsc = row;
    if (row.serviceType === "ASC") week.asc = row;
    if (row.serviceType === "VAC") week.vac = row;
    groupedWeeks.set(row.weekBeginning, week);
  }
  const weeks = [...groupedWeeks.entries()].sort(([left], [right]) => left.localeCompare(right));
  const standardWeeks = weeks.filter(([, week]) => week.bsc || week.asc);
  const vacRows = rows.filter((row) => row.serviceType === "VAC");

  const weekdayAverages = DAYS.map((day, index) => {
    const bscMetrics = standardWeeks
      .filter(([, week]) => weekHasAttendance(week.bsc, week.asc, "bsc"))
      .map(([, week]) => metricsForDay(week.bsc, week.asc, day).bsc);
    const ascMetrics = standardWeeks
      .filter(([, week]) => weekHasAttendance(week.bsc, week.asc, "asc"))
      .map(([, week]) => metricsForDay(week.bsc, week.asc, day).asc);
    const vacValues = vacRows.map((row) => attendanceValue(row[day])).filter((value) => value > 0);
    return {
      day: DAY_LABELS[index],
      bsc: round(bscMetrics.reduce((sum, value) => sum + value, 0) / Math.max(bscMetrics.length, 1)),
      asc: round(ascMetrics.reduce((sum, value) => sum + value, 0) / Math.max(ascMetrics.length, 1)),
      vac: round(vacValues.reduce((sum, value) => sum + value, 0) / Math.max(vacValues.length, 1)),
    };
  });

  const weeklyAverages = weeks.filter(([, week]) =>
    weekHasAttendance(week.bsc, week.asc, "bsc")
      || weekHasAttendance(week.bsc, week.asc, "asc")
      || weekHasAttendance(week.bsc, week.asc, "pupilFree")
      || vacationWeekHasAttendance(week.vac)
  ).map(([weekBeginning, week]) => {
    const standardMetrics = DAYS.map((day) => metricsForDay(week.bsc, week.asc, day));
    const vacValues = DAYS.map((day) => attendanceValue(week.vac?.[day] ?? null)).filter((value) => value > 0);
    return {
      weekBeginning,
      bsc: round(standardMetrics.reduce((sum, value) => sum + value.bsc, 0) / 5),
      asc: round(standardMetrics.reduce((sum, value) => sum + value.asc, 0) / 5),
      vac: round(vacValues.reduce((sum, value) => sum + value, 0) / Math.max(vacValues.length, 1)),
    };
  });

  const bscWeeks = standardWeeks.filter(([, week]) => weekHasAttendance(week.bsc, week.asc, "bsc"));
  const ascWeeks = standardWeeks.filter(([, week]) => weekHasAttendance(week.bsc, week.asc, "asc"));
  const bscMetrics = bscWeeks.flatMap(([, week]) =>
    DAYS.map((day) => metricsForDay(week.bsc, week.asc, day).bsc)
  );
  const ascMetrics = ascWeeks.flatMap(([, week]) =>
    DAYS.map((day) => metricsForDay(week.bsc, week.asc, day).asc)
  );
  const vacValues = vacRows.flatMap((row) =>
    DAYS.map((day) => attendanceValue(row[day])).filter((value) => value > 0)
  );
  return {
    rangeStart,
    rangeEnd,
    weekdayAverages,
    weeklyAverages,
    overallAverages: {
      bsc: round(bscMetrics.reduce((sum, value) => sum + value, 0) / Math.max(bscMetrics.length, 1)),
      asc: round(ascMetrics.reduce((sum, value) => sum + value, 0) / Math.max(ascMetrics.length, 1)),
      vac: vacValues.length
        ? round(vacValues.reduce((sum, value) => sum + value, 0) / vacValues.length)
        : null,
    },
    hasVacationCare: vacValues.length > 0,
  };
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
  const holidayProgramApplies = sortedTerms.some((term) => term.holidayProgramApplies);
  const holidayRows = sortedTerms.filter((term) => term.holidayProgramApplies).flatMap((term) =>
    term.rows
      .filter((row) => row.serviceType === "VAC")
      .map((row) => ({ ...row, termNumber: term.termNumber })),
  );

  const weekPairs = sortedTerms.flatMap((term) => {
    const weekNumbers = Array.from(new Set(
      term.rows
        .filter((row) => row.serviceType === "BSC" || row.serviceType === "ASC")
        .map((row) => row.weekNumber),
    )).sort((a, b) => a - b);
    return weekNumbers.map((weekNumber) => ({
      termNumber: term.termNumber,
      weekNumber,
      bsc: term.rows.find((row) => row.serviceType === "BSC" && row.weekNumber === weekNumber),
      asc: term.rows.find((row) => row.serviceType === "ASC" && row.weekNumber === weekNumber),
    }));
  }).filter((pair) =>
    weekHasAttendance(pair.bsc, pair.asc, "bsc")
      || weekHasAttendance(pair.bsc, pair.asc, "asc")
      || weekHasAttendance(pair.bsc, pair.asc, "pupilFree")
  );

  const weekdayAverages = DAYS.map((day, index) => {
    const bscMetrics = weekPairs
      .filter((pair) => weekHasAttendance(pair.bsc, pair.asc, "bsc"))
      .map((pair) => metricsForDay(pair.bsc, pair.asc, day).bsc);
    const ascMetrics = weekPairs
      .filter((pair) => weekHasAttendance(pair.bsc, pair.asc, "asc"))
      .map((pair) => metricsForDay(pair.bsc, pair.asc, day).asc);
    const pupilFreeMetrics = weekPairs
      .filter((pair) => weekHasAttendance(pair.bsc, pair.asc, "pupilFree"))
      .map((pair) => metricsForDay(pair.bsc, pair.asc, day).pupilFree);
    return {
      day: DAY_LABELS[index],
      bsc: round(bscMetrics.reduce((sum, value) => sum + value, 0) / Math.max(bscMetrics.length, 1)),
      asc: round(ascMetrics.reduce((sum, value) => sum + value, 0) / Math.max(ascMetrics.length, 1)),
      pupilFree: round(pupilFreeMetrics.reduce((sum, value) => sum + value, 0) / Math.max(pupilFreeMetrics.length, 1)),
    };
  });

  const weeklyAverages = weekPairs.map((pair) => {
      const dayMetrics = DAYS.map((day) => metricsForDay(pair.bsc, pair.asc, day));
      return {
        label: sortedTerms.length === 1 ? `Week ${pair.weekNumber}` : `T${pair.termNumber} W${pair.weekNumber}`,
        bsc: round(dayMetrics.reduce((sum, metrics) => sum + metrics.bsc, 0) / 5),
        asc: round(dayMetrics.reduce((sum, metrics) => sum + metrics.asc, 0) / 5),
        pupilFree: round(dayMetrics.reduce((sum, metrics) => sum + metrics.pupilFree, 0) / 5),
      };
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

  const holidayWeeklyAverages = holidayRows.filter(vacationWeekHasAttendance).map((row) => {
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
    holidayProgramApplies,
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