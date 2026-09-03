import { describe, expect, it } from "vitest";
import { calculateReportWeekBeginnings, isValidDateRange } from "./schoolReportDates";

describe("school report date calculations", () => {
  it("creates one Monday week beginning for each term week", () => {
    expect(calculateReportWeekBeginnings("2026-01-27", "2026-04-02")).toEqual([
      "2026-01-26",
      "2026-02-02",
      "2026-02-09",
      "2026-02-16",
      "2026-02-23",
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
    ]);
  });

  it("includes the Monday containing a mid-week term start", () => {
    expect(calculateReportWeekBeginnings("2026-07-15", "2026-07-17")).toEqual(["2026-07-13"]);
  });

  it("rejects reversed and malformed date ranges", () => {
    expect(isValidDateRange("2026-04-10", "2026-04-01")).toBe(false);
    expect(isValidDateRange("not-a-date", "2026-04-01")).toBe(false);
  });
});