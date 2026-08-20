import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import request from "supertest";
import { Writable } from "node:stream";

const { mockDb, selectChain, setRows } = vi.hoisted(() => {
  let rows: unknown[] = [];
  const selectChain = {
    from: vi.fn(),
    where: vi.fn(),
    then(resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(rows).then(resolve, reject);
    },
    catch(reject: (reason: unknown) => unknown) {
      return Promise.resolve(rows).catch(reject);
    },
  };
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  return {
    mockDb: { select: vi.fn(() => selectChain) },
    selectChain,
    setRows: (nextRows: unknown[]) => { rows = nextRows; },
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  childrenTable: {
    id: "id",
    firstName: "firstName",
    lastName: "lastName",
    hasMedicalCondition: "hasMedicalCondition",
    medicalRiskPlan: "medicalRiskPlan",
    communicationPlan: "communicationPlan",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`),
  asc: vi.fn((column: unknown) => `asc(${String(column)})`),
  inArray: vi.fn(() => "inArray"),
}));

import childrenRouter from "./children";

function buildApp(user: { type: "staff" | "guardian"; id: number; role?: string }) {
  const app = express();
  app.use(pinoHttp({ logger: pino({ level: "silent" }, new Writable({ write(_chunk, _encoding, done) { done(); } })) }));
  app.use((req, _res, next) => {
    (req as any).session = { user };
    next();
  });
  app.use("/api", childrenRouter);
  return app;
}

describe("GET /api/children/:id/medical-plans/print", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectChain.from.mockReturnValue(selectChain);
    selectChain.where.mockReturnValue(selectChain);
    setRows([]);
  });

  it("rejects guardian sessions before querying any child data", async () => {
    const response = await request(buildApp({ type: "guardian", id: 44 }))
      .get("/api/children/4/medical-plans/print");

    expect(response.status).toBe(403);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns only medical print data for staff sessions", async () => {
    setRows([{
      id: 4,
      firstName: "Hayden",
      lastName: "Barber",
      hasMedicalCondition: true,
      medicalRiskPlan: { planLastChecked: "2026-08-01", planSignedBy: "Jack", conditions: [] },
      communicationPlan: { grade: "Grade 1", communications: [] },
    }]);

    const response = await request(buildApp({ type: "staff", id: 1, role: "admin" }))
      .get("/api/children/4/medical-plans/print");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 4,
      firstName: "Hayden",
      lastName: "Barber",
      hasMedicalCondition: true,
      medicalRiskPlan: { planLastChecked: "2026-08-01", planSignedBy: "Jack", conditions: [] },
      communicationPlan: { grade: "Grade 1", communications: [] },
    });
  });
});