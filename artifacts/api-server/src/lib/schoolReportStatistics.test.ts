import { describe, expect, it } from "vitest";
import type { SchoolReportRow, SchoolReportTerm } from "@workspace/db";
import {
  calculateLiveSchoolReportStatistics,
  calculateSchoolReportStatistics,
  reportPeriodLabel,
  selectedTermNumbers,
} from "./schoolReportStatistics";

function row(
  id: number,
  serviceType: string,
  weekNumber: number,
  values: number[],
  pupilFreeDays: Partial<Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday", boolean>> = {},
): SchoolReportRow {
  return {
    id,
    organisationId: 1,
    termId: 1,
    weekNumber,
    weekBeginning: "2026-01-26",
    serviceType,
    monday: String(values[0]),
    tuesday: String(values[1]),
    wednesday: String(values[2]),
    thursday: String(values[3]),
    friday: String(values[4]),
    mondayPupilFree: pupilFreeDays.monday ?? false,
    tuesdayPupilFree: pupilFreeDays.tuesday ?? false,
    wednesdayPupilFree: pupilFreeDays.wednesday ?? false,
    thursdayPupilFree: pupilFreeDays.thursday ?? false,
    fridayPupilFree: pupilFreeDays.friday ?? false,
    createdAt: new Date(),
  };
}

function term(rows: SchoolReportRow[]): SchoolReportTerm & { rows: SchoolReportRow[] } {
  return {
    organisationId: 1,
    id: 1,
    siteId: 1,
    reportYear: 2026,
    termNumber: 1,
    termStartDate: "2026-01-26",
    termEndDate: "2026-04-03",
    holidayProgramApplies: true,
    holidayStartDate: null,
    holidayEndDate: null,
    weekCount: 1,
    generatedAt: new Date(),
    generatedById: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    rows,
  };
}

