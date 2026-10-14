import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, selected: [] as string[] }));
vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (column: unknown, value: unknown) => ({ column, value }),
  gte: (column: unknown, value: unknown) => ({ column, value }),
  inArray: (column: unknown, value: unknown) => ({ column, value }),
  isNull: (column: unknown) => ({ column, value: null }),
}));
vi.mock("@workspace/db", () => {
  const table = (name: string, fields: string[]) =>
    Object.fromEntries([["name", name], ...fields.map((field) => [field, `${name}.${field}`])]);
  return {
    db: { select: () => ({ from: (t: { name: string }) => ({
      where: () => { m.selected.push(t.name); return Promise.resolve(m.rows[t.name] ?? []); },
    }) }) },
    childrenTable: table("children", ["id", "status", "siteId", "firstName", "lastName", "enrollmentDate"]),
    observationsTable: table("observations", ["childId", "createdAt"]),
    jottingsTable: table("jottings", ["childId", "createdAt", "archivedAt"]),
    postsTable: table("posts", ["childIds", "createdAt"]),
    planningExperiencesTable: table("plans", ["childIds", "createdAt", "isTemplate"]),
  };
});
import router from "./dashboard-child-activity";

const staff = { id: 1, type: "staff", role: "educator", siteId: 7 };
const child = (id: number, siteId = 7, status = "active", enrollmentDate = "2026-01-01") =>
  ({ id, firstName: `Child${id}`, lastName: "Example", status, siteId, enrollmentDate });
const recent = new Date();
recent.setDate(recent.getDate() - 3);
function app(user: typeof staff | null = staff) {
  const server = express();
  server.use((req, _res, next) => {
    (req as any).session = { user };
    (req as any).log = { error: vi.fn() };
    next();
  });
  server.use("/api", router);
  return server;
}
beforeEach(() => {
  m.rows = {};
  m.selected = [];
});

describe("GET dashboard child activity gaps", () => {
  it("credits observations, jottings, posts and linked planning cycles; only active children are listed", async () => {
    m.rows.children = [child(1), child(2), child(3), child(4), child(5), child(6, 7, "inactive"), child(7, 7, "archived"), child(8, 7, "active", "2026-10-01")];
    m.rows.observations = [{ childId: 1, createdAt: recent }];
    m.rows.jottings = [{ childId: 2, createdAt: recent }];
    m.rows.posts = [{ childIds: [3, 6], createdAt: recent }];
    m.rows.plans = [{ childIds: [4, 7], createdAt: recent }];
    const result = await request(app()).get("/api/dashboard/child-activity-gaps?siteId=7");
    expect(result.status).toBe(200);
    expect(result.body).toEqual([
      { childId: 5, childName: "Child5 Example", noActivityForThreeMonths: true },
      { childId: 8, childName: "Child8 Example", noActivityForThreeMonths: false },
    ]);
    expect(m.selected).toEqual(["children", "observations", "jottings", "posts", "plans"]);
  });

  it("limits a site-scoped staff member to children at their assigned service", async () => {
    m.rows.children = [child(1), child(2, 8)];
    const result = await request(app()).get("/api/dashboard/child-activity-gaps");
    expect(result.status).toBe(200);
    expect(result.body.map((c: { childId: number }) => c.childId)).toEqual([1]);
    expect((await request(app()).get("/api/dashboard/child-activity-gaps?siteId=8")).status).toBe(403);
    expect((await request(app({ ...staff, siteId: null as unknown as number })).get("/api/dashboard/child-activity-gaps")).status).toBe(403);
  });

  it("allows leadership to filter a service, and denies other account types", async () => {
    m.rows.children = [child(1), child(2, 8), child(3, 8, "archived")];
    const leader = { ...staff, role: "educational_leader" };
    const result = await request(app(leader)).get("/api/dashboard/child-activity-gaps?siteId=8");
    expect(result.status).toBe(200);
    expect(result.body.map((c: { childId: number }) => c.childId)).toEqual([2]);
    for (const user of [null, { ...staff, type: "school" }, { ...staff, role: "onboarding" }]) {
      expect((await request(app(user)).get("/api/dashboard/child-activity-gaps")).status).toBe(403);
    }
    expect((await request(app()).get("/api/dashboard/child-activity-gaps?siteId=banana")).status).toBe(400);
  });
});
