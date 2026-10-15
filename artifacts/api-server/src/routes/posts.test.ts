import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Hoist mocks — must run before any module imports.
//
// Design:
//   • `postsChain` — the "main" query builder for the paginated posts SELECT.
//     It is a proper thenable (its `then` delegates to a mutable `_postsRows`
//     variable) so `await postsChain` resolves correctly from any code path.
//   • `subChain`   — all follow-up SELECTs (likes, children, staff, sites).
//     Its `.where()` call is the async leaf and resolves to `[]` by default.
//   • `setPostsRows(rows)` — lets each test control what the main query returns
//     without replacing the `then` mock function.
// ---------------------------------------------------------------------------

const { postsChain, subChain, mockDb, setPostsRows } = vi.hoisted(() => {
  let _postsRows: unknown[] = [];

  // Proper thenable: `then` and `catch` delegate to a live Promise so that
  // `await postsChain` always uses the current `_postsRows` value.
  // We intentionally NOT use vi.fn() for then/catch so vi.clearAllMocks()
  // cannot accidentally clear them.
  const postsChain: Record<string, unknown> = {
    from:    vi.fn(),
    where:   vi.fn(),
    orderBy: vi.fn(),
    limit:   vi.fn(),
    offset:  vi.fn(),
    then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
      return Promise.resolve(_postsRows).then(resolve, reject);
    },
    catch(onRej: (e: unknown) => void) {
      return Promise.resolve(_postsRows).catch(onRej);
    },
  };
  postsChain.from    = vi.fn().mockReturnValue(postsChain);
  postsChain.where   = vi.fn().mockReturnValue(postsChain);
  postsChain.orderBy = vi.fn().mockReturnValue(postsChain);
  postsChain.limit   = vi.fn().mockReturnValue(postsChain);
  postsChain.offset  = vi.fn().mockReturnValue(postsChain);

  // Sub-query chain: a thenable that resolves to `[]` so any await of the
  // chain (with or without a trailing .groupBy()) resolves correctly.
  const subChain: Record<string, unknown> = {
    then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
      return Promise.resolve([]).then(resolve, reject);
    },
    catch(onRej: (e: unknown) => void) {
      return Promise.resolve([]).catch(onRej);
    },
  };
  (subChain as any).from    = vi.fn().mockReturnValue(subChain);
  (subChain as any).where   = vi.fn().mockReturnValue(subChain);
  (subChain as any).groupBy = vi.fn().mockReturnValue(subChain);
  (subChain as any).orderBy = vi.fn().mockReturnValue(subChain);

  const mockDb = { select: vi.fn() };

  function setPostsRows(rows: unknown[]) { _postsRows = rows; }

  return { postsChain, subChain, mockDb, setPostsRows };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  postsTable:               { id: "id", createdAt: "createdAt", staffId: "staffId", siteId: "siteId", childIds: "childIds" },
  postCommentsTable:        { id: "id", postId: "postId", createdAt: "createdAt" },
  postLikesTable:           { id: "id", postId: "postId", staffId: "staffId", guardianEmail: "guardianEmail" },
  postCommentViewsTable:    { id: "id", postId: "postId", staffId: "staffId", viewedAt: "viewedAt" },
  childrenTable:            { id: "id", guardianEmail: "guardianEmail", guardian2Email: "guardian2Email", siteId: "siteId", status: "status" },
  staffTable:               { id: "id", firstName: "firstName", lastName: "lastName" },
  sitesTable:               { id: "id", name: "name" },
  parentAccountsTable:      { id: "id" },
  pool:                     { connect: vi.fn(), on: vi.fn() },
}));

// Stub drizzle operators — the route imports these to build queries but the
// mock DB never runs real SQL so any placeholder value works.
vi.mock("drizzle-orm", () => ({
  eq:        vi.fn(() => "eq"),
  and:       vi.fn(() => "and"),
  isNotNull: vi.fn(() => "isNotNull"),
  isNull:    vi.fn(() => "isNull"),
  inArray:   vi.fn(() => "inArray"),
  sql:       vi.fn(() => "sql"),
  desc:      vi.fn(() => "desc"),
}));

// Stub the route's non-GET dependencies so they never trigger side-effects.
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [] }) } } },
}));
vi.mock("../lib/notify",       () => ({ createNotification:        vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/logger",       () => ({ logger:                    { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("../lib/email",        () => ({ sendPostNotificationEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/channelMap",   () => ({ isEmailChannelEnabled:     vi.fn().mockResolvedValue(false) }));
vi.mock("../lib/emailBranding",() => ({ getEmailBranding:          vi.fn().mockResolvedValue({}) }));
vi.mock("../lib/appUrl",       () => ({ getAppUrl:                 vi.fn().mockReturnValue("http://localhost") }));

import postsRouter from "./posts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function buildApp(captureErrors = false) {
  const logLines: string[] = [];
  const dest = new Writable({
    write(chunk: Buffer, _e: string, cb: () => void) {
      if (captureErrors) logLines.push(chunk.toString());
      cb();
    },
  });
  const logger = pino({ level: captureErrors ? "trace" : "silent" }, dest);
  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use("/api", postsRouter);
  return { app, logLines };
}

/** Build a minimal post row that passes through enrichment and zod validation. */
function makePostRow(id: number, createdAt: Date = new Date()): Record<string, unknown> {
  return {
    id,
    siteId:        null,
    staffId:       null,
    childIds:      [],
    title:         `Post ${id}`,
    date:          null,
    images:        [],
    documentPaths: [],
    documentNames: [],
    outcomeIds:    [],
    description:   null,
    learning:      null,
    opportunities: null,
    aiSummary:     null,
    publishedAt:   null,
    createdAt,
  };
}

/** Return `n` post rows with descending createdAt (newest-first). */
function makePostRows(n: number, startId = 1): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => makePostRow(startId + i, new Date(Date.now() - i * 1000)));
}

/** Wire up `mockDb.select` so the first call returns `postsChain` and every
 *  subsequent call returns `subChain`.
 *
 *  Important: call mockReset() before setting Once values so any un-consumed
 *  Once values from a previous test (e.g. a test that returned 400 before
 *  hitting the DB) do not stack up and mis-route sub-queries. */
