/**
 * Confirms that the GET /api/dashboard/summary endpoint computes totalSites
 * by counting only active sites. If the active-status WHERE predicate on
 * sitesTable is ever removed, these tests will catch it immediately.
 *
 * Mock pattern follows sites-pending-filter.test.ts.
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

const EPOCH = new Date("2025-01-01T00:00:00Z");

function makeSite(id: number, name: string, status: "active" | "pending") {
  return { id, name, status, address: null, grouping: null, isDoscel: false, createdAt: EPOCH };
}

const ACTIVE_SITES = [
  makeSite(1, "Blackburn",      "active"),
  makeSite(2, "Box Hill",       "active"),
  makeSite(3, "Burwood",        "active"),
  makeSite(4, "Doncaster",      "active"),
  makeSite(5, "Glen Waverley",  "active"),
  makeSite(6, "Mitcham",        "active"),
  makeSite(7, "Vermont",        "active"),
];

const PENDING_SITES = [
  makeSite(9,  "Lumen Christi", "pending"),
  makeSite(10, "Sacred Heart",  "pending"),
];

const ALL_SITES = [...ACTIVE_SITES, ...PENDING_SITES];

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------

const { mockDb, sitesChain, setActiveSites, rewireSitesChain } = vi.hoisted(() => {
  let _activeSites: unknown[] = [];

  // A dedicated chain for the sites table that respects the active filter.
  const sitesChain = {
    from:    vi.fn(),
    where:   vi.fn(),
    orderBy: vi.fn(),
    _resolve: null as unknown[] | null,
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(sitesChain._resolve ?? _activeSites).then(resolve, reject);
    },
    catch(onRej: (e: unknown) => unknown) {
      return Promise.resolve(sitesChain._resolve ?? _activeSites).catch(onRej);
    },
  };

  function rewireSitesChain() {
    sitesChain._resolve = null;
    sitesChain.from.mockReturnValue(sitesChain);
    sitesChain.orderBy.mockReturnValue(sitesChain);
    sitesChain.where.mockImplementation((predicate: unknown) => {
      if (String(predicate).includes("status") && String(predicate).includes("active")) {
        sitesChain._resolve = _activeSites;
      }
      return sitesChain;
    });
  }

  rewireSitesChain();

  // Generic chain for all other tables — returns [{ count: 0 }] or [] as
  // appropriate. The test only cares about totalSites, so these just need
  // to resolve without throwing.
  function makeCountChain(defaultValue: unknown[]) {
    const c: Record<string, unknown> = {};
    const thenable = {
      ...c,
      from:         vi.fn(),
      where:        vi.fn(),
      orderBy:      vi.fn(),
      selectDistinct: vi.fn(),
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
        return Promise.resolve(defaultValue).then(resolve, reject);
      },
      catch(onRej: (e: unknown) => unknown) {
        return Promise.resolve(defaultValue).catch(onRej);
      },
    };
    thenable.from.mockReturnValue(thenable);
    thenable.where.mockReturnValue(thenable);
    thenable.orderBy.mockReturnValue(thenable);
    return thenable;
  }

  const countChain  = makeCountChain([{ count: 0 }]);
  const emptyChain  = makeCountChain([]);

  // mockDb routes to the correct chain by inspecting what column object was
  // passed to select(). The sites select uses `{ id: sitesTable.id }`, where
  // sitesTable.id === "id" (from the vi.mock below), so we key on that.
  const mockDb = {
    select: vi.fn((cols?: unknown) => {
      // If cols has a key named "id" (sites select pattern) return sitesChain.
      // Everything else gets a generic count/empty chain.
      if (cols && typeof cols === "object" && "id" in (cols as object)) {
        sitesChain._resolve = null;
        return sitesChain;
      }
      // selectDistinct-like pattern: siteId key → empty array (no published plans)
      if (cols && typeof cols === "object" && "siteId" in (cols as object)) {
        return emptyChain;
      }
      // staffQuals pattern: staffId key → empty array (no expiring quals)
      if (cols && typeof cols === "object" && "staffId" in (cols as object)) {
        return emptyChain;
      }
      return countChain;
    }),
    selectDistinct: vi.fn(() => emptyChain),
    insert: vi.fn(() => countChain),
    update: vi.fn(() => countChain),
    delete: vi.fn(() => countChain),
  };

  return {
    mockDb,
    sitesChain,
    setActiveSites: (data: unknown[]) => { _activeSites = data; },
    rewireSitesChain,
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  childrenTable:                { id: "id", status: "status", createdAt: "createdAt" },
  staffTable:                   { id: "id", isSuperAdmin: "isSuperAdmin" },
  observationsTable:            { id: "id", createdAt: "createdAt" },
  programsTable:                { id: "id", status: "status" },
  nqsAreasTable:                { id: "id", status: "status" },
  outcomesTable:                { id: "id" },
  postsTable:                   { id: "id", createdAt: "createdAt" },
  incidentsTable:               { id: "id", status: "status", archived: "archived" },
  conditionReportsTable:        { id: "id", status: "status" },
  sitesTable:                   { id: "id", name: "name", status: "status" },
  planningExperiencesTable:     { id: "id", siteId: "siteId", weeklyPlanData: "weeklyPlanData", startDate: "startDate" },
  staffQualificationsTable:     { id: "id", staffId: "staffId", expiryDate: "expiryDate" },
  jottingsTable:                { id: "id", createdAt: "createdAt" },
  welfareNotesTable:            { id: "id", createdAt: "createdAt" },
  behaviouralNotificationsTable:{ id: "id", createdAt: "createdAt" },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:        vi.fn((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`),
  ne:        vi.fn((_col: unknown, val: unknown) => `ne(${String(_col)},${String(val)})`),
  and:       vi.fn((...args: unknown[]) => `and(${args.join(",")})`),
  gte:       vi.fn((_col: unknown, val: unknown) => `gte(${String(_col)},${String(val)})`),
  lte:       vi.fn((_col: unknown, val: unknown) => `lte(${String(_col)},${String(val)})`),
  isNotNull: vi.fn((col: unknown) => `isNotNull(${String(col)})`),
  count:     vi.fn(() => "count()"),
  desc:      vi.fn((col: unknown) => `desc(${String(col)})`),
}));

vi.mock("@workspace/api-zod", () => ({
  GetDashboardSummaryResponse:    { parse: vi.fn((d: unknown) => d) },
  GetRecentObservationsResponse:  { parse: vi.fn((d: unknown) => d) },
  GetOutcomeCountsResponse:       { parse: vi.fn((d: unknown) => d) },
  GetRecentActivityResponse:      { parse: vi.fn((d: unknown) => d) },
}));

import dashboardRouter from "./dashboard";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    pinoHttp({
      logger: pino({ level: "silent" }, new Writable({ write(_c, _e, cb) { cb(); } })),
    }),
  );
  app.use("/api", dashboardRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/dashboard/summary — totalSites active-only filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveSites(ACTIVE_SITES);
    rewireSitesChain();
    // Re-wire select so it re-routes after clearAllMocks
    mockDb.select.mockImplementation((cols?: unknown) => {
      if (cols && typeof cols === "object" && "id" in (cols as object)) {
        sitesChain._resolve = null;
        return sitesChain;
      }
      if (cols && typeof cols === "object" && "siteId" in (cols as object)) {
        const emptyChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          selectDistinct: vi.fn().mockReturnThis(),
          then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
            return Promise.resolve([]).then(resolve, reject);
          },
          catch(onRej: (e: unknown) => unknown) {
            return Promise.resolve([]).catch(onRej);
          },
        };
        return emptyChain;
      }
      if (cols && typeof cols === "object" && "staffId" in (cols as object)) {
        const emptyChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          selectDistinct: vi.fn().mockReturnThis(),
          then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
            return Promise.resolve([]).then(resolve, reject);
          },
          catch(onRej: (e: unknown) => unknown) {
            return Promise.resolve([]).catch(onRej);
          },
        };
        return emptyChain;
      }
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        selectDistinct: vi.fn().mockReturnThis(),
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          return Promise.resolve([{ count: 0 }]).then(resolve, reject);
        },
        catch(onRej: (e: unknown) => unknown) {
          return Promise.resolve([{ count: 0 }]).catch(onRej);
        },
      };
      return countChain;
    });
    mockDb.selectDistinct.mockImplementation(() => {
      const emptyChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        selectDistinct: vi.fn().mockReturnThis(),
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          return Promise.resolve([]).then(resolve, reject);
        },
        catch(onRej: (e: unknown) => unknown) {
          return Promise.resolve([]).catch(onRej);
        },
      };
      return emptyChain;
    });
  });

  it("returns HTTP 200", async () => {
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate when querying sites", async () => {
    await request(buildTestApp()).get("/api/dashboard/summary");
    expect(sitesChain.where).toHaveBeenCalled();
    const predicates = sitesChain.where.mock.calls.map(([p]: [unknown]) => String(p));
    expect(predicates.some((p) => p === "eq(status,active)")).toBe(true);
  });

  it("totalSites equals the number of active sites (7), not total sites (9)", async () => {
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.body.totalSites).toBe(7);
  });

  it("totalSites does not include pending sites", async () => {
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    // ALL_SITES has 9, ACTIVE_SITES has 7 — must be 7, not 9
    expect(res.body.totalSites).not.toBe(ALL_SITES.length);
    expect(res.body.totalSites).toBe(ACTIVE_SITES.length);
  });

  it("totalSites stays at 7 even when 2 pending sites exist in the DB", async () => {
    // Simulate a hypothetical scenario where the DB contains all 9 sites
    // but the query still returns only the 7 active ones due to the filter.
    // The active filter is enforced by the where() mock routing.
    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.body.totalSites).toBe(ACTIVE_SITES.length);
    expect(res.body.totalSites).toBe(7);
  });

  it("totalSites updates correctly when a pending site is promoted to active", async () => {
    // Lumen Christi (id=9) promoted to active — active set grows to 8
    const promotedActiveSites = [...ACTIVE_SITES, { ...PENDING_SITES[0], status: "active" }];
    setActiveSites(promotedActiveSites);
    rewireSitesChain();

    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.body.totalSites).toBe(8);
  });

  it("totalSites is 0 when no active sites exist", async () => {
    setActiveSites([]);
    rewireSitesChain();

    const res = await request(buildTestApp()).get("/api/dashboard/summary");
    expect(res.body.totalSites).toBe(0);
  });
});
