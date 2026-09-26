import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";

// ---------------------------------------------------------------------------
// Mock @workspace/db *before* importing the router so no real DB is touched.
// vi.hoisted() runs before the vi.mock() factory (which is itself hoisted),
// so variables defined here are safely accessible inside the factory.
// ---------------------------------------------------------------------------

const { chain, mockDb } = vi.hoisted(() => {
  // Build a reusable drizzle-style chain mock.  Each method returns `chain`
  // for fluent chaining; `.where()` and `.returning()` are the async leaves.
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    set: vi.fn(),
    returning: vi.fn(),
    orderBy: vi.fn(),
    values: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  // Default no-op resolutions (overridden per test as needed)
  chain.where.mockResolvedValue([]);
  chain.returning.mockResolvedValue([]);

  const mockDb = {
    select: vi.fn(() => chain),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
  };

  return { chain, mockDb };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  staffQualificationsTable: {
    id: "id",
    archivedAt: "archivedAt",
    staffId: "staffId",
    createdAt: "createdAt",
  },
  qualificationDocumentsTable: {
    id: "id",
    qualificationId: "qualificationId",
    uploadedAt: "uploadedAt",
  },
  pool: {
    connect: vi.fn(),
    on: vi.fn(),
  },
}));

// Import the router *after* the mock is set up.
import qualificationsRouter from "./staff-qualifications";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Express app that wires up pino-http (so `req.log` is set)
 * and mounts the qualifications router under /api.
 *
 * Returns the app and a `getLogs()` helper that returns all JSON log records
 * captured during the request, so tests can assert on structured log fields
 * without relying on spy internals.
 */
function buildTestApp(role?: string, staffId = 1) {
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
  if (role) app.use((req, _res, next) => {
    (req as any).session = { user: { id: staffId, role } };
    next();
  });
  app.use("/api", qualificationsRouter);

  function getLogs(): Record<string, unknown>[] {
    return logLines
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) as Record<string, unknown>; }
        catch { return null; }
      })
      .filter((r): r is Record<string, unknown> => r !== null);
  }

  return { app, getLogs };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/qualifications/:id/archive – DB error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire chain method returns after clearAllMocks resets them.
    chain.from.mockReturnValue(chain);
    chain.set.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.values.mockReturnValue(chain);
    mockDb.select.mockReturnValue(chain);
    mockDb.update.mockReturnValue(chain);
    mockDb.insert.mockReturnValue(chain);
    // Default: DB calls resolve to empty results (overridden per test).
    chain.where.mockResolvedValue([]);
    chain.returning.mockResolvedValue([]);
  });

  it("returns HTTP 500 with a JSON error body when the DB throws on the existence check", async () => {
    // Make the SELECT existence check fail.
    chain.where.mockRejectedValue(new Error("Connection refused"));

    const { app } = buildTestApp();
    const res = await request(app).patch("/api/qualifications/42/archive");

    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  it("returns a JSON body (not an HTML crash page) when the DB throws", async () => {
    chain.where.mockRejectedValue(new Error("DB unavailable"));

    const { app } = buildTestApp();
    const res = await request(app).patch("/api/qualifications/7/archive");

    // Body must be a plain object, not an HTML string.
    expect(res.body).toBeTypeOf("object");
    expect(res.body).not.toBeNull();
    expect(Object.keys(res.body)).toContain("error");
  });

  it("logs the error with qualificationId context when the DB throws", async () => {
    chain.where.mockRejectedValue(new Error("Timeout"));

    const { app, getLogs } = buildTestApp();

    await request(app).patch("/api/qualifications/99/archive");

    // Wait a tick for pino to flush to the destination stream.
    await new Promise((r) => setTimeout(r, 10));

    const logs = getLogs();

    // At least one error-level log record must have been emitted.
    const errorLogs = logs.filter((r) => r["level"] === 50); // pino uses 50 for "error"
    expect(errorLogs.length).toBeGreaterThan(0);

    // One of the error records must carry qualificationId context.
    const logWithId = errorLogs.find(
      (r) => "qualificationId" in r && r["qualificationId"] === 99,
    );
    expect(logWithId).toBeDefined();
  });

  it("returns HTTP 500 when the DB throws during the UPDATE (after a successful existence check)", async () => {
    // SELECT succeeds, returning one row; UPDATE's .where() then fails.
    chain.where
      .mockResolvedValueOnce([{ id: 5, archivedAt: null }])
      .mockRejectedValueOnce(new Error("Disk full"));

    const { app } = buildTestApp();
    const res = await request(app).patch("/api/qualifications/5/archive");

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("Onboarding qualification ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.from.mockReturnValue(chain);
    chain.where.mockResolvedValue([]);
    chain.returning.mockResolvedValue([]);
    chain.orderBy.mockReturnValue(chain);
    chain.values.mockReturnValue(chain);
    mockDb.select.mockReturnValue(chain);
    mockDb.insert.mockReturnValue(chain);
    mockDb.update.mockReturnValue(chain);
  });

  it("does not let onboarding staff add qualifications to their own profile", async () => {
    const { app } = buildTestApp("onboarding");
    const res = await request(app).post("/api/staff/1/qualifications")
      .send({ name: "First Aid", status: "current", staffId: 1 });
    expect(res.status).toBe(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("rejects onboarding edits, archives and deletes even to their own qualifications", async () => {
    const { app } = buildTestApp("onboarding");
    const edit = await request(app).patch("/api/qualifications/42")
      .send({ staffId: 1, name: "First Aid", status: "current" });
    const archive = await request(app).patch("/api/qualifications/42/archive");
    const remove = await request(app).delete("/api/qualifications/42");
    const removeDocument = await request(app).delete("/api/qualification-documents/99");
    expect([edit.status, archive.status, remove.status, removeDocument.status]).toEqual([403, 403, 403, 403]);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});
