import { describe, expect, it } from "vitest";
import { hasActiveChildLink, onlyActiveChildren } from "./active-children";

describe("active children in learning lists", () => {
  it("keeps only the active profile when active and inactive children share a name", () => {
    const children = [
      { id: 1, firstName: "Chopper", status: "active" },
      { id: 2, firstName: "Chopper", status: "inactive" },
      { id: 3, firstName: "Archived", status: "archived" },
      { id: 4, firstName: "Unknown", status: "pending" },
    ];
    expect(onlyActiveChildren(children).map((c) => c.id)).toEqual([1]);
    expect(children).toHaveLength(4);
  });
  it("keeps unlinked and mixed group records, but excludes inactive-only and unknown-child records", () => {
    const active = new Set([1, 5]);
    expect(hasActiveChildLink([], active)).toBe(true);
    expect(hasActiveChildLink([1, 2], active)).toBe(true);
    expect(hasActiveChildLink([2, 3], active)).toBe(false);
    expect(hasActiveChildLink([999], active)).toBe(false);
  });
});
