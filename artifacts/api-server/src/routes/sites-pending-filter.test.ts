/**
 * Confirms that pending sites (e.g. Lumen Christi id=9, Sacred Heart id=10)
 * are hidden from all consumers except the Settings → Sites management page
 * once the `?all=true` flag is absent.
 *
 * The filtering in sites.ts works like this:
 *   - Default (no ?all):  WHERE status = 'active'  → callers get active sites only
 *   - ?all=true:          Company WHERE only         → management page gets all company sites
 *
 * These tests confirm both paths behave correctly and that the exact
 * status-column predicate is applied.
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

function makeSite(id: number, name: string, status: "active" | "pending" | "closed") {
  return { id, name, status, address: null, grouping: null, isDoscel: false, createdAt: EPOCH };
}

const ACTIVE_SITES = [
  makeSite(1, "Blackburn", "active"),
  makeSite(2, "Box Hill", "active"),
  makeSite(3, "Burwood", "active"),
  makeSite(4, "Doncaster", "active"),
  makeSite(5, "Glen Waverley", "active"),
  makeSite(6, "Mitcham", "active"),
  makeSite(7, "Vermont", "active"),
];

const LUMEN_CHRISTI = makeSite(9, "Lumen Christi", "pending");
const SACRED_HEART  = makeSite(10, "Sacred Heart",  "pending");
const ALL_SITES     = [...ACTIVE_SITES, LUMEN_CHRISTI, SACRED_HEART];

// ---------------------------------------------------------------------------
// Hoisted mock setup
// ---------------------------------------------------------------------------

const { mockDb, chain, setActiveSites, setAllSites, rewireChain } = vi.hoisted(() => {
  // The mock query chain applies the predicate itself: when where() is called
  // with the exact active-status predicate it resolves to active sites only;
  // when no where() call is made it resolves to all sites.
  // This makes response-body assertions independent of what the test injects.
  let _activeSites: unknown[] = [];
  let _allSites: unknown[] = [];

  const chain = {
    from:    vi.fn(),
    where:   vi.fn(),
    orderBy: vi.fn(),
    // Thenable: resolves to all sites; where() overrides this via side-effect
    _resolve: null as unknown[] | null,
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(chain._resolve ?? _allSites).then(resolve, reject);
    },
    catch(onRej: (e: unknown) => unknown) {
      return Promise.resolve(chain._resolve ?? _allSites).catch(onRej);
    },
  };

  // Re-wires chain methods using the live closure variables (_activeSites,
  // _allSites). Called both during initial setup and after vi.clearAllMocks().
  function rewireChain() {
    chain._resolve = null;
    chain.from.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.where.mockImplementation((predicate: unknown) => {
      if (String(predicate).includes("status") && String(predicate).includes("active")) {
        // Use the live _activeSites variable so setActiveSites() in tests works
        chain._resolve = _activeSites;
      }
      return chain;
    });
  }

  rewireChain();

  const mockDb = {
    select: vi.fn(() => {
      chain._resolve = null; // reset for each new query
      return chain;
    }),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  };

  return {
    mockDb,
    chain,
    setActiveSites: (data: unknown[]) => { _activeSites = data; },
    setAllSites: (data: unknown[]) => { _allSites = data; },
    rewireChain,
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  sitesTable: { id: "id", name: "name", status: "status", address: "address", grouping: "grouping", isDoscel: "isDoscel", createdAt: "createdAt" },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:  vi.fn((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`),
  and: vi.fn((...args: unknown[]) => `and(${args.join(",")})`),
}));

vi.mock("@workspace/api-zod", () => ({
  ListSitesResponse:   { parse: vi.fn((d: unknown) => d) },
  CreateSiteBody:      { safeParse: vi.fn() },
  UpdateSiteParams:    { safeParse: vi.fn() },
  UpdateSiteBody:      { safeParse: vi.fn() },
  UpdateSiteResponse:  { parse: vi.fn((d: unknown) => d) },
  DeleteSiteParams:    { safeParse: vi.fn() },
}));

import sitesRouter from "./sites";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: pino({ level: "silent" }, new Writable({ write(_c, _e, cb) { cb(); } })) }));
  app.use((_req, res, next) => {
    res.locals.organisationId = 1;
    res.locals.organisationContextVerified = true;
    next();
  });
  app.use("/api", sitesRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/sites — pending-site visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set data first so rewireChain's closure captures the right values
    setActiveSites(ACTIVE_SITES);
    setAllSites(ALL_SITES);
    rewireChain();
    mockDb.select.mockImplementation(() => { chain._resolve = null; return chain; });
  });

  // ── Default path: active-only ──────────────────────────────────────────────

  it("returns HTTP 200 for the default request", async () => {
    const res = await request(buildTestApp()).get("/api/sites");
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate on the default request", async () => {
    await request(buildTestApp()).get("/api/sites");
    expect(chain.where).toHaveBeenCalled();
    const predicates = chain.where.mock.calls.map(([p]: [unknown]) => String(p));
    expect(predicates.some((p) => p.includes("eq(status,active)"))).toBe(true);
  });

  it("does not include Lumen Christi (id=9) in the default response", async () => {
    const res = await request(buildTestApp()).get("/api/sites");
    const ids: number[] = res.body.map((s: { id: number }) => s.id);
    expect(ids).not.toContain(9);
  });

  it("does not include Sacred Heart (id=10) in the default response", async () => {
    const res = await request(buildTestApp()).get("/api/sites");
    const ids: number[] = res.body.map((s: { id: number }) => s.id);
    expect(ids).not.toContain(10);
  });

  it("returns exactly the 7 active sites on the default request", async () => {
    const res = await request(buildTestApp()).get("/api/sites");
    expect(res.body).toHaveLength(7);
  });

  it("all sites in the default response carry status='active'", async () => {
    const res = await request(buildTestApp()).get("/api/sites");
    const statuses: string[] = res.body.map((s: { status: string }) => s.status);
    expect(statuses.every((st) => st === "active")).toBe(true);
  });

  // ── ?all=true path: management page sees all sites ─────────────────────────

  it("returns HTTP 200 for ?all=true", async () => {
    const res = await request(buildTestApp()).get("/api/sites?all=true");
    expect(res.status).toBe(200);
  });

  it("does NOT apply a status WHERE predicate when ?all=true is set", async () => {
    await request(buildTestApp()).get("/api/sites?all=true");
    const predicates = chain.where.mock.calls.map(([p]: [unknown]) => String(p));
    expect(predicates.length).toBeGreaterThan(0);
    expect(predicates.every((p) => !p.includes("eq(status,active)"))).toBe(true);
  });

  it("includes Lumen Christi (id=9) when ?all=true is set", async () => {
    const res = await request(buildTestApp()).get("/api/sites?all=true");
    const ids: number[] = res.body.map((s: { id: number }) => s.id);
    expect(ids).toContain(9);
  });

  it("includes Sacred Heart (id=10) when ?all=true is set", async () => {
    const res = await request(buildTestApp()).get("/api/sites?all=true");
    const ids: number[] = res.body.map((s: { id: number }) => s.id);
    expect(ids).toContain(10);
  });

  it("returns all 9 sites (active + pending) when ?all=true is set", async () => {
    const res = await request(buildTestApp()).get("/api/sites?all=true");
    expect(res.body).toHaveLength(9);
  });

  // ── Status promotion: pending → active ────────────────────────────────────

  it("a promoted pending site appears in the active-only list once its status is 'active'", async () => {
    // Simulate Lumen Christi promoted to active in the DB result
    const promotedSites = [...ACTIVE_SITES, { ...LUMEN_CHRISTI, status: "active" }];
    setActiveSites(promotedSites);

    const res = await request(buildTestApp()).get("/api/sites");

    // Active filter still applied
    const predicates = chain.where.mock.calls.map(([p]: [unknown]) => String(p));
    expect(predicates.some((p) => p.includes("eq(status,active)"))).toBe(true);

    const ids: number[] = res.body.map((s: { id: number }) => s.id);
    expect(ids).toContain(9);
    expect(res.body).toHaveLength(8);
  });
});
