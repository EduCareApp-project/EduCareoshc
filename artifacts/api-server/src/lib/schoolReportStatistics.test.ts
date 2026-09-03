import { describe, expect, it } from "vitest";
import type { SchoolReportRow, SchoolReportTerm } from "@workspace/db";
import {
  calculateSchoolReportStatistics,
  reportPeriodLabel,
  selectedTermNumbers,
} from "./schoolReportStatistics";

function row(id: number, serviceType: string, weekNumber: number, values: number[]): SchoolReportRow {
  return {
    id,
    termId: 1,
    weekNumber,
    weekBeginning: "2026-01-26",
    serviceType,
    monday: String(values[0]),
    tuesday: String(values[1]),
    wednesday: String(values[2]),
    thursday: String(values[3]),
    friday: String(values[4]),
    mondayPupilFree: false,
    tuesdayPupilFree: false,
    wednesdayPupilFree: false,
    thursdayPupilFree: false,
    fridayPupilFree: false,
    createdAt: new Date(),
  };
}

function term(rows: SchoolReportRow[]): SchoolReportTerm & { rows: SchoolReportRow[] } {
  return {
    id: 1,
    siteId: 1,
    reportYear: 2026,
    termNumber: 1,
    termStartDate: "2026-01-26",
    termEndDate: "2026-04-03",
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

    expect(statistics.weekdayAverages[0]).toEqual({ day: "Monday", bsc: 0, asc: 10 });
    expect(statistics.weeklyAverages[0]).toEqual({ label: "Week 1", bsc: 10, asc: 10 });
    expect(statistics.holidayWeekdayAverages[0]).toEqual({ day: "Monday", value: 0 });
    expect(statistics.holidayWeeklyAverages[0]).toEqual({ label: "Week 1", value: 10 });
  });
});