import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import pino from "pino";
import pinoHttp from "pino-http";
import { Writable } from "node:stream";

const { mockDb, queueResults, whereCalls } = vi.hoisted(() => {
  let results: unknown[][] = [];
  const whereCalls: unknown[] = [];

  function query(result: unknown[]) {
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      limit: vi.fn(),
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockImplementation((predicate: unknown) => {
      whereCalls.push(predicate);
      return chain;
    });
    chain.limit.mockReturnValue(chain);
    return chain;
  }

  return {
    mockDb: { select: vi.fn(() => query(results.shift() ?? [])) },
    queueResults(next: unknown[][]) { results = [...next]; },
    whereCalls,
  };
});


vi.mock("@workspace/db", () => ({
  db: mockDb,
  childrenTable: {},
  staffTable: { status: "staff.status", isSuperAdmin: "staff.is_super_admin", role: "staff.role" },
  observationsTable: {},
  outcomesTable: {},
  evacuationsTable: {},
  incidentsTable: {},
  conditionReportsTable: {},
  qipItemsTable: {},
  checklistRoutinesTable: {},
  professionalDevelopmentTable: {},
  staffQualificationsTable: {},
  postsTable: {},
  organisationTable: { featureSettings: "organisation.feature_settings" },
  sitesTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...predicates: unknown[]) => `and(${predicates.join(",")})`,
  eq: (column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`,
  ne: (column: unknown, value: unknown) => `ne(${String(column)},${String(value)})`,
}));

vi.mock("../lib/serviceCompliance", () => ({ buildEmergencyStatuses: vi.fn(() => []) }));

import reportsRouter from "./reports";

function buildApp() {
  const app = express();
  app.use(pinoHttp({
    logger: pino({ level: "silent" }, new Writable({ write(_chunk, _encoding, callback) { callback(); } })),
  }));
  app.use("/api", reportsRouter);
  return app;
}

describe("GET /api/reports/staff-compliance Admin Support boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
  });

  it("excludes Admin Support staff and their expiring qualifications", async () => {
    const educator = {
      id: 10,
      firstName: "Ed",
      lastName: "User",
      role: "educator",
      wwccNumber: null,
    };
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const expiryDate = futureDate.toISOString().split("T")[0];
    queueResults([
      [educator],
      [],
      [
        { id: 100, staffId: educator.id, name: "First Aid", status: "current", expiryDate, archivedAt: null },
        { id: 101, staffId: 11, name: "First Aid", status: "current", expiryDate, archivedAt: null },
      ],
      [{ featureSettings: {} }],
    ]);

    const response = await request(buildApp()).get("/api/reports/staff-compliance");

    expect(response.status).toBe(200);
    expect(response.body.staff.map((member: { staffId: number }) => member.staffId)).toEqual([educator.id]);
    expect(response.body.expiringQualifications.map((qualification: { staffId: number }) => qualification.staffId))
      .toEqual([educator.id]);
    expect(whereCalls.map(String)).toContain(
      "and(eq(staff.status,active),ne(staff.is_super_admin,true),ne(staff.role,admin_support),ne(staff.role,onboarding))",
    );
  });
});

describe("GET /api/reports/qualification-check Admin Support boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls.length = 0;
  });

  it("excludes Admin Support from both qualification result lists", async () => {
    const qualifiedEducator = {
      id: 20,
      firstName: "Qualified",
      lastName: "Educator",
      role: "educator",
    };
    const missingEducator = {
      id: 21,
      firstName: "Missing",
      lastName: "Educator",
      role: "educator",
    };
    const adminSupport = {
      id: 22,
      firstName: "Admin",
      lastName: "Support",
      role: "admin_support",
    };
    const expiryDate = "2099-12-31";

    queueResults([
      [qualifiedEducator, missingEducator],
      [
        {
          id: 200,
          staffId: qualifiedEducator.id,
          name: "First Aid",
          status: "current",
          expiryDate,
          archivedAt: null,
        },
        {
          id: 201,
          staffId: adminSupport.id,
          name: "First Aid",
          status: "current",
          expiryDate,
          archivedAt: null,
        },
      ],
    ]);

    const response = await request(buildApp())
      .get("/api/reports/qualification-check")
      .query({ name: "First Aid" });

    expect(response.status).toBe(200);
    expect(response.body.have.map((member: { staffId: number }) => member.staffId))
      .toEqual([qualifiedEducator.id]);
    expect(response.body.missing.map((member: { staffId: number }) => member.staffId))
      .toEqual([missingEducator.id]);
    expect(response.body.have).not.toContainEqual(
      expect.objectContaining({ staffId: adminSupport.id }),
    );
    expect(response.body.missing).not.toContainEqual(
      expect.objectContaining({ staffId: adminSupport.id }),
    );
    expect(whereCalls.map(String)).toContain(
      "and(eq(staff.status,active),ne(staff.is_super_admin,true),ne(staff.role,admin_support),ne(staff.role,onboarding))",
    );
  });
});