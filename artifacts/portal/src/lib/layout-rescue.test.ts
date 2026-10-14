import { describe, it, expect } from "vitest";
import { clearRescue, readRescue, writeRescue } from "./layout-rescue";
import { normalizeItems, sameItems, DEFAULT_LAYOUTS, idsFor } from "./dashboard-layout";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

describe("layout rescue", () => {
  it("is scoped to user and dashboard and clears", () => {
    const s = mem();
    const items = normalizeItems("educator", DEFAULT_LAYOUTS.educator);
    writeRescue({ userId: 1, dashboard: "educator", items, base: 3, rev: 2 }, s);
    expect(readRescue(1, "educator", s)?.rev).toBe(2);
    expect(readRescue(2, "educator", s)).toBeNull();
    expect(readRescue(1, "leadership", s)).toBeNull();
    clearRescue(1, "educator", s);
    expect(readRescue(1, "educator", s)).toBeNull();
  });
});
describe("layout items", () => {
  it("adds missing ids and detects changes", () => {
    const n = normalizeItems("leadership", [{ i: "posts", x: 0, y: 0, w: 4, h: 4 }]);
    expect(n.map((i) => i.i).sort()).toEqual([...idsFor("leadership")].sort());
    expect(idsFor("leadership")).toHaveLength(13);
    expect(sameItems(n, n.map((i) => ({ ...i })))).toBe(true);
    expect(sameItems(n, n.map((i, k) => (k ? i : { ...i, w: 5 })))).toBe(false);
  });
});