function wireSelectMock() {
  mockDb.select.mockReset();
  mockDb.select
    .mockReturnValue(subChain)
    .mockReturnValueOnce(postsChain);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire all chain methods whose mockReturnValue state is cleared.
  (postsChain.from    as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
  (postsChain.where   as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
  (postsChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
  (postsChain.limit   as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
  (postsChain.offset  as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);

  (subChain.from    as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
  (subChain.where   as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
  (subChain.groupBy as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
  (subChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(subChain);

  // Default: posts query returns empty (overridden per test via setPostsRows).
  setPostsRows([]);
  wireSelectMock();
});

// ---------------------------------------------------------------------------
// Tests — GET /api/posts
// ---------------------------------------------------------------------------

describe("GET /api/posts – pagination", () => {
  it("applies active-child conditions before pagination only when requested", async () => {
    const { app } = buildApp();
    setPostsRows([]);
    const active = await request(app).get("/api/posts?activeChildrenOnly=true&limit=10&offset=0");
    expect(active.status).toBe(200);
    expect(postsChain.where).toHaveBeenCalledTimes(1);
    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(0);
    const predicateText = vi.mocked(sql).mock.calls.map(([chunks]) => [...chunks].join("?")).join(" ");
    expect(predicateText).toContain("cardinality");
    expect(predicateText).toContain("exists");
    expect(predicateText).toContain("'active'");
    expect((await request(app).get("/api/posts?activeChildrenOnly=invalid")).status).toBe(400);
  });
  it("returns 400 for invalid pagination params", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/posts?limit=notanumber");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("with no params returns all posts and applies neither limit() nor offset()", async () => {
    setPostsRows(makePostRows(15));

    const { app, logLines } = buildApp(true);
    const res = await request(app).get("/api/posts");

    if (res.status !== 200) {
      // eslint-disable-next-line no-console
      console.error("ROUTE ERROR LOGS:", logLines.join("\n"));
    }

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(15);

    // Without params, neither limit() nor offset() should be called.
    expect(postsChain.limit).not.toHaveBeenCalled();
    expect(postsChain.offset).not.toHaveBeenCalled();
  });

  it("with limit=10&offset=0 calls .limit(10).offset(0) and returns the first page", async () => {
    setPostsRows(makePostRows(10));

    const { app } = buildApp();
    const res = await request(app).get("/api/posts?limit=10&offset=0");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);

    // Verify the correct SQL clauses were forwarded to the builder.
    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(0);

    // Posts arrive in the order the DB supplied them (newest-first row order).
    const ids = res.body.map((p: { id: number }) => p.id);
    expect(ids[0]).toBe(1);
  });

  it("with limit=10&offset=10 calls .limit(10).offset(10) and returns the second page", async () => {
    // Second page: IDs 11–20
    setPostsRows(makePostRows(10, 11));

    const { app } = buildApp();
    const res = await request(app).get("/api/posts?limit=10&offset=10");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(10);

    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(10);

    // All returned IDs belong to the second page.
    const ids = res.body.map((p: { id: number }) => p.id);
    ids.forEach((id: number) => expect(id).toBeGreaterThanOrEqual(11));
  });

  it("returns fewer than limit rows when on the last page", async () => {
    // Only 3 posts remain after offset=20.
    setPostsRows(makePostRows(3, 21));

    const { app } = buildApp();
    const res = await request(app).get("/api/posts?limit=10&offset=20");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(20);
  });

  it("returns an empty array when no posts exist at the requested offset", async () => {
    setPostsRows([]); // already the default, but explicit for clarity

    const { app } = buildApp();
    const res = await request(app).get("/api/posts?limit=10&offset=100");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("first-page and second-page responses contain completely different post IDs", async () => {
    // Page 1
    setPostsRows(makePostRows(10, 1));
    const { app } = buildApp();
    const res1 = await request(app).get("/api/posts?limit=10&offset=0");
    expect(res1.status).toBe(200);

    // Reset and configure page 2.
    vi.clearAllMocks();
    (postsChain.from    as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.limit   as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.offset  as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (subChain.from    as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    (subChain.where   as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    (subChain.groupBy as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    (subChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    setPostsRows(makePostRows(10, 11));
    wireSelectMock();

    const res2 = await request(app).get("/api/posts?limit=10&offset=10");
    expect(res2.status).toBe(200);

    const ids1 = new Set(res1.body.map((p: { id: number }) => p.id));
    const ids2 = new Set(res2.body.map((p: { id: number }) => p.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toHaveLength(0);
  });

  it("returns HTTP 500 when the DB throws during the posts query", async () => {
    // Override the postsChain's then to reject (simulates a DB error).
    // We do this by temporarily replacing the `then` property on the chain object.
    const originalThen = postsChain.then;
    (postsChain as any).then = (_resolve: unknown, reject: (e: unknown) => void) =>
      Promise.reject(new Error("DB connection failed")).catch(reject);

    const { app } = buildApp();
    const res = await request(app).get("/api/posts?limit=10&offset=0");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");

    // Restore original then for subsequent tests.
    (postsChain as any).then = originalThen;
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/posts – server-side filters (childId, siteId)
// ---------------------------------------------------------------------------

describe("GET /api/posts – server-side filters", () => {
  it("with childId calls .where() on the query before limit/offset", async () => {
    setPostsRows(makePostRows(5));
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?childId=42&limit=10&offset=0");

    expect(res.status).toBe(200);
    // where() must be called on the postsChain (DB-level filter applied before pagination)
    expect(postsChain.where).toHaveBeenCalled();
    // limit and offset are applied after the where (still paginating over filtered rows)
    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(0);
  });

  it("with siteId calls .where() on the query before limit/offset", async () => {
    setPostsRows(makePostRows(3));
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?siteId=7&limit=10&offset=0");

    expect(res.status).toBe(200);
    expect(postsChain.where).toHaveBeenCalled();
    expect(postsChain.limit).toHaveBeenCalledWith(10);
  });

  it("with both childId and siteId calls .where() combining both conditions", async () => {
    setPostsRows(makePostRows(2));
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?childId=3&siteId=5&limit=10&offset=0");

    expect(res.status).toBe(200);
    // Both filters combined — where() is called once with and(...) wrapping two predicates
    expect(postsChain.where).toHaveBeenCalledTimes(1);
  });

  it("without filters does NOT call .where() on the posts query", async () => {
    setPostsRows(makePostRows(5));
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?limit=10&offset=0");

    expect(res.status).toBe(200);
    expect(postsChain.where).not.toHaveBeenCalled();
  });

  it("returns all DB rows when the DB returns a first page with no matches (empty array)", async () => {
    // Simulates the case where the DB correctly applied the filter and found nothing
    // on page 1 — the route must return [] and NOT apply an extra client-side filter.
    setPostsRows([]);
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?childId=99&limit=10&offset=0");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // where() still called — the DB query ran with the filter
    expect(postsChain.where).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /api/posts – Load more preserves filters, site-change resets
//
// These tests confirm the two core behaviours described in task #86:
//
//   1. "Load more" (offset > 0) while a siteId or childId filter is active
//      still passes the WHERE clause to the DB — the filter is not dropped on
//      subsequent pages.
//
//   2. Switching the site filter (new siteId, offset reset to 0) is treated
//      as a fresh first-page query: .where() is called with the new siteId
//      and .offset(0) is applied, so the client accumulator starts clean.
// ---------------------------------------------------------------------------

describe("GET /api/posts – Load more preserves filters, site-change resets", () => {
  it("second page (offset=10) with siteId still applies .where() and .offset(10)", async () => {
    // Simulate the server returning the second page of posts for site 7.
    setPostsRows(makePostRows(10, 11));
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?siteId=7&limit=10&offset=10");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);

    // The WHERE filter must still be applied even though this is page 2.
    expect(postsChain.where).toHaveBeenCalled();
    // Pagination offsets into the already-filtered result set.
    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(10);
  });

  it("second page (offset=10) with childId still applies .where() and .offset(10)", async () => {
    setPostsRows(makePostRows(5, 11));
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?childId=42&limit=10&offset=10");

    expect(res.status).toBe(200);
    expect(postsChain.where).toHaveBeenCalled();
    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(10);
  });

  it("site-filter change: offset resets to 0 and new siteId filter is applied", async () => {
    // First page for site 7 (simulates the current site selection).
    setPostsRows(makePostRows(10, 1));
    const { app } = buildApp();
    const res1 = await request(app).get("/api/posts?siteId=7&limit=10&offset=0");
    expect(res1.status).toBe(200);
    expect(postsChain.where).toHaveBeenCalled();

    // Re-wire mocks to simulate the site dropdown changing to site 9.
    // The client resets offset to 0, so this is a fresh page-1 request.
    vi.clearAllMocks();
    (postsChain.from    as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.where   as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.limit   as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (postsChain.offset  as ReturnType<typeof vi.fn>).mockReturnValue(postsChain);
    (subChain.from    as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    (subChain.where   as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    (subChain.groupBy as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    (subChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(subChain);
    // New site's posts have different IDs — none overlap with the previous page.
    setPostsRows(makePostRows(10, 101));
    wireSelectMock();

    const res2 = await request(app).get("/api/posts?siteId=9&limit=10&offset=0");
    expect(res2.status).toBe(200);
    expect(res2.body).toHaveLength(10);

    // The new siteId filter must be applied (WHERE clause present).
    expect(postsChain.where).toHaveBeenCalled();
    // Reset to page 1: offset must be 0.
    expect(postsChain.offset).toHaveBeenCalledWith(0);

    // None of the new site's posts overlap with the first site's posts.
    const ids1 = new Set(res1.body.map((p: { id: number }) => p.id));
    const ids2 = res2.body.map((p: { id: number }) => p.id);
    ids2.forEach((id: number) => expect(ids1.has(id)).toBe(false));
  });

  it("site-filter change to 'all sites' (no siteId) resets to offset=0 with no WHERE", async () => {
    // Simulate user switching from a specific site back to "All sites".
    setPostsRows(makePostRows(10, 1));
    const { app } = buildApp();

    // "All sites" means no siteId param — offset reset to 0.
    const res = await request(app).get("/api/posts?limit=10&offset=0");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);

    // No WHERE filter when viewing all sites.
    expect(postsChain.where).not.toHaveBeenCalled();
    expect(postsChain.offset).toHaveBeenCalledWith(0);
  });

  it("Load more after site-filter change: page 2 with new siteId keeps WHERE + correct offset", async () => {
    // After switching to site 9 and loading page 1, the user clicks "Load more".
    // The request must carry both the new siteId AND offset=10.
    setPostsRows(makePostRows(7, 111));
    const { app } = buildApp();

    const res = await request(app).get("/api/posts?siteId=9&limit=10&offset=10");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7); // fewer than PAGE_SIZE → last page

    expect(postsChain.where).toHaveBeenCalled();
    expect(postsChain.limit).toHaveBeenCalledWith(10);
    expect(postsChain.offset).toHaveBeenCalledWith(10);
  });
});
