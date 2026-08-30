import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import request from "supertest";
import { Writable } from "node:stream";

const { mockDb, tables, setRows, getQueryOperations } = vi.hoisted(() => {
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
      siteId: "children.siteId",
    },
    sites: { id: "sites.id", status: "sites.status" },
  };

  let rows = {
    communications: [] as Record<string, any>[],
    children: [] as Record<string, any>[],
    sites: [] as Record<string, any>[],
  };
  let queryOperations = {
    limits: [] as number[],
    offsets: [] as number[],
    where: [] as string[],
    orderBy: [] as string[][],
  };

  function makeSelectChain(selection?: Record<string, unknown>) {
    let selectedRows: Record<string, any>[] = [];
    let selectedTable: unknown;
    let limitValue: number | null = null;
    let offsetValue = 0;

    function resolveRows() {
      if (selection?.count && selectedTable === tables.communications) {
        return [{ count: selectedRows.length }];
      }
      return selectedRows.slice(offsetValue, limitValue === null ? undefined : offsetValue + limitValue);
    }

    const chain = {
      from: vi.fn((table: unknown) => {
        selectedTable = table;
        if (table === tables.communications) selectedRows = rows.communications;
        if (table === tables.children) selectedRows = rows.children;
        if (table === tables.sites) selectedRows = rows.sites;
        return chain;
      }),
      where: vi.fn((condition: unknown) => {
        const conditionText = String(condition);
        queryOperations.where.push(conditionText);

        if (selectedTable === tables.children) {
          const siteMatch = conditionText.match(/^eq\(children\.siteId,(\d+)\)$/);
          if (siteMatch) {
            selectedRows = selectedRows.filter((child) => child.siteId === Number(siteMatch[1]));
          } else if (conditionText.includes("children.guardianEmail")) {
            selectedRows = selectedRows.filter((child) =>
              [child.guardianEmail, child.guardian2Email].some(
                (email) => email && conditionText.includes(String(email).trim().toLowerCase()),
              ),
            );
          }
        }

        if (
          selectedTable === tables.communications &&
          conditionText.includes("communications.guardianEmail")
        ) {
          selectedRows = selectedRows.filter((communication) =>
            conditionText.includes(communication.guardianEmail.trim().toLowerCase()),
          );
        }

        if (selectedTable === tables.communications) {
          const createdAtBefore = conditionText.match(
            /lt\(communications\.createdAt,([^)]+)\)/,
          )?.[1];
          const sameCreatedAt = conditionText.match(
            /eq\(communications\.createdAt,([^)]+)\)/,
          )?.[1];
          const idBefore = conditionText.match(/lt\(communications\.id,(\d+)\)/)?.[1];
          if (createdAtBefore) {
            const beforeTime = new Date(createdAtBefore).getTime();
            selectedRows = selectedRows.filter((communication) => {
              const communicationTime = communication.createdAt.getTime();
              return communicationTime < beforeTime ||
                (
                  sameCreatedAt &&
                  idBefore &&
                  communicationTime === new Date(sameCreatedAt).getTime() &&
                  communication.id < Number(idBefore)
                );
            });
          }
        }

        return chain;
      }),
      orderBy: vi.fn((...columns: unknown[]) => {
        queryOperations.orderBy.push(columns.map(String));
        if (selectedTable === tables.communications) {
          selectedRows = [...selectedRows].sort((a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id
          );
        }
        return chain;
      }),
      limit: vi.fn((value: number) => {
        limitValue = value;
        queryOperations.limits.push(value);
        return chain;
      }),
      offset: vi.fn((value: number) => {
        offsetValue = value;
        queryOperations.offsets.push(value);
        return chain;
      }),
      then(resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve(resolveRows()).then(resolve, reject);
      },
      catch(reject: (reason: unknown) => unknown) {
        return Promise.resolve(resolveRows()).catch(reject);
      },
    };
    return chain;
  }

  return {
    mockDb: {
      select: vi.fn((selection?: Record<string, unknown>) => makeSelectChain(selection)),
    },
    tables,
    setRows(nextRows: typeof rows) {
      rows = nextRows;
      queryOperations = {
        limits: [],
        offsets: [],
        where: [],
        orderBy: [],
      };
    },
    getQueryOperations: () => queryOperations,
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

vi.mock("drizzle-orm", () => {
  const formatValue = (value: unknown) =>
    value instanceof Date ? value.toISOString() : String(value);
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (result, part, index) =>
          `${result}${part}${index < values.length ? String(values[index]) : ""}`,
        "",
      ),
    {
      join: (values: unknown[], separator: unknown) => values.join(String(separator)),
    },
  );

  return {
    eq: vi.fn((column: unknown, value: unknown) =>
      `eq(${String(column)},${formatValue(value)})`
    ),
    and: vi.fn((...conditions: unknown[]) => `and(${conditions.join(",")})`),
    inArray: vi.fn(() => "inArray"),
    desc: vi.fn((column: unknown) => `desc(${String(column)})`),
    or: vi.fn((...conditions: unknown[]) => `or(${conditions.join(",")})`),
    lt: vi.fn((column: unknown, value: unknown) =>
      `lt(${String(column)},${formatValue(value)})`
    ),
    sql,
  };
});

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
    expect(response.body).toEqual({
      entries: [
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
      ],
      pagination: {
        pageSize: 25,
        hasNextPage: false,
        nextCursor: null,
      },
    });
    expect(getQueryOperations().limits).toEqual([26]);
    expect(getQueryOperations().offsets).toEqual([]);
    expect(getQueryOperations().orderBy[0]).toEqual([
      "desc(communications.createdAt)",
      "desc(communications.id)",
    ]);
  });

  it("uses a stable timestamp-and-id cursor to fetch the next page", async () => {
    const sharedTimestamp = new Date("2026-08-31T05:30:00.000Z");
    setRows({
      communications: [
        {
          id: 2,
          guardianEmail: "newer@example.com",
          note: "Newer entry",
          staffName: "Ava Admin",
          createdAt: sharedTimestamp,
        },
        {
          id: 1,
          guardianEmail: "older@example.com",
          note: "Older entry",
          staffName: "Ava Admin",
          createdAt: sharedTimestamp,
        },
      ],
      children: [
        {
          firstName: "Nora",
          lastName: "Older",
          guardianName: "Older Guardian",
          guardianEmail: "older@example.com",
          guardian2Name: null,
          guardian2Email: null,
          siteId: 1,
        },
      ],
      sites: [{ id: 1, name: "North Site", status: "active" }],
    });

    const firstPage = await request(buildApp(ADMIN_USER))
      .get("/api/guardians/financial/communication-log?pageSize=1");

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.entries).toEqual([
      expect.objectContaining({
        id: 2,
        note: "Newer entry",
      }),
    ]);
    expect(firstPage.body.pagination).toEqual({
      pageSize: 1,
      hasNextPage: true,
      nextCursor: expect.any(String),
    });

    const secondPage = await request(buildApp(ADMIN_USER))
      .get(
        `/api/guardians/financial/communication-log?pageSize=1&cursor=${firstPage.body.pagination.nextCursor}`,
      );

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.pagination).toEqual({
      pageSize: 1,
      hasNextPage: false,
      nextCursor: null,
    });
    expect(secondPage.body.entries).toEqual([
      expect.objectContaining({
        id: 1,
        guardianName: "Older Guardian",
        note: "Older entry",
      }),
    ]);
    expect(getQueryOperations().limits).toEqual([2, 2]);
    expect(getQueryOperations().offsets).toEqual([]);
    expect(
      getQueryOperations().where.some((condition) =>
        condition.includes("lt(communications.id,2)"),
      ),
    ).toBe(true);
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
    expect(response.body.pagination).toEqual({
      pageSize: 25,
      hasNextPage: false,
      nextCursor: null,
    });
    expect(response.body.entries).toHaveLength(1);
    expect(response.body.entries[0]).toMatchObject({
      id: 3,
      guardianName: "Pat Parent",
      childNames: ["Luca Stone"],
      siteNames: ["North Site"],
    });
    expect(getQueryOperations().where).toContain("eq(children.siteId,1)");
    expect(
      getQueryOperations().where.some((condition) =>
        condition.includes("communications.guardianEmail"),
      ),
    ).toBe(true);
  });

  it("rejects invalid pagination parameters before querying communication data", async () => {
    const response = await request(buildApp(ADMIN_USER))
      .get("/api/guardians/financial/communication-log?cursor=invalid&pageSize=101");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Invalid pagination parameters" });
    expect(mockDb.select).not.toHaveBeenCalled();
  });
});