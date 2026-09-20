import { describe, expect, it } from "vitest";
import {
  scanDuplicateChildren,
  scanDuplicateGuardians,
  type DuplicateChildRow,
} from "./duplicateRecords";

const child = (overrides: Partial<DuplicateChildRow> = {}): DuplicateChildRow => ({
  id: 1, firstName: "Chopper", lastName: "Bennett", dateOfBirth: "2020-01-02",
  guardianName: "Alex Bennett", guardianEmail: "alex@example.com", guardianPhone: "0400000000",
  status: "active", siteId: 1, siteName: "Main", ...overrides,
});

describe("duplicate record scanning", () => {
  it("uses token-aware names so a middle name variation remains a candidate", () => {
    const matches = scanDuplicateChildren([
      child({ id: 1, firstName: "Chopper" }),
      child({ id: 2, firstName: "Chopper James" }),
    ], 0.8);
    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBeGreaterThanOrEqual(0.8);
  });

  it("includes candidates exactly at the threshold", () => {
    const rows = [child({ id: 1 }), child({ id: 2 })];
    const score = scanDuplicateChildren(rows, 0).at(0)?.score ?? 0;
    expect(scanDuplicateChildren(rows, score)).toHaveLength(1);
  });

  it("returns deterministic pair ordering regardless of input order", () => {
    const forward = scanDuplicateChildren([child({ id: 2 }), child({ id: 1 })], 0.8);
    const reverse = scanDuplicateChildren([child({ id: 1 }), child({ id: 2 })], 0.8);
    expect(forward.map((match) => [match.first.id, match.second.id]))
      .toEqual(reverse.map((match) => [match.first.id, match.second.id]));
  });

  it("does not flag siblings sharing one exact guardian email", () => {
    const rows = [
      child({ id: 1, guardianEmail: "parent@example.com" }),
      child({ id: 2, guardianEmail: "parent@example.com" }),
    ];
    expect(scanDuplicateGuardians(rows, 0.8)).toEqual([]);
  });
});