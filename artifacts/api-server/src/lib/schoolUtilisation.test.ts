import { describe, expect, it } from "vitest";
import type { SchoolReportRow } from "@workspace/db";
import { calculateSchoolUtilisation, validCalendarDate, shiftCalendarDate } from "./schoolUtilisation";

const sites = [
  { id: 1, name: "Mahogany", identifier: "MAH", status: "active", serviceStartDate: null },
  { id: 2, name: "Another site", identifier: null, status: "inactive", serviceStartDate: null },
  { id: 3, name: "No records", identifier: null, status: "active", serviceStartDate: null },
];
function row(id: number, serviceType: string, overrides: Partial<SchoolReportRow> = {}): SchoolReportRow {
  return {
    organisationId: 1,
    id, termId: 1, weekNumber: 1, weekBeginning: "2026-10-05", serviceType,
    monday: "1", tuesday: "2", wednesday: "3", thursday: "4", friday: "5",
    mondayPupilFree: false, tuesdayPupilFree: false, wednesdayPupilFree: false,
    thursdayPupilFree: false, fridayPupilFree: false, createdAt: new Date("2026-10-05"),
    ...overrides,
  };
}

describe("School attendance utilisation totals", () => {
  it("sums all five daily bookings by session and site, not averages or unique children", () => {
    const result = calculateSchoolUtilisation(sites, [
      { siteId: 1, row: row(1, "BSC") },
      { siteId: 1, row: row(2, "ASC") },
      { siteId: 2, row: row(3, "VAC") },
    ], "2026-10-05", "2026-10-09");
    expect(result.totals).toEqual({ bsc: 15, asc: 15, pupilFree: 0, vac: 15 });
    expect(result.sites[0].totals).toEqual({ bsc: 15, asc: 15, pupilFree: 0, vac: 0 });
    expect(result.sites[1].status).toBe("inactive");
    expect(result.sites[1].totals.vac).toBe(15);
    expect(result.sites[2].recordedSessions).toEqual({ bsc: 0, asc: 0, pupilFree: 0, vac: 0 });
  });
  it("includes only selected days in partial first and last weeks", () => {
    const result = calculateSchoolUtilisation(sites, [
      { siteId: 1, row: row(1, "BSC") },
      { siteId: 1, row: row(2, "BSC", { weekBeginning: "2026-10-12" }) },
    ], "2026-10-08", "2026-10-13");
    expect(result.totals.bsc).toBe(4 + 5 + 1 + 2);
    expect(result.sites[0].recordedSessions.bsc).toBe(4);
  });
  it("excludes pending sites and their bookings even when their start date is in the past", () => {
    const result = calculateSchoolUtilisation([
      sites[0],
      { ...sites[1], status: "pending", serviceStartDate: "2026-01-01" },
      { ...sites[2], status: "pending" },
    ], [
      { siteId: 1, row: row(1, "BSC") },
      { siteId: 2, row: row(2, "ASC") },
      { siteId: 3, row: row(3, "VAC") },
    ], "2026-10-05", "2026-10-11");
    expect(result.sites.map((site) => site.siteId)).toEqual([1]);
    expect(result.totals).toEqual({ bsc: 15, asc: 0, pupilFree: 0, vac: 0 });
  });
  it("counts all session types only from the exact service opening date within a week", () => {
    const result = calculateSchoolUtilisation([
      { ...sites[0], serviceStartDate: "2026-10-07" },
    ], [
      { siteId: 1, row: row(1, "BSC", { mondayPupilFree: true, thursdayPupilFree: true }) },
      { siteId: 1, row: row(2, "ASC", { monday: "20", thursday: "40" }) },
      { siteId: 1, row: row(3, "VAC") },
    ], "2026-10-05", "2026-10-11");
    expect(result.totals).toEqual({ bsc: 8, asc: 8, pupilFree: 40, vac: 12 });
    expect(result.sites[0].recordedSessions).toEqual({ bsc: 2, asc: 2, pupilFree: 1, vac: 3 });
  });
  it("omits sites that had not opened by the end of the selected range", () => {
    const result = calculateSchoolUtilisation([
      { ...sites[0], serviceStartDate: "2026-10-12" },
      sites[1],
    ], [
      { siteId: 1, row: row(1, "BSC") },
      { siteId: 2, row: row(2, "VAC") },
    ], "2026-10-05", "2026-10-11");
    expect(result.sites.map((site) => site.siteId)).toEqual([2]);
    expect(result.totals).toEqual({ bsc: 0, asc: 0, pupilFree: 0, vac: 15 });
  });
  it("includes bookings on the opening date when it equals the selected end date", () => {
    const result = calculateSchoolUtilisation([
      { ...sites[0], serviceStartDate: "2026-10-09" },
    ], [{ siteId: 1, row: row(1, "BSC") }], "2026-10-05", "2026-10-09");
    expect(result.sites).toHaveLength(1);
    expect(result.totals.bsc).toBe(5);
    expect(result.sites[0].recordedSessions.bsc).toBe(1);
  });
  it("preserves historical attendance when no actual service start date is provided", () => {
    const result = calculateSchoolUtilisation(sites, [
      { siteId: 1, row: row(1, "BSC", { weekBeginning: "2020-01-06" }) },
    ], "2020-01-06", "2020-01-12");
    expect(result.totals.bsc).toBe(15);
    expect(result.sites.map((site) => site.siteId)).toEqual([1, 2, 3]);
  });
  it("returns an empty eligible dataset when every site is pending or has not yet opened", () => {
    const result = calculateSchoolUtilisation([
      { ...sites[0], status: "pending" },
      { ...sites[1], serviceStartDate: "2026-10-12" },
    ], [{ siteId: 1, row: row(1, "BSC") }], "2026-10-05", "2026-10-11");
    expect(result.sites).toEqual([]);
    expect(result.totals).toEqual({ bsc: 0, asc: 0, pupilFree: 0, vac: 0 });
  });
  it("keeps pupil-free care separate and ignores closed sessions, without double-counting ASC", () => {
    const result = calculateSchoolUtilisation(sites, [
      { siteId: 1, row: row(1, "BSC", { mondayPupilFree: true, wednesdayPupilFree: true }) },
      { siteId: 1, row: row(2, "ASC", {
        monday: "20", tuesday: "21", wednesday: "22", thursday: "23", friday: "24",
        tuesdayPupilFree: true, wednesdayPupilFree: true,
      }) },
    ], "2026-10-05", "2026-10-09");
    expect(result.totals).toEqual({ bsc: 11, asc: 47, pupilFree: 20, vac: 0 });
    expect(result.sites[0].recordedSessions).toEqual({ bsc: 3, asc: 2, pupilFree: 1, vac: 0 });
  });
  it("distinguishes recorded zero bookings from missing or blank records", () => {
    const result = calculateSchoolUtilisation(sites, [
      { siteId: 1, row: row(1, "BSC", { monday: "0", tuesday: null, wednesday: "", thursday: " ", friday: "0" }) },
    ], "2026-10-05", "2026-10-09");
    expect(result.totals.bsc).toBe(0);
    expect(result.sites[0].recordedSessions.bsc).toBe(2);
    expect(result.sites[1].recordedSessions.bsc).toBe(0);
  });
  it("does not count duplicate session-week rows twice, regardless of input ordering", () => {
    const result = calculateSchoolUtilisation(sites, [
      { siteId: 1, row: row(9, "BSC", { monday: "10" }) },
      { siteId: 1, row: row(1, "BSC") },
      { siteId: 2, row: row(2, "BSC") },
    ], "2026-10-05", "2026-10-05");
    expect(result.totals.bsc).toBe(11);
    expect(result.sites[0].totals.bsc).toBe(10);
  });
  it("returns all sites and zero totals when there is no attendance for the range", () => {
    expect(calculateSchoolUtilisation(sites, [], "2026-10-05", "2026-10-09").sites).toHaveLength(3);
    expect(calculateSchoolUtilisation([], [], "2026-10-05", "2026-10-09").totals)
      .toEqual({ bsc: 0, asc: 0, pupilFree: 0, vac: 0 });
  });
  it("supports single-day ranges and excludes records outside the selected period", () => {
    expect(calculateSchoolUtilisation(sites, [{ siteId: 1, row: row(1, "VAC") }], "2026-10-07", "2026-10-07").totals.vac).toBe(3);
    expect(calculateSchoolUtilisation(sites, [{ siteId: 1, row: row(1, "VAC") }], "2026-11-01", "2026-11-30").totals.vac).toBe(0);
  });
  it("validates calendar dates and shifts across month/year boundaries without timezone drift", () => {
    expect(validCalendarDate("2024-02-29")).toBe(true);
    expect(validCalendarDate("2026-02-29")).toBe(false);
    expect(validCalendarDate("2026-02-30")).toBe(false);
    expect(validCalendarDate("2026-13-01")).toBe(false);
    expect(validCalendarDate("2026-10-05T00:00:00Z")).toBe(false);
    expect(shiftCalendarDate("2026-01-01", -4)).toBe("2025-12-28");
  });
});
