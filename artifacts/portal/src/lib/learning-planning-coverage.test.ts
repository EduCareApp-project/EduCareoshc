import { describe, expect, it } from "vitest";
import { filterPlanningCoverage } from "./learning-planning-coverage";

const options = { selectedSite: "1", cutoff: new Date("2026-10-01T00:00:00"), today: "2026-10-08", includeFuturePlans: false };
const plan = (id: number, startDate: string | null, overrides = {}) => ({
  id, startDate, siteId: 1, stage: "planned", isTemplate: false, createdAt: "2026-10-05T00:00:00Z", ...overrides,
});
const records = [
  plan(1, "2026-09-30"), plan(2, "2026-10-01"), plan(3, "2026-10-08"),
  plan(4, "2026-10-09"), plan(5, "2030-01-01"), plan(6, "2026-10-10", { stage: "closed" }),
  plan(7, "2026-10-09", { isTemplate: true }), plan(8, "2026-10-09", { siteId: 2 }),
  plan(9, "2026-10-05", { stage: "closed" }), plan(10, "2026-10-05", { isTemplate: true }),
  plan(11, "2026-10-05", { siteId: 2 }),
];

describe("Learning compliance planning date selection", () => {
  it("defaults to the selected past period through today, including closed historical plans", () => {
    expect(filterPlanningCoverage(records, options).map((p) => p.id)).toEqual([2, 3, 9]);
  });
  it("adds all future open plans for that site with no lookahead limit", () => {
    expect(filterPlanningCoverage(records, { ...options, includeFuturePlans: true }).map((p) => p.id))
      .toEqual([2, 3, 4, 5, 9]);
  });
  it("respects site changes for both past and future plans", () => {
    expect(filterPlanningCoverage(records, { ...options, selectedSite: "2", includeFuturePlans: true }).map((p) => p.id))
      .toEqual([8, 11]);
    expect(filterPlanningCoverage(records, { ...options, selectedSite: "all", includeFuturePlans: true }).map((p) => p.id))
      .toEqual([2, 3, 4, 5, 8, 9, 11]);
  });
  it("updates the past window without losing future open plans", () => {
    expect(filterPlanningCoverage(records, { ...options, cutoff: new Date("2026-10-07T00:00:00"), includeFuturePlans: true }).map((p) => p.id))
      .toEqual([3, 4, 5]);
  });
  it.each(["brainstorm", "planned", "published", "assessment"])("includes future plans at the open %s stage", (stage) => {
    expect(filterPlanningCoverage([plan(1, "2026-11-01", { stage })], { ...options, includeFuturePlans: true })).toHaveLength(1);
  });
  it("uses the Melbourne creation day for plans without a scheduled date", () => {
    expect(filterPlanningCoverage([plan(1, null, { createdAt: "2026-09-30T15:00:00Z" })], options)).toHaveLength(1);
  });
  it("preserves scheduled calendar dates returned as midnight UTC timestamps", () => {
    expect(filterPlanningCoverage([plan(1, "2026-10-01T00:00:00.000Z")], options)).toHaveLength(1);
  });
  it("handles missing data and invalid dates without failing the report", () => {
    expect(filterPlanningCoverage(undefined, options)).toEqual([]);
    expect(filterPlanningCoverage([plan(1, "invalid"), plan(2, "2026-02-30"), plan(3, null, { createdAt: "invalid" })], options)).toEqual([]);
  });
});
