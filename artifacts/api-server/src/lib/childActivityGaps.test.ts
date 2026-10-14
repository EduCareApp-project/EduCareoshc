import { describe, expect, it } from "vitest";
import { activityCutoffs, findChildActivityGaps } from "./childActivityGaps";

const now = new Date("2026-10-14T12:00:00Z");
const child = (id: number, enrollmentDate = "2026-01-01", status = "active") => ({
  id, firstName: `Child${id}`, lastName: "Example", enrollmentDate, status,
});
const entry = (childId: number, createdAt: string) => ({ childId, createdAt: new Date(createdAt) });

describe("child activity gaps", () => {
  it("only reports active children without activity recorded in the last 30 days", () => {
    const result = findChildActivityGaps(
      [child(1), child(2), child(3), child(4), child(5), child(6), child(7, "2026-01-01", "inactive"), child(8, "2026-01-01", "archived")],
      [entry(1, "2026-10-13T12:00:00Z"), entry(2, "2026-09-14T12:00:00Z"),
        entry(3, "2026-09-14T11:59:59Z"), entry(4, "2026-08-01T12:00:00Z"),
        entry(5, "2026-06-01T12:00:00Z"), entry(7, "2026-01-01T12:00:00Z")],
      now,
    );
    expect(result).toEqual([
      { childId: 3, childName: "Child3 Example", noActivityForThreeMonths: false },
      { childId: 4, childName: "Child4 Example", noActivityForThreeMonths: false },
      { childId: 5, childName: "Child5 Example", noActivityForThreeMonths: true },
      { childId: 6, childName: "Child6 Example", noActivityForThreeMonths: true },
    ]);
  });

  it("uses enrolment date for a child without a record and ignores future-dated records", () => {
    const result = findChildActivityGaps(
      [child(1, "2026-10-01"), child(2, "2026-07-14"), child(3, "2026-07-15")],
      [entry(1, "2026-11-01T00:00:00Z")], now,
    );
    expect(result.map((c) => [c.childId, c.noActivityForThreeMonths]))
      .toEqual([[1, false], [2, true], [3, false]]);
  });

  it("clamps a three-calendar-month cutoff at the end of a shorter month", () => {
    expect(activityCutoffs(new Date("2026-05-31T12:00:00Z")).threeMonthsAgo.toISOString())
      .toBe("2026-02-28T12:00:00.000Z");
    expect(activityCutoffs(now).threeMonthsAgo.toISOString())
      .toBe("2026-07-14T12:00:00.000Z");
  });
});
