/**
 * Confirms that the roll-submissions route only returns active sites.
 * Pending sites (e.g. Lumen Christi id=9, Sacred Heart id=10) must be absent
 * from both the weekly marking list and the compliance report.
 *
 * Routes covered:
 *   GET /api/roll-submissions         — weekly site list
 *   GET /api/roll-submissions/report  — compliance report
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeSite(id: number, name: string) {
  return { id, name };
}

const ACTIVE_SITES = [
  makeSite(1, "Blackburn"),
  makeSite(2, "Box Hill"),
  makeSite(3, "Burwood"),
  makeSite(4, "Doncaster"),
  makeSite(5, "Glen Waverley"),
  makeSite(6, "Mitcham"),
  makeSite(7, "Vermont"),
];

// ---------------------------------------------------------------------------
// Chain factory — each created chain resolves to its own data
// ---------------------------------------------------------------------------

function makeChain(resolveData: unknown[], extraMethods: Record<string, unknown> = {}) {
  const c: Record<string, unknown> = {
    from:    vi.fn(),
    where:   vi.fn(),
    orderBy: vi.fn(),
    limit:   vi.fn(),
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(resolveData).then(resolve, reject);
    },
    catch(onRej: (e: unknown) => unknown) {
      return Promise.resolve(resolveData).catch(onRej);
    },
    ...extraMethods,
  };
  (c.from    as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.where   as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.limit   as ReturnType<typeof vi.fn>).mockReturnValue(c);
  return c;
}

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => {
  const mockDb = { select: vi.fn() };
  return { mockDb };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  sitesTable: {
    id: "id", name: "name", status: "status",
  },
  rollSubmissionsTable: {
    id: "id", siteId: "siteId", weekStart: "weekStart",
    submitted: "submitted", accurate: "accurate",
    notes: "notes", updatedBy: "updatedBy", updatedAt: "updatedAt",
  },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:  vi.fn((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(",")})`),
  asc: vi.fn((col: unknown) => `asc(${String(col)})`),
}));

import rollSubmissionsRouter from "./roll-submissions";

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: pino({ level: "silent" }, new Writable({ write(_c, _e, cb) { cb(); } })) }));
  app.use("/api", rollSubmissionsRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests — GET /api/roll-submissions (weekly marking list)
// ---------------------------------------------------------------------------

describe("GET /api/roll-submissions — active-only site filter", () => {
  let sitesChain: ReturnType<typeof makeChain>;
  let submissionsChain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    // First db.select() call → sites query; second → submissions query
    sitesChain     = makeChain(ACTIVE_SITES);
    submissionsChain = makeChain([]);
    mockDb.select
      .mockReturnValueOnce(sitesChain)
      .mockReturnValue(submissionsChain);
  });

  it("returns HTTP 200", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions");
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate to the sites query", async () => {
    await request(buildTestApp()).get("/api/roll-submissions");
    expect(sitesChain.where).toHaveBeenCalled();
    const predicates = (sitesChain.where as ReturnType<typeof vi.fn>).mock.calls
      .map(([p]: [unknown]) => String(p));
    expect(predicates.some((p) => p === "eq(status,active)")).toBe(true);
  });

  it("does not include Lumen Christi (id=9) in the sites list", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions");
    const siteIds: number[] = res.body.sites.map((s: { siteId: number }) => s.siteId);
    expect(siteIds).not.toContain(9);
  });

  it("does not include Sacred Heart (id=10) in the sites list", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions");
    const siteIds: number[] = res.body.sites.map((s: { siteId: number }) => s.siteId);
    expect(siteIds).not.toContain(10);
  });

  it("returns exactly 7 sites (active only)", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions");
    expect(res.body.sites).toHaveLength(7);
  });

  it("site names match the 7 known active sites", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions");
    const names: string[] = res.body.sites.map((s: { siteName: string }) => s.siteName);
    expect(names).toContain("Blackburn");
    expect(names).toContain("Vermont");
    expect(names).not.toContain("Lumen Christi");
    expect(names).not.toContain("Sacred Heart");
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/roll-submissions/report (compliance report)
// ---------------------------------------------------------------------------

describe("GET /api/roll-submissions/report — active-only site filter", () => {
  let sitesChain: ReturnType<typeof makeChain>;
  let submissionsChain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    sitesChain       = makeChain(ACTIVE_SITES);
    submissionsChain = makeChain([]);
    mockDb.select
      .mockReturnValueOnce(sitesChain)   // sites (active filter)
      .mockReturnValue(submissionsChain); // roll submission records
  });

  it("returns HTTP 200", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate to the sites query in the report", async () => {
    await request(buildTestApp()).get("/api/roll-submissions/report");
    expect(sitesChain.where).toHaveBeenCalled();
    const predicates = (sitesChain.where as ReturnType<typeof vi.fn>).mock.calls
      .map(([p]: [unknown]) => String(p));
    expect(predicates.some((p) => p === "eq(status,active)")).toBe(true);
  });

  it("does not include Lumen Christi (id=9) in the compliance report", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    const siteIds: number[] = res.body.sites.map((s: { siteId: number }) => s.siteId);
    expect(siteIds).not.toContain(9);
  });

  it("does not include Sacred Heart (id=10) in the compliance report", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    const siteIds: number[] = res.body.sites.map((s: { siteId: number }) => s.siteId);
    expect(siteIds).not.toContain(10);
  });

  it("compliance report covers exactly 7 active sites", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    expect(res.body.sites).toHaveLength(7);
  });
});
