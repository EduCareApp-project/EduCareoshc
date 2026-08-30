import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import request from "supertest";
import { Writable } from "node:stream";

const { mockDb, tables, setRows } = vi.hoisted(() => {
  const tables = {
    financialAccounts: { guardianEmail: "financial.guardianEmail", status: "financial.status" },
    communications: {
      id: "communications.id",
      guardianEmail: "communications.guardianEmail",
      createdAt: "communications.createdAt",
    },
    paymentPlans: {
      id: "paymentPlans.id",
      guardianEmail: "paymentPlans.guardianEmail",
      createdAt: "paymentPlans.createdAt",
    },
    children: {
      guardianEmail: "children.guardianEmail",
      guardian2Email: "children.guardian2Email",
    },
    sites: { id: "sites.id", status: "sites.status" },
  };

  let rows = {
    communications: [] as unknown[],
    children: [] as unknown[],
    sites: [] as unknown[],
  };

  function makeSelectChain() {
    let selectedRows: unknown[] = [];
    const chain = {
      from: vi.fn((table: unknown) => {
        if (table === tables.communications) selectedRows = rows.communications;
        if (table === tables.children) selectedRows = rows.children;
        if (table === tables.sites) selectedRows = rows.sites;
        return chain;
      }),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      then(resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve(selectedRows).then(resolve, reject);
      },
      catch(reject: (reason: unknown) => unknown) {
        return Promise.resolve(selectedRows).catch(reject);
      },
    };
    return chain;
  }

  return {
    mockDb: {
      select: vi.fn(() => makeSelectChain()),
    },
    tables,
    setRows(nextRows: typeof rows) {
      rows = nextRows;
    },
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  guardianFinancialAccountsTable: tables.financialAccounts,
  guardianCommunicationLogsTable: tables.communications,
  guardianPaymentPlansTable: tables.paymentPlans,
  childrenTable: tables.children,
  sitesTable: tables.sites,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`),
  and: vi.fn((...conditions: unknown[]) => `and(${conditions.join(",")})`),
  inArray: vi.fn(() => "inArray"),
  desc: vi.fn((column: unknown) => `desc(${String(column)})`),
}));

import guardianFinancialRouter from "./guardian-financial";

type TestUser = {
  id: number;
  type: "staff" | "guardian";
  role: string;
  email: string;
  name: string;
};

function buildApp(user: TestUser) {
  const app = express();
  app.use(express.json());
  app.use(
    pinoHttp({
      logger: pino({
        level: "silent",
      }, new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      })),
    }),
  );
  app.use((req, _res, next) => {
    (req as any).session = { user };
    next();
  });
  app.use("/api", guardianFinancialRouter);
  return app;
}

const ADMIN_USER: TestUser = {
  id: 1,
  type: "staff",
  role: "admin",
  email: "admin@example.com",
  name: "Admin User",
};

describe("GET /api/guardians/financial/communication-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRows({
      communications: [],
      children: [],
      sites: [],
    });
  });

  it("rejects non-admin staff before querying communication data", async () => {
    const response = await request(buildApp({
      ...ADMIN_USER,
      role: "educational_leader",
    })).get("/api/guardians/financial/communication-log");

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "Admin access required" });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns newest-first entries with guardian, child, site, staff, and note details", async () => {
    setRows({
      communications: [
        {
          id: 2,
          guardianEmail: "PARENT@example.com",
          note: "Called guardian.\nPayment date confirmed.",
          staffName: "Ava Admin",
          createdAt: new Date("2026-08-31T05:30:00.000Z"),
        },
        {
          id: 1,
          guardianEmail: "other@example.com",
          note: "Sent account statement.",
          staffName: null,
          createdAt: new Date("2026-08-30T04:00:00.000Z"),
        },
      ],
      children: [
        {
          firstName: "Luca",
          lastName: "Stone",
          guardianName: "Pat Parent",
          guardianEmail: "parent@example.com",
          guardian2Name: null,
          guardian2Email: null,
          siteId: 1,
        },
        {
          firstName: "Mia",
          lastName: "Jones",
          guardianName: "Other Guardian",
          guardianEmail: "other@example.com",
          guardian2Name: null,
          guardian2Email: null,
          siteId: 2,
        },
      ],
      sites: [
        { id: 1, name: "North Site", status: "active" },
        { id: 2, name: "South Site", status: "active" },
      ],
    });

    const response = await request(buildApp(ADMIN_USER))
      .get("/api/guardians/financial/communication-log");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 2,
        guardianEmail: "PARENT@example.com",
        guardianName: "Pat Parent",
        childNames: ["Luca Stone"],
        siteNames: ["North Site"],
        note: "Called guardian.\nPayment date confirmed.",
        staffName: "Ava Admin",
        createdAt: "2026-08-31T05:30:00.000Z",
      },
      {
        id: 1,
        guardianEmail: "other@example.com",
        guardianName: "Other Guardian",
        childNames: ["Mia Jones"],
        siteNames: ["South Site"],
        note: "Sent account statement.",
        staffName: null,
        createdAt: "2026-08-30T04:00:00.000Z",
      },
    ]);
  });

  it("filters entries and child context to the selected site", async () => {
    setRows({
      communications: [
        {
          id: 3,
          guardianEmail: "parent@example.com",
          note: "Parent communication",
          staffName: "Ava Admin",
          createdAt: new Date("2026-08-31T05:30:00.000Z"),
        },
        {
          id: 2,
          guardianEmail: "south-only@example.com",
          note: "South-only communication",
          staffName: "Ava Admin",
          createdAt: new Date("2026-08-31T04:30:00.000Z"),
        },
      ],
      children: [
        {
          firstName: "Luca",
          lastName: "Stone",
          guardianName: "Pat Parent",
          guardianEmail: "parent@example.com",
          guardian2Name: null,
          guardian2Email: null,
          siteId: 1,
        },
        {
          firstName: "Zoe",
          lastName: "Stone",
          guardianName: "Pat Parent",
          guardianEmail: "parent@example.com",
          guardian2Name: null,
          guardian2Email: null,
          siteId: 2,
        },
        {
          firstName: "Mia",
          lastName: "Jones",
          guardianName: "Sam South",
          guardianEmail: "south-only@example.com",
          guardian2Name: null,
          guardian2Email: null,
          siteId: 2,
        },
      ],
      sites: [
        { id: 1, name: "North Site", status: "active" },
        { id: 2, name: "South Site", status: "active" },
      ],
    });

    const response = await request(buildApp(ADMIN_USER))
      .get("/api/guardians/financial/communication-log?siteId=1");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: 3,
      guardianName: "Pat Parent",
      childNames: ["Luca Stone"],
      siteNames: ["North Site"],
    });
  });
});