/**
 * Confirms that the dashboard summary counts only active sites in the
 * "Total Sites" metric. Pending sites (e.g. Lumen Christi id=9, Sacred Heart
 * id=10) must not be included in the count once they are published as pending.
 *
 * Route covered: GET /api/dashboard/summary → totalSites field
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

const ACTIVE_SITE_IDS = [
  { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 },
  { id: 5 }, { id: 6 }, { id: 7 },
];
// 7 active sites, 2 pending (ids 9 and 10 excluded by active filter)

// ---------------------------------------------------------------------------
// Chain factory
// ---------------------------------------------------------------------------

interface MockChain {
  from:    ReturnType<typeof vi.fn>;
  where:   ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit:   ReturnType<typeof vi.fn>;
  then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown): Promise<unknown>;
  catch(onRej: (e: unknown) => unknown): Promise<unknown>;
}

function makeChain(resolveData: unknown[]): MockChain {
  const thenable: MockChain = {
    from:    vi.fn(),
    where:   vi.fn(),
    orderBy: vi.fn(),
    limit:   vi.fn(),
    then(resolve, reject) { return Promise.resolve(resolveData).then(resolve, reject); },
    catch(onRej) { return Promise.resolve(resolveData).catch(onRej); },
  };
  thenable.from.mockReturnValue(thenable);
  thenable.where.mockReturnValue(thenable);
  thenable.orderBy.mockReturnValue(thenable);
  thenable.limit.mockReturnValue(thenable);
  return thenable;
}

const COUNT_ZERO = makeChain([{ count: 0 }]);
const EMPTY      = makeChain([]);

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select:         vi.fn(),
    selectDistinct: vi.fn(),
  };
  return { mockDb };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  childrenTable:                { id: "id", status: "status" },
  staffTable:                   { id: "id", isSuperAdmin: "isSuperAdmin" },
  observationsTable:            { id: "id", createdAt: "createdAt" },
  programsTable:                { id: "id", status: "status" },
  nqsAreasTable:                { id: "id", status: "status" },
  sitesTable:                   { id: "id", status: "status" },
  planningExperiencesTable:     { id: "id", siteId: "siteId", weeklyPlanData: "weeklyPlanData", startDate: "startDate" },
  staffQualificationsTable:     { id: "id", staffId: "staffId", expiryDate: "expiryDate" },
  postsTable:                   { id: "id", createdAt: "createdAt" },
  jottingsTable:                { id: "id", createdAt: "createdAt" },
  incidentsTable:               { id: "id", status: "status", archived: "archived" },
  conditionReportsTable:        { id: "id", status: "status" },
  outcomesTable:                { id: "id", number: "number", title: "title" },
  welfareNotesTable:            { id: "id", createdAt: "createdAt" },
  behaviouralNotificationsTable:{ id: "id", createdAt: "createdAt" },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:        vi.fn((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`),
  ne:        vi.fn((_col: unknown, val: unknown) => `ne(${String(_col)},${String(val)})`),
  and:       vi.fn((...args: unknown[]) => `and(${args.join(",")})`),
  gte:       vi.fn(() => "gte"),
  lte:       vi.fn(() => "lte"),
  count:     vi.fn(() => "count()"),
  desc:      vi.fn((col: unknown) => `desc(${String(col)})`),
  isNotNull: vi.fn(() => "isNotNull"),
}));

vi.mock("@workspace/api-zod", () => ({
  GetDashboardSummaryResponse:   { parse: vi.fn((d: unknown) => d) },
  GetRecentObservationsResponse: { parse: vi.fn((d: unknown) => d) },
  GetOutcomeCountsResponse:      { parse: vi.fn((d: unknown) => d) },
  GetRecentActivityResponse:     { parse: vi.fn((d: unknown) => d) },
}));

import dashboardRouter from "./dashboard";

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: pino({ level: "silent" }, new Writable({ write(_c, _e, cb) { cb(); } })) }));
  app.use("/api", dashboardRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests — GET /api/dashboard/summary
// ---------------------------------------------------------------------------

describe("GET /api/dashboard/summary — totalSites active-only filter", () => {
  // The dashboard/summary route issues these db.select() calls in order:
  //  1  totalChildren          → COUNT_ZERO
  //  2  activeChildren (where) → COUNT_ZERO
  //  3  totalStaff    (where)  → COUNT_ZERO
  //  4  totalObs               → COUNT_ZERO
  //  5  last7Obs      (where)  → COUNT_ZERO
  //  6  totalPrograms          → COUNT_ZERO
  //  7  activePrograms (where) → COUNT_ZERO
  //  8  nqsAreas               → EMPTY
  //  9  allSites (where: status=active) → ACTIVE_SITE_IDS  ← KEY ASSERTION
  // 10  staffQualifications    → EMPTY
  // 11  postsLast7             → COUNT_ZERO
  // 12  jottingsLast7          → COUNT_ZERO
  // 13  openIncidents  (where) → COUNT_ZERO
  // 14  openConditions (where) → COUNT_ZERO
  // db.selectDistinct() also called once for published plans → EMPTY
  //
  // We control call #9 via a dedicated spy chain to verify the active predicate.

  let sitesChain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    sitesChain = makeChain(ACTIVE_SITE_IDS);

    // Wire sequential db.select() calls; call 9 is the sites query.
    mockDb.select
      .mockReturnValueOnce(COUNT_ZERO)  // 1. totalChildren
      .mockReturnValueOnce(COUNT_ZERO)  // 2. activeChildren
      .mockReturnValueOnce(COUNT_ZERO)  // 3. totalStaff
      .mockReturnValueOnce(COUNT_ZERO)  // 4. totalObs
      .mockReturnValueOnce(COUNT_ZERO)  // 5. last7Obs
      .mockReturnValueOnce(COUNT_ZERO)  // 6. totalPrograms
      .mockReturnValueOnce(COUNT_ZERO)  // 7. activePrograms
      .mockReturnValueOnce(EMPTY)       // 8. nqsAreas
      .mockReturnValueOnce(sitesChain)  // 9. allSites ← asserted below
      .mockReturnValueOnce(EMPTY)       // 10. staffQuals
      .mockReturnValueOnce(COUNT_ZERO)  // 11. postsLast7
      .mockReturnValueOnce(COUNT_ZERO)  // 12. jottingsLast7
      .mockReturnValueOnce(COUNT_ZERO)  // 13. openIncidents
      .mockReturnValue(COUNT_ZERO);     // 14. openConditions (and any remainder)

    // db.selectDistinct → published plans (one call)
    mockDb.selectDistinct.mockReturnValue(makeChain([]));
  });

  it("returns HTTP 200", async () => {
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate to the sites query", async () => {
    await request(buildTestApp()).get("/api/dashboard/summary");
    expect(sitesChain.where).toHaveBeenCalled();
    const predicates = (sitesChain.where as ReturnType<typeof vi.fn>).mock.calls
      .map(([p]: [unknown]) => String(p));
    expect(predicates.some((p) => p === "eq(status,active)")).toBe(true);
  });

  it("totalSites equals the number of active sites returned by the filtered query", async () => {
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    // ACTIVE_SITE_IDS has 7 items (pending ids 9 and 10 are absent from the mock)
    expect(res.body.totalSites).toBe(7);
  });

  it("totalSites does not count pending sites (ids 9 and 10)", async () => {
    // If pending sites were included the mock would return 9; we confirm it's 7.
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.body.totalSites).not.toBe(9);
    expect(res.body.totalSites).toBe(7);
  });

  it("response body is a valid JSON object with totalSites", async () => {
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.body).toHaveProperty("totalSites");
    expect(typeof res.body.totalSites).toBe("number");
  });
});
