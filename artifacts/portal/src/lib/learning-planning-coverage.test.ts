import { describe, expect, it } from "vitest";
import { filterPlanningCoverage, planningOutcomeIds } from "./learning-planning-coverage";

const options = { selectedSite: "1", cutoff: new Date("2026-10-01T00:00:00"), today: "2026-10-08", includeFuturePlans: false };
const plan = (id: number, startDate: string | null, overrides = {}) => ({
  id, startDate, siteId: 1, stage: "planned", isTemplate: false, createdAt: "2026-10-05T00:00:00Z", ...overrides,
});

describe("Planning MTOP links from Learning Cycles", () => {
  it("reads sub-outcome links when the separate outcome list is empty", () => {
    expect(planningOutcomeIds({
      outcomeIds: [],
      frameworkLinks: "1.2 – Resilience\n2.1 – Relationships\n3.2 – Physical skills\n4.1 – Creativity\n4.2 – Problem solving\n5.1 – Communication",
    })).toEqual([1, 2, 3, 4, 5]);
  });
  it("reads written outcome headings, including historical cycles", () => {
    expect(planningOutcomeIds({ frameworkLinks: "MTOP Outcome 1 – Identity\nOutcome 3 – Wellbeing\nMTOP Outcome 5 – Communication" }))
      .toEqual([1, 3, 5]);
  });
  it("avoids double counting repeated links and overlapping structured outcomes", () => {
    expect(planningOutcomeIds({ outcomeIds: [1, 4], frameworkLinks: "1.2, 1.2, 4.1, 4.2, Outcome 4, 5.1" }))
      .toEqual([1, 4, 5]);
  });
  it("retains valid structured outcomes and ignores invalid identifiers", () => {
    expect(planningOutcomeIds({ outcomeIds: [2, "3.1", 0, 6, "4abc", "2", 1.5], frameworkLinks: "12.1 6.1 2026.10.12 version1.2 Outcome 9" }))
      .toEqual([1, 2, 3]);
    expect(planningOutcomeIds({})).toEqual([]);
  });
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
