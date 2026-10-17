import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  rows: [] as { organisationId: number | null; siteId?: number }[],
  select: vi.fn(), conditions: [] as unknown[], failure: false,
}));
vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));
vi.mock("@workspace/db", () => {
  const chain: any = {};
  chain.from = chain.innerJoin = () => chain;
  chain.where = (value: unknown) => { mock.conditions.push(value); return chain; };
  chain.limit = async () => {
    if (mock.failure) throw new Error("Database unavailable");
    return mock.rows;
  };
  mock.select.mockReturnValue(chain);
  return {
    db: { select: mock.select },
    staffTable: { id: "staff.id", organisationId: "staff.org" },
    parentAccountsTable: { id: "guardian.id", organisationId: "guardian.org" },
    schoolAccountsTable: { id: "school.id", siteId: "school.site" },
    sitesTable: { id: "site.id", orgId: "site.org" },
  };
});
import { organisationContext } from "./organisation-context";

function app(type: string | null = "staff") {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).session = { user: type ? { id: 42, type, organisationId: 999, siteId: 999 } : undefined };
    (req as any).log = { error: vi.fn() };
    next();
  });
  // Deliberately mount twice to exercise central guard + standalone routers.
  a.use(organisationContext, organisationContext);
  a.post("/", (_req, res) => res.json({ organisationId: res.locals.organisationId }));
  return a;
}
beforeEach(() => {
  mock.rows = [{ organisationId: 2 }];
  mock.conditions.length = 0;
  mock.failure = false;
  mock.select.mockClear();
});
describe("verified organisation context", () => {
  it.each([
    ["staff", "staff.id"], ["guardian", "guardian.id"], ["school", "school.id"],
  ])("resolves %s ownership by authenticated account ID", async (type, column) => {
    if (type === "school") mock.rows = [{ organisationId: 2, siteId: 999 }];
    const res = await request(app(type)).post("/?organisationId=999").send({ organisationId: 999 });
    expect(res.status).toBe(200);
    expect(res.body.organisationId).toBe(2);
    expect(mock.conditions).toEqual([{ column, value: 42 }]);
    expect(mock.select).toHaveBeenCalledTimes(1);
  });
  it("rechecks membership on each request, including after reassignment", async () => {
    const a = app();
    expect((await request(a).post("/")).body.organisationId).toBe(2);
    mock.rows = [{ organisationId: 3 }];
    expect((await request(a).post("/")).body.organisationId).toBe(3);
    expect(mock.select).toHaveBeenCalledTimes(2);
  });
  it.each([
    { rows: [] }, { rows: [{ organisationId: null }] },
    { rows: [{ organisationId: 0 }] }, { rows: [{ organisationId: -1 }] },
  ])(
    "fails closed when membership is missing or invalid: %j", async ({ rows }) => {
      mock.rows = rows;
      expect((await request(app()).post("/")).status).toBe(403);
    },
  );
  it("does not resolve the first organisation when anonymous or unsupported", async () => {
    expect((await request(app(null)).post("/")).status).toBe(401);
    expect((await request(app("unknown")).post("/")).status).toBe(403);
    expect(mock.select).not.toHaveBeenCalled();
  });
  it("returns a retryable error rather than guessing ownership when the database fails", async () => {
    mock.failure = true;
    expect((await request(app()).post("/")).status).toBe(503);
  });
  it("rejects a stale school session after its service assignment changes", async () => {
    mock.rows = [{ organisationId: 2, siteId: 123 }];
    expect((await request(app("school")).post("/")).status).toBe(403);
  });
});
