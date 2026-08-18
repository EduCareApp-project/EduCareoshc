import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";

// ---------------------------------------------------------------------------
// vi.hoisted() — all mock primitives must be created here so they are
// available inside vi.mock() factory functions (which are hoisted before
// normal module-scope code runs).
// ---------------------------------------------------------------------------

const { chain, mockDb, mockGetObjectEntityFile, mockDownloadObject } = vi.hoisted(() => {
  // One shared drizzle-style chain for all DB calls.  The route makes two
  // sequential queries:
  //   Q1: db.select().from(fileLibraryTable).where(...).limit(1)   ← terminal = limit
  //   Q2: db.select().from(fileCategoriesTable).where(...)          ← terminal = where
  //
  // To drive both, each test queues the right "once" values in call order.
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  // Defaults — overridden per test via mockReturnValueOnce / mockResolvedValueOnce.
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue([]);

  const mockDb = { select: vi.fn(() => chain) };
  const mockGetObjectEntityFile = vi.fn();
  const mockDownloadObject = vi.fn();

  return { chain, mockDb, mockGetObjectEntityFile, mockDownloadObject };
});

// ---------------------------------------------------------------------------
// Mocks — registered before any module imports.
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => ({
  db: mockDb,
  fileLibraryTable: {
    id: "id",
    documentPath: "documentPath",
    categoryId: "categoryId",
    siteId: "siteId",
    name: "name",
    documentName: "documentName",
    position: "position",
    createdAt: "createdAt",
  },
  fileCategoriesTable: { id: "id", name: "name", sortOrder: "sortOrder" },
  sitesTable: { id: "id", name: "name" },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
      Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
    }
  }

  class ObjectStorageService {
    // Delegate to hoisted spies so tests can control behaviour.
    getObjectEntityFile(...args: unknown[]) { return mockGetObjectEntityFile(...args); }
    downloadObject(...args: unknown[]) { return mockDownloadObject(...args); }
  }

  return { ObjectStorageService, ObjectNotFoundError };
});

// Import the router only after mocks are in place.
import serviceDocsRouter from "./service-docs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTestApp() {
  const logLines: string[] = [];
  const dest = new Writable({
    write(chunk: Buffer, _enc: string, cb: () => void) {
      logLines.push(chunk.toString().trim());
      cb();
    },
  });

  const logger = pino({ level: "trace" }, dest);
  const app = express();
  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use("/api", serviceDocsRouter);

  function getLogs(): Record<string, unknown>[] {
    return logLines
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; } })
      .filter((r): r is Record<string, unknown> => r !== null);
  }

  return { app, getLogs };
}

/**
 * Configure the shared chain so Q1 (file lookup) and Q2 (category lookup)
 * return the provided values.
 *
 * Drizzle call order:
 *   Q1: db.select → .from → .where (→ chain) → .limit (resolves: fileRows)
 *   Q2: db.select → .from → .where (resolves: catRows)
 *
 * We queue mocks in that call order using *Once variants, which take priority
 * over the standing mockReturnValue(chain) / mockResolvedValue([]) defaults.
 */
function setupDbMocks(
  fileRows: object[],
  catRows: object[],
) {
  // Q1: first .where() call must return chain so .limit() can be chained.
  chain.where.mockReturnValueOnce(chain);
  // Q1: .limit() resolves with the file rows.
  chain.limit.mockResolvedValueOnce(fileRows);
  // Q2: second .where() call resolves directly with category rows.
  chain.where.mockResolvedValueOnce(catRows);
}

// Shared fixture data — file belongs to public category id 10.
const PUBLIC_FILE_ROW = { documentPath: "/objects/uploads/some-uuid", categoryId: 10 };
const PUBLIC_CAT_ROW = { id: 10 };
// A private category that is NOT in the public allow-list.
const PRIVATE_FILE_ROW = { documentPath: "/objects/uploads/private", categoryId: 99 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/service-docs/public/file/:id — missing file in storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire chain defaults after clearAllMocks resets all spies.
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockResolvedValue([]);
    mockDb.select.mockReturnValue(chain);
  });

  // ── Input validation ────────────────────────────────────────────────────

  it("returns HTTP 400 for a non-numeric file id", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/api/service-docs/public/file/not-a-number");

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveProperty("error");
  });

  // ── DB-level 404 ────────────────────────────────────────────────────────

  it("returns HTTP 404 with JSON when the file row does not exist in the DB", async () => {
    // Q1 resolves with nothing (file doesn't exist).
    chain.where.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([]);

    const { app } = buildTestApp();
    const res = await request(app).get("/api/service-docs/public/file/99");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveProperty("error");
  });

  // ── Authorization ───────────────────────────────────────────────────────

  it("returns HTTP 403 when the file belongs to a non-public category", async () => {
    // File exists but category 99 is not in the public allow-list.
    setupDbMocks([PRIVATE_FILE_ROW], [PUBLIC_CAT_ROW]);

    const { app } = buildTestApp();
    const res = await request(app).get("/api/service-docs/public/file/1");

    expect(res.status).toBe(403);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveProperty("error");
  });

  // ── Missing-file-in-storage (main scenario for this task) ───────────────

  it("returns HTTP 404 with a JSON error body when the storage object is missing (ObjectNotFoundError)", async () => {
    setupDbMocks([PUBLIC_FILE_ROW], [PUBLIC_CAT_ROW]);

    const { ObjectNotFoundError } = await import("../lib/objectStorage");
    mockGetObjectEntityFile.mockRejectedValueOnce(new ObjectNotFoundError());

    const { app } = buildTestApp();
    const res = await request(app).get("/api/service-docs/public/file/1");

    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  it("does NOT return HTTP 500 when the storage object is missing (ObjectNotFoundError must map to 404)", async () => {
    setupDbMocks([PUBLIC_FILE_ROW], [PUBLIC_CAT_ROW]);

    const { ObjectNotFoundError } = await import("../lib/objectStorage");
    mockGetObjectEntityFile.mockRejectedValueOnce(new ObjectNotFoundError());

    const { app } = buildTestApp();
    const res = await request(app).get("/api/service-docs/public/file/1");

    expect(res.status).not.toBe(500);
  });

  // ── Generic storage errors ───────────────────────────────────────────────

  it("returns HTTP 500 for unexpected storage errors that are not ObjectNotFoundError", async () => {
    setupDbMocks([PUBLIC_FILE_ROW], [PUBLIC_CAT_ROW]);

    mockGetObjectEntityFile.mockRejectedValueOnce(new Error("Unexpected GCS failure"));

    const { app } = buildTestApp();
    const res = await request(app).get("/api/service-docs/public/file/1");

    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveProperty("error");
  });

  it("logs a structured error with fileId context when an unexpected storage error occurs", async () => {
    setupDbMocks([PUBLIC_FILE_ROW], [PUBLIC_CAT_ROW]);
    mockGetObjectEntityFile.mockRejectedValueOnce(new Error("GCS timeout"));

    const { app, getLogs } = buildTestApp();
    await request(app).get("/api/service-docs/public/file/7");

    // pino encodes error level as numeric 50.
    const errorLogs = getLogs().filter((l) => l["level"] === 50);
    expect(errorLogs.length).toBeGreaterThan(0);
    expect(errorLogs[0]).toHaveProperty("fileId", 7);
  });
});
