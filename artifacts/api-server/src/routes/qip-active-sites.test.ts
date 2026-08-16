/**
 * Confirms that the QIP public endpoint only includes active sites in its
 * `sites` list. Pending sites (e.g. Lumen Christi id=9, Sacred Heart id=10)
 * must be absent from the site selector shown on the public QIP view.
 *
 * Route covered: GET /api/qip/public → sites[] field
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

const ACTIVE_SITES = [
  { id: 1, name: "Blackburn" },
  { id: 2, name: "Box Hill" },
  { id: 3, name: "Burwood" },
  { id: 4, name: "Doncaster" },
  { id: 5, name: "Glen Waverley" },
  { id: 6, name: "Mitcham" },
  { id: 7, name: "Vermont" },
];

// ---------------------------------------------------------------------------
// Chain factory
// ---------------------------------------------------------------------------

function makeChain(resolveData: unknown[]) {
  const c = {
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
  };
  c.from.mockReturnValue(c);
  c.where.mockReturnValue(c);
  c.orderBy.mockReturnValue(c);
  c.limit.mockReturnValue(c);
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
  childrenTable:      { firstName: "firstName", lastName: "lastName" },
  qipStrengthsTable:  { qualityArea: "qualityArea", siteId: "siteId" },
  sitesTable:         { id: "id", name: "name", status: "status" },
  qipItemsTable:      { siteId: "siteId", archivedAt: "archivedAt" },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:     vi.fn((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`),
  and:    vi.fn((...args: unknown[]) => `and(${args.join(",")})`),
  isNull: vi.fn(() => "isNull"),
}));

vi.mock("@workspace/api-zod", () => ({
  ListQipItemsResponse:      { parse: vi.fn((d: unknown) => d) },
  CreateQipItemBody:         { safeParse: vi.fn() },
  UpdateQipItemParams:       { safeParse: vi.fn() },
  UpdateQipItemBody:         { safeParse: vi.fn() },
  UpdateQipItemResponse:     { parse: vi.fn((d: unknown) => d) },
  DeleteQipItemParams:       { safeParse: vi.fn() },
  CreateQipSourceBody:       { safeParse: vi.fn() },
  UpdateQipSourceParams:     { safeParse: vi.fn() },
  UpdateQipSourceBody:       { safeParse: vi.fn() },
  UpdateQipSourceResponse:   { parse: vi.fn((d: unknown) => d) },
  DeleteQipSourceParams:     { safeParse: vi.fn() },
  ListQipSourcesResponse:    { parse: vi.fn((d: unknown) => d) },
  UpsertQipStrengthParams:   { safeParse: vi.fn() },
  UpsertQipStrengthBody:     { safeParse: vi.fn() },
  UpsertQipStrengthResponse: { parse: vi.fn((d: unknown) => d) },
  ListQipStrengthsResponse:  { parse: vi.fn((d: unknown) => d) },
}));

import qipRouter from "./qip";

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: pino({ level: "silent" }, new Writable({ write(_c, _e, cb) { cb(); } })) }));
  app.use("/api", qipRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests — GET /api/qip/public
// ---------------------------------------------------------------------------

describe("GET /api/qip/public — active-only sites filter", () => {
  // The route calls Promise.all([children, strengths, sitesRows]) in parallel.
  // The sitesRows query is the third and uses WHERE status='active'.
  // After that it calls a second db.select() for QIP items.

  let sitesChain: ReturnType<typeof makeChain>;

  beforeEach(() => {
    vi.clearAllMocks();

    sitesChain = makeChain(ACTIVE_SITES);

    // Promise.all fires three db.select() calls in parallel; order matches:
    // call 1 → children, call 2 → qipStrengths, call 3 → sites (active filter)
    // call 4 → qipItems (second round trip)
    const childrenChain  = makeChain([]);
    const strengthsChain = makeChain([]);
    const qipItemsChain  = makeChain([]);

    // mockReturnValueOnce is consumed in call order; since Promise.all
    // dispatches synchronously the order matches the source code order.
    mockDb.select
      .mockReturnValueOnce(childrenChain)  // 1. children
      .mockReturnValueOnce(strengthsChain) // 2. strengths
      .mockReturnValueOnce(sitesChain)     // 3. sites (active filter) ← key
      .mockReturnValue(qipItemsChain);     // 4. qip items
  });

  it("returns HTTP 200", async () => {
    const res = await request(buildTestApp()).get("/api/qip/public");
    expect(res.status).toBe(200);
  });

  it("applies an exact status='active' WHERE predicate to the sites query", async () => {
    await request(buildTestApp()).get("/api/qip/public");
    expect(sitesChain.where).toHaveBeenCalled();
    const predicates = sitesChain.where.mock.calls.map(([p]: [unknown]) => String(p));
    expect(predicates.some((p) => p === "eq(status,active)")).toBe(true);
  });

  it("does not include Lumen Christi (id=9) in the public sites list", async () => {
    const res = await request(buildTestApp()).get("/api/qip/public");
    const ids: number[] = res.body.sites.map((s: { id: number }) => s.id);
    expect(ids).not.toContain(9);
  });

  it("does not include Sacred Heart (id=10) in the public sites list", async () => {
    const res = await request(buildTestApp()).get("/api/qip/public");
    const ids: number[] = res.body.sites.map((s: { id: number }) => s.id);
    expect(ids).not.toContain(10);
  });

  it("returns exactly 7 active sites in the public sites list", async () => {
    const res = await request(buildTestApp()).get("/api/qip/public");
    expect(res.body.sites).toHaveLength(7);
  });

  it("site names in the public view match the 7 known active sites", async () => {
    const res = await request(buildTestApp()).get("/api/qip/public");
    const names: string[] = res.body.sites.map((s: { name: string }) => s.name);
    expect(names).toContain("Blackburn");
    expect(names).toContain("Vermont");
    expect(names).not.toContain("Lumen Christi");
    expect(names).not.toContain("Sacred Heart");
  });
});
