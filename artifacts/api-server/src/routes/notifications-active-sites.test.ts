/**
 * Confirms that the weekly_plan_missing notification computation queries
 * only active sites. Pending sites (e.g. Lumen Christi id=9, Sacred Heart
 * id=10) must not receive "no published plan" notifications — the background
 * computation must iterate over sites with status='active' only.
 *
 * Route covered: the computeDeadlineNotifications() background function
 * triggered by GET /api/notifications.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";

// ---------------------------------------------------------------------------
// Chain factory — each instance resolves to its own data
// ---------------------------------------------------------------------------

function makeChain(resolveData: unknown[]) {
  const c: Record<string, unknown> = {
    from:        vi.fn(),
    where:       vi.fn(),
    orderBy:     vi.fn(),
    limit:       vi.fn(),
    innerJoin:   vi.fn(),
    then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
      return Promise.resolve(resolveData).then(resolve, reject);
    },
    catch(onRej: (e: unknown) => unknown) {
      return Promise.resolve(resolveData).catch(onRej);
    },
  };
  // Default: every fluent method returns the same chain (chaining)
  (c.from      as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.where     as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.orderBy   as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.limit     as ReturnType<typeof vi.fn>).mockReturnValue(c);
  (c.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(c);
  return c;
}

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDb, mockEq } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };
  // Track every eq() call so we can verify the sites-active predicate later
  const mockEq = vi.fn((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`);
  return { mockDb, mockEq };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  notificationsTable:        { id: "id", staffId: "staffId", read: "read", createdAt: "createdAt" },
  notificationSettingsTable: { id: "id", type: "type", enabled: "enabled", advanceDays: "advanceDays", siteId: "siteId" },
  staffTable:                { id: "id", role: "role", status: "status", siteId: "siteId", firstName: "firstName", lastName: "lastName" },
  staffQualificationsTable:  { id: "id", staffId: "staffId", expiryDate: "expiryDate", name: "name" },
  qipItemsTable:             { id: "id", dueDate: "dueDate", archivedAt: "archivedAt", siteId: "siteId" },
  checklistRoutinesTable:    { id: "id", targetDate: "targetDate", siteId: "siteId", staffId: "staffId", title: "title" },
  planningExperiencesTable:  { id: "id", siteId: "siteId", weeklyPlanData: "weeklyPlanData" },
  sitesTable:                { id: "id", status: "status" },
  childMedicationsTable:     { id: "id", expiryDate: "expiryDate", name: "name", childId: "childId" },
  childrenTable:             { id: "id", siteId: "siteId", firstName: "firstName", lastName: "lastName", guardianEmail: "guardianEmail", guardian2Email: "guardian2Email" },
  parentAccountsTable:       { id: "id", guardianEmail: "guardianEmail" },
  emailSendLogTable:         { id: "id", dedupeKey: "dedupeKey" },
  pool: { connect: vi.fn(), on: vi.fn() },
}));

vi.mock("drizzle-orm", () => ({
  eq:        mockEq,
  and:       vi.fn((...args: unknown[]) => `and(${args.join(",")})`),
  desc:      vi.fn((col: unknown) => `desc(${String(col)})`),
  isNull:    vi.fn(() => "isNull"),
  isNotNull: vi.fn(() => "isNotNull"),
  not:       vi.fn((v: unknown) => `not(${String(v)})`),
  lte:       vi.fn(() => "lte"),
  gte:       vi.fn(() => "gte"),
  inArray:   vi.fn(() => "inArray"),
}));

vi.mock("../lib/notify", () => ({
  createNotification:          vi.fn().mockResolvedValue(undefined),
  createNotificationsForRoles: vi.fn().mockResolvedValue(undefined),
  getISOWeek:                  vi.fn(() => "2025-W01"),
  getYearMonth:                vi.fn(() => "2025-01"),
}));

vi.mock("../lib/email", () => ({
  sendMedicationExpiryEmail:         vi.fn().mockResolvedValue({ sent: [] }),
  sendGuardianMedicationExpiryEmail: vi.fn().mockResolvedValue({ sent: [] }),
}));

vi.mock("../lib/emailBranding", () => ({
  getEmailBranding: vi.fn().mockResolvedValue({ name: "Test", logoUrl: null, primaryColor: "#000" }),
}));

vi.mock("../lib/channelMap", () => ({
  isEmailChannelEnabled: vi.fn().mockResolvedValue(false),
  isInAppChannelEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("../lib/appUrl", () => ({
  getAppUrl: vi.fn(() => "http://localhost"),
}));

import notificationsRouter from "./notifications";

// ---------------------------------------------------------------------------
// App factory — injects a minimal session
// ---------------------------------------------------------------------------

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({ logger: pino({ level: "silent" }, new Writable({ write(_c, _e, cb) { cb(); } })) }));
  app.use((req, _res, next) => {
    (req as any).session = { user: { id: 1, type: "staff" } };
    next();
  });
  app.use("/api", notificationsRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/notifications — weekly_plan_missing uses active-only site filter", () => {
  /**
   * Strategy:
   * - Wire db.select() to use a predicate-aware `where` mock:
   *     • Settings queries (type = 'weekly_plan_missing') → enabled: true
   *     • All other settings queries                      → enabled: false
   *     • Sites query (status = 'active')                → 7 active site ids
   *     • Everything else                                → empty array
   * - Verify after the request that eq() was called with ("status", "active"),
   *   proving the sites query was built with the correct predicate.
   */

  const ACTIVE_SITES = [
    { id: 1 }, { id: 2 }, { id: 3 },
    { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore eq mock after clearAllMocks
    mockEq.mockImplementation((_col: unknown, val: unknown) => `eq(${String(_col)},${String(val)})`);

    // A smart select implementation: each call returns a chain whose where()
    // inspects the predicate and resolves to the appropriate data.
    mockDb.select.mockImplementation(() => {
      const chain = makeChain([]);

      (chain.where as ReturnType<typeof vi.fn>).mockImplementation((predicate: unknown) => {
        const p = String(predicate);

        // Notification settings: enable only weekly_plan_missing
        if (p === "eq(type,weekly_plan_missing)") return makeChain([{ enabled: true, advanceDays: 14 }]);
        if (p.startsWith("eq(type,"))            return makeChain([{ enabled: false }]);

        // Sites query with active filter — the assertion target
        if (p === "eq(status,active)")            return makeChain(ACTIVE_SITES);

        // Everything else (plans, staff, notifications list, etc.)
        return makeChain([]);
      });

      // innerJoin returns a chain that also resolves to [] by default
      (chain.innerJoin as ReturnType<typeof vi.fn>).mockReturnValue(makeChain([]));

      return chain;
    });

    // update returns an empty chain (mark-as-read)
    mockDb.update.mockReturnValue(makeChain([]));
  });

  it("returns HTTP 200 from GET /notifications", async () => {
    const res = await request(buildTestApp()).get("/api/notifications");
    expect(res.status).toBe(200);
  });

  it("constructs eq(sitesTable.status, 'active') for the sites query inside the notification computation", async () => {
    await request(buildTestApp()).get("/api/notifications");

    // Allow the background computation to complete before asserting
    await new Promise((r) => setTimeout(r, 100));

    // eq() must have been called with the sites-status active predicate.
    // sitesTable.status = "status" in the mock, so we expect eq("status", "active").
    expect(mockEq).toHaveBeenCalledWith("status", "active");
  });

  it("does not query sites without the active-status WHERE clause in the notification computation", async () => {
    await request(buildTestApp()).get("/api/notifications");
    await new Promise((r) => setTimeout(r, 100));

    // Verify the call was precisely eq("status", "active") — not eq("status", "pending")
    // or eq("status", "closed") — confirming only active sites are iterated.
    const siteStatusCalls = mockEq.mock.calls.filter(
      ([_col, val]: [unknown, unknown]) => String(_col) === "status" && val !== "active",
    );
    expect(siteStatusCalls).toHaveLength(0);
  });
});