describe("school report statistics", () => {
  it("maps report periods to their terms", () => {
    expect(selectedTermNumbers("term", "3")).toEqual([3]);
    expect(selectedTermNumbers("half-year", "first-half")).toEqual([1, 2]);
    expect(selectedTermNumbers("half-year", "second-half")).toEqual([3, 4]);
    expect(selectedTermNumbers("annual", "annual")).toEqual([1, 2, 3, 4]);
    expect(reportPeriodLabel("annual", "annual", 2026)).toBe("Annual 2026");
  });

  it("uses workbook averaging rules for standard and holiday attendance", () => {
    const statistics = calculateSchoolReportStatistics([
      term([
        row(1, "BSC", 1, [0, 5, 10, 15, 20]),
        row(2, "ASC", 1, [10, 10, 10, 10, 10]),
        row(3, "VAC", 1, [0, 8, 10, 0, 12]),
      ]),
    ], "Term 1 2026");

    expect(statistics.weekdayAverages[0]).toEqual({ day: "Monday", bsc: 0, asc: 10, pupilFree: 0 });
    expect(statistics.weeklyAverages[0]).toEqual({ label: "Week 1", bsc: 10, asc: 10, pupilFree: 0 });
    expect(statistics.holidayWeekdayAverages[0]).toEqual({ day: "Monday", value: 0 });
    expect(statistics.holidayWeeklyAverages[0]).toEqual({ label: "Week 1", value: 10 });
    expect(statistics.holidayProgramApplies).toBe(true);
  });

  it("moves ASC attendance into Pupil Free when only BSC is marked pupil-free", () => {
    const statistics = calculateSchoolReportStatistics([
      term([
        row(1, "BSC", 1, [0, 5, 10, 15, 20], { monday: true }),
        row(2, "ASC", 1, [11, 10, 10, 10, 10]),
      ]),
    ], "Term 1 2026");

    expect(statistics.weekdayAverages[0]).toEqual({ day: "Monday", bsc: 0, asc: 0, pupilFree: 11 });
    expect(statistics.weeklyAverages[0]).toEqual({ label: "Week 1", bsc: 10, asc: 8, pupilFree: 2.2 });
  });

  it("omits holiday attendance when the holiday program does not apply", () => {
    const statistics = calculateSchoolReportStatistics([
      {
        ...term([
          row(1, "BSC", 1, [1, 1, 1, 1, 1]),
          row(2, "ASC", 1, [2, 2, 2, 2, 2]),
          row(3, "VAC", 1, [9, 9, 9, 9, 9]),
        ]),
        holidayProgramApplies: false,
      },
    ], "Term 1 2026");

    expect(statistics.holidayProgramApplies).toBe(false);
    expect(statistics.holidayWeekdayAverages.every((item) => item.value === 0)).toBe(true);
    expect(statistics.holidayWeeklyAverages).toEqual([]);
  });

  it("calculates six-month live weekday, weekly, and overall service averages", () => {
    const weekOneBsc = row(1, "BSC", 1, [5, 10, 15, 20, 0]);
    const weekOneAsc = row(2, "ASC", 1, [10, 10, 10, 10, 10]);
    const weekOneVac = row(3, "VAC", 1, [0, 20, 10, 0, 30]);
    const weekTwoBsc = { ...row(4, "BSC", 2, [15, 10, 5, 0, 20]), weekBeginning: "2026-02-02" };
    const weekTwoAsc = { ...row(5, "ASC", 2, [20, 20, 20, 20, 20]), weekBeginning: "2026-02-02" };

    const statistics = calculateLiveSchoolReportStatistics(
      [weekOneBsc, weekOneAsc, weekOneVac, weekTwoBsc, weekTwoAsc],
      "2025-08-05",
      "2026-02-05",
    );

    expect(statistics.weekdayAverages[0]).toEqual({ day: "Monday", bsc: 10, asc: 15, vac: 0 });
    expect(statistics.weeklyAverages).toEqual([
      { weekBeginning: "2026-01-26", bsc: 10, asc: 10, vac: 20 },
      { weekBeginning: "2026-02-02", bsc: 10, asc: 20, vac: 0 },
    ]);
    expect(statistics.overallAverages).toEqual({ bsc: 10, asc: 15, vac: 20 });
    expect(statistics.hasVacationCare).toBe(true);
  });

  it("excludes all-zero weeks independently from each service average", () => {
    const statistics = calculateSchoolReportStatistics([
      term([
        row(1, "BSC", 1, [10, 10, 10, 10, 10]),
        row(2, "ASC", 1, [20, 20, 20, 20, 20]),
        row(3, "BSC", 2, [0, 0, 0, 0, 0]),
        row(4, "ASC", 2, [30, 30, 30, 30, 30]),
        row(5, "BSC", 3, [0, 0, 0, 0, 0]),
        row(6, "ASC", 3, [0, 0, 0, 0, 0]),
        row(7, "VAC", 3, [0, 0, 0, 0, 0]),
      ]),
    ], "Term 1 2026");

    expect(statistics.weekdayAverages[0]).toEqual({ day: "Monday", bsc: 10, asc: 25, pupilFree: 0 });
    expect(statistics.weeklyAverages).toEqual([
      { label: "Week 1", bsc: 10, asc: 20, pupilFree: 0 },
      { label: "Week 2", bsc: 0, asc: 30, pupilFree: 0 },
    ]);
    expect(statistics.holidayWeeklyAverages).toEqual([]);
  });

  it("excludes represented all-zero weeks from live service averages", () => {
    const activeBsc = row(1, "BSC", 1, [10, 10, 10, 10, 10]);
    const activeAsc = row(2, "ASC", 1, [20, 20, 20, 20, 20]);
    const zeroBsc = { ...row(3, "BSC", 2, [0, 0, 0, 0, 0]), weekBeginning: "2026-02-02" };
    const activeSecondAsc = { ...row(4, "ASC", 2, [30, 30, 30, 30, 30]), weekBeginning: "2026-02-02" };
    const zeroThirdBsc = { ...row(5, "BSC", 3, [0, 0, 0, 0, 0]), weekBeginning: "2026-02-09" };
    const zeroThirdAsc = { ...row(6, "ASC", 3, [0, 0, 0, 0, 0]), weekBeginning: "2026-02-09" };

    const statistics = calculateLiveSchoolReportStatistics(
      [activeBsc, activeAsc, zeroBsc, activeSecondAsc, zeroThirdBsc, zeroThirdAsc],
      "2025-08-05",
      "2026-02-10",
    );

    expect(statistics.weekdayAverages[0]).toEqual({ day: "Monday", bsc: 10, asc: 25, vac: 0 });
    expect(statistics.overallAverages).toEqual({ bsc: 10, asc: 25, vac: null });
    expect(statistics.weeklyAverages).toEqual([
      { weekBeginning: "2026-01-26", bsc: 10, asc: 20, vac: 0 },
      { weekBeginning: "2026-02-02", bsc: 0, asc: 30, vac: 0 },
    ]);
  });
});