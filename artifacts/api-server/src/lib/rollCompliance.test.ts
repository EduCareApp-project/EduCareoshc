import { describe, expect, it } from "vitest";
import { buildRollPeriodCell, getWeekStartUTC, isEligibleRollWeek } from "./rollCompliance";

const currentWeek = "2026-10-05";
const submission = (weekStart: string, accurate = true) => ({ siteId: 1, weekStart, submitted: true, accurate });

describe("Roll compliance service start dates", () => {
  it.each([4, 12, 52])("preserves the legacy %s-week denominator when no date is supplied", (weeks) => {
    expect(buildRollPeriodCell({ id: 1 }, [], currentWeek, weeks)).toEqual({ submitted: 0, totalPossible: weeks, pct: 0 });
  });

  it.each([4, 12, 52])("counts only eligible completed weeks in the %s-week period", (weeks) => {
    const result = buildRollPeriodCell({ id: 1, serviceStartDate: "2026-09-23" }, [
      submission("2026-09-14"), submission("2026-09-21"), submission("2026-09-28"),
      submission(currentWeek),
    ], currentWeek, weeks);
    expect(result).toEqual({ submitted: 2, totalPossible: 2, pct: 100 });
  });

  it.each(["2026-10-05", "2026-10-07", "2026-11-01"])("has no eligible completed weeks when opening on %s", (serviceStartDate) => {
    expect(buildRollPeriodCell({ id: 1, serviceStartDate }, [], currentWeek, 52))
      .toEqual({ submitted: 0, totalPossible: 0, pct: 0 });
  });

  it("caps the denominator at the selected lookback window", () => {
    expect(buildRollPeriodCell({ id: 1, serviceStartDate: "2025-01-01" }, [], currentWeek, 4).totalPossible).toBe(4);
  });

  it("does not count inaccurate, other-site or duplicate submissions", () => {
    const result = buildRollPeriodCell({ id: 1, serviceStartDate: "2026-09-23" }, [
      submission("2026-09-21"), submission("2026-09-21"),
      submission("2026-09-28", false), { ...submission("2026-09-28"), siteId: 2 },
    ], currentWeek, 12);
    expect(result).toEqual({ submitted: 1, totalPossible: 2, pct: 50 });
  });

  it("includes the opening week, including Sunday openings, but not earlier weeks", () => {
    expect(getWeekStartUTC(new Date("2026-09-27T00:00:00Z"))).toBe("2026-09-21");
    expect(isEligibleRollWeek("2026-09-27", "2026-09-14")).toBe(false);
    expect(isEligibleRollWeek("2026-09-27", "2026-09-21")).toBe(true);
    expect(isEligibleRollWeek(null, "2020-01-06")).toBe(true);
  });
});
