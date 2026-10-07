/**
 * Confirms that pending sites are never included in the roll-marking endpoints:
 *   - GET /api/roll-submissions  (weekly site list for roll marking)
 *   - GET /api/roll-submissions/report  (compliance report)
 *
 * Both endpoints apply WHERE status = 'active' on the sites table.
 * The mock starts with a mixed dataset (active + pending) and only resolves
 * to active sites when the exact status='active' predicate is applied — so if
 * the WHERE clause were removed the pending sites would appear and the tests
 * would fail.  This makes the absence assertions genuinely behavioural rather
 * than tautological.
 *
 * Mock pattern follows sites-pending-filter.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const EPOCH = new Date("2025-01-01T00:00:00Z");
const WEEK_START = "2025-01-06"; // a known Monday

function makeSite(id: number, name: string, status: "active" | "pending" | "closed") {
  return { id, name, status, address: null, grouping: null, isDoscel: false, createdAt: EPOCH };
}

const ACTIVE_SITES = [
  makeSite(1, "Blackburn",     "active"),
  makeSite(2, "Box Hill",      "active"),
  makeSite(3, "Burwood",       "active"),
  makeSite(4, "Doncaster",     "active"),
  makeSite(5, "Glen Waverley", "active"),
  makeSite(6, "Mitcham",       "active"),
  makeSite(7, "Vermont",       "active"),
];

const LUMEN_CHRISTI = makeSite(9,  "Lumen Christi", "pending");
const SACRED_HEART  = makeSite(10, "Sacred Heart",  "pending");

// Mixed dataset: what the DB would return if there were no WHERE clause
const ALL_SITES = [...ACTIVE_SITES, LUMEN_CHRISTI, SACRED_HEART];

// Roll submissions — only active sites have rows in production
const MOCK_SUBMISSIONS = [
  { id: 101, siteId: 1, weekStart: WEEK_START, submitted: true,  accurate: true,  notes: null, updatedBy: "admin", updatedAt: EPOCH },
  { id: 102, siteId: 2, weekStart: WEEK_START, submitted: false, accurate: false, notes: null, updatedBy: null,    updatedAt: EPOCH },
];

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------
//
// db.select() is called twice per request (once for sites, once for
// submissions).  Each call returns a fresh chain.  The chain's .from()
// detects which table is being queried via a _marker property set on the
// mock table objects.
//
// Sites chain:
//   - Defaults to ALL_SITES (mixed active + pending)
//   - When .where() is called with the exact status='active' predicate the
//     chain switches to ACTIVE_SITES only.
//   This means: if the route's WHERE clause is removed, pending sites appear
//   in the response and the absence assertions fail — a genuine regression.
//
// Submissions chain:
//   - Always resolves to _submissions regardless of predicates.

const {
  mockDb,
  setActiveSites,
  setAllSites,
  setSubmissions,
  getWherePredicates,
  resetState,
} = vi.hoisted(() => {
  let _activeSites: unknown[] = [];
  let _allSites: unknown[] = [];
  let _submissions: unknown[] = [];
  let _wherePredicates: string[] = [];

  function makeChain(isSitesTable: boolean) {
    // Default data: mixed for sites, submissions for the other table
    let _resolve: unknown[] = isSitesTable ? _allSites : _submissions;

    const chain: any = {
      from(table: any) {
        // Detect table type via _marker set in the @workspace/db mock below
        const marker: string = table?._marker ?? "unknown";
        const forSites = marker === "sites";
        _resolve = forSites ? _allSites : _submissions;
        return makeChain(forSites);
      },
      where(predicate: unknown) {
        const p = String(predicate);
        _wherePredicates.push(p);
        if (p.includes("status") && p.includes("active")) {
          // The route correctly filtered — resolve to active-only list
          _resolve = _activeSites;
        }
        return chain;
      },
      orderBy() { return chain; },
      limit()   { return chain; },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(_resolve).then(resolve, reject);
      },
      catch(onRej: (e: unknown) => unknown) {
        return Promise.resolve(_resolve).catch(onRej);
      },
    };

    // Override from() so each new select() gets the right defaults
    chain.from = function (table: any) {
      const marker: string = table?._marker ?? "unknown";
      const forSites = marker === "sites";
      // Re-bind _resolve based on table type
      _resolve = forSites ? _allSites : _submissions;
      // Return the same chain object so .where(), .orderBy() etc. chain correctly
      return chain;
    };

    return chain;
  }

  const mockDb = {
    select: vi.fn(() => makeChain(false /* resolved by from() */)),
    insert: vi.fn(() => makeChain(false)),
    update: vi.fn(() => makeChain(false)),
    delete: vi.fn(() => makeChain(false)),
  };

  return {
    mockDb,
    setActiveSites: (data: unknown[]) => { _activeSites = data; },
    setAllSites:    (data: unknown[]) => { _allSites = data; },
    setSubmissions: (data: unknown[]) => { _submissions = data; },
    getWherePredicates: () => _wherePredicates,
    resetState: () => { _wherePredicates = []; },
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => ({
  db: mockDb,
  // _marker is read by the chain's .from() to identify the table type
  sitesTable: {
    _marker: "sites",
    id: "id", name: "name", status: "status",
    address: "address", grouping: "grouping", isDoscel: "isDoscel", createdAt: "createdAt",
  },
  rollSubmissionsTable: {
    _marker: "submissions",
    id: "id", siteId: "siteId", weekStart: "weekStart",
    submitted: "submitted", accurate: "accurate",
    notes: "notes", updatedBy: "updatedBy", updatedAt: "updatedAt",
  },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:  vi.fn((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(",")})`),
}));

vi.mock("@workspace/api-zod", () => ({
  GetRollComplianceReportResponse: { parse: vi.fn((d: unknown) => d) },
}));

import rollSubmissionsRouter from "./roll-submissions";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    pinoHttp({
      logger: pino({ level: "silent" }, new Writable({ write(_c, _e, cb) { cb(); } })),
    }),
  );
  app.use((req: any, _res: any, next: any) => { req.session = {}; next(); });
  app.use("/api", rollSubmissionsRouter);
  return app;
}

describe("Service opening-date eligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
    const newSite = { ...makeSite(1, "New service", "active"), serviceStartDate: "2026-09-23" };
    const oldSite = makeSite(2, "Established service", "active");
    setActiveSites([newSite, oldSite]);
    setAllSites([newSite, oldSite]);
    setSubmissions([
      { ...MOCK_SUBMISSIONS[0], weekStart: "2026-09-14" },
      { ...MOCK_SUBMISSIONS[0], weekStart: "2026-09-21" },
      { ...MOCK_SUBMISSIONS[0], weekStart: "2026-09-28" },
    ]);
  });
  afterEach(() => vi.useRealTimers());

  it("excludes a new service from weekly lists before its opening week", async () => {
    const response = await request(buildTestApp()).get("/api/roll-submissions?weekStart=2026-09-14");
    expect(response.status).toBe(200);
    expect(response.body.sites.map((site: { siteId: number }) => site.siteId)).toEqual([2]);
  });

  it("includes a service in the week containing its midweek opening", async () => {
    const response = await request(buildTestApp()).get("/api/roll-submissions?weekStart=2026-09-21");
    expect(response.body.sites.map((site: { siteId: number }) => site.siteId)).toEqual([1, 2]);
  });

  it("adjusts report denominators and ignores pre-opening submissions", async () => {
    const response = await request(buildTestApp()).get("/api/roll-submissions/report");
    expect(response.status).toBe(200);
    const newSite = response.body.sites.find((site: { siteId: number }) => site.siteId === 1);
    expect(newSite.serviceStartDate).toBe("2026-09-23");
    for (const period of ["last4Weeks", "last12Weeks", "last52Weeks"]) {
      expect(newSite[period]).toEqual({ submitted: 2, totalPossible: 2, pct: 100 });
    }
    expect(response.body.sites[1].last52Weeks.totalPossible).toBe(52);
  });

  it("blocks writes for a service before its opening week", async () => {
    const response = await request(buildTestApp()).put("/api/roll-submissions/2026-09-14/1").send({ submitted: true });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("service start date");
  });
});

// ---------------------------------------------------------------------------
// GET /api/roll-submissions — weekly roll-marking list
// ---------------------------------------------------------------------------

describe("GET /api/roll-submissions — active-site filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    setActiveSites(ACTIVE_SITES);
    setAllSites(ALL_SITES);      // mock starts with mixed data (active + pending)
    setSubmissions(MOCK_SUBMISSIONS);
  });

  it("returns HTTP 200", async () => {
    const res = await request(buildTestApp()).get(`/api/roll-submissions?weekStart=${WEEK_START}`);
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate when fetching sites", async () => {
    await request(buildTestApp()).get(`/api/roll-submissions?weekStart=${WEEK_START}`);
    const predicates = getWherePredicates();
    expect(predicates.some((p) => p === "eq(status,active)")).toBe(true);
  });

  it("does not include Lumen Christi (id=9) even though the DB returns it in the mixed dataset", async () => {
    // ALL_SITES includes LUMEN_CHRISTI; the active-filter must exclude it
    const res = await request(buildTestApp()).get(`/api/roll-submissions?weekStart=${WEEK_START}`);
    const ids: number[] = res.body.sites.map((s: { siteId: number }) => s.siteId);
    expect(ids).not.toContain(9);
  });

  it("does not include Sacred Heart (id=10) even though the DB returns it in the mixed dataset", async () => {
    const res = await request(buildTestApp()).get(`/api/roll-submissions?weekStart=${WEEK_START}`);
    const ids: number[] = res.body.sites.map((s: { siteId: number }) => s.siteId);
    expect(ids).not.toContain(10);
  });

  it("returns exactly 7 entries — only the active sites from the mixed dataset", async () => {
    const res = await request(buildTestApp()).get(`/api/roll-submissions?weekStart=${WEEK_START}`);
    expect(res.body.sites).toHaveLength(7);
  });

  it("echoes the weekStart in the response body", async () => {
    const res = await request(buildTestApp()).get(`/api/roll-submissions?weekStart=${WEEK_START}`);
    expect(res.body.weekStart).toBe(WEEK_START);
  });

  it("returns HTTP 400 for a malformed weekStart", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions?weekStart=not-a-date");
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/roll-submissions/report — compliance report
// ---------------------------------------------------------------------------

describe("GET /api/roll-submissions/report — active-site filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetState();
    setActiveSites(ACTIVE_SITES);
    setAllSites(ALL_SITES);      // mock starts with mixed data (active + pending)
    setSubmissions(MOCK_SUBMISSIONS);
  });

  it("returns HTTP 200", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate when fetching sites", async () => {
    await request(buildTestApp()).get("/api/roll-submissions/report");
    const predicates = getWherePredicates();
    expect(predicates.some((p) => p === "eq(status,active)")).toBe(true);
  });

  it("does not include Lumen Christi (id=9) even though the DB returns it in the mixed dataset", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    const ids: number[] = (res.body.sites ?? []).map((s: { siteId: number }) => s.siteId);
    expect(ids).not.toContain(9);
  });

  it("does not include Sacred Heart (id=10) even though the DB returns it in the mixed dataset", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    const ids: number[] = (res.body.sites ?? []).map((s: { siteId: number }) => s.siteId);
    expect(ids).not.toContain(10);
  });

  it("counts exactly 7 active sites — not 9 (active + pending) — from the mixed dataset", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    expect(res.body.sites).toHaveLength(7);
  });

  it("returns an empty sites array when no active sites exist", async () => {
    setActiveSites([]);
    const res = await request(buildTestApp()).get("/api/roll-submissions/report");
    expect(res.status).toBe(200);
    expect(res.body.sites).toHaveLength(0);
  });

  it("filters to a single site when ?siteId matches an active site", async () => {
    const res = await request(buildTestApp()).get("/api/roll-submissions/report?siteId=1");
    expect(res.status).toBe(200);
    const ids: number[] = (res.body.sites ?? []).map((s: { siteId: number }) => s.siteId);
    expect(ids).toContain(1);
    expect(res.body.sites).toHaveLength(1);
  });

  it("returns an empty sites array when ?siteId matches only a pending site", async () => {
    // siteId=9 is Lumen Christi (pending) — filtered out by the active WHERE clause
    const res = await request(buildTestApp()).get("/api/roll-submissions/report?siteId=9");
    expect(res.status).toBe(200);
    expect(res.body.sites).toHaveLength(0);
  });
});
