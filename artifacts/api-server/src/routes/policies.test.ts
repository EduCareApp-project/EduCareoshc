import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const mocks = vi.hoisted(() => {
  const tables = {
    policiesTable: {
      id: "policies.id", policyNumber: "policies.policyNumber", title: "policies.title",
      category: "policies.category", description: "policies.description", content: "policies.content",
      documentPath: "policies.documentPath", documentName: "policies.documentName",
      fileUrl: "policies.fileUrl", version: "policies.version", versionNumber: "policies.versionNumber",
      lastReviewedAt: "policies.lastReviewedAt", requiresAcknowledgment: "policies.requiresAcknowledgment",
      notifyRoles: "policies.notifyRoles", isActive: "policies.isActive",
      distributionInitialized: "policies.distributionInitialized", createdAt: "policies.createdAt",
      updatedAt: "policies.updatedAt",
    },
    policyDistributionsTable: {
      id: "policyDistributions.id", policyId: "policyDistributions.policyId",
      staffId: "policyDistributions.staffId", createdAt: "policyDistributions.createdAt",
    },
    policyAcknowledgmentsTable: {
      id: "policyAcknowledgments.id", policyId: "policyAcknowledgments.policyId",
      staffId: "policyAcknowledgments.staffId", policyVersion: "policyAcknowledgments.policyVersion",
      acknowledgedAt: "policyAcknowledgments.acknowledgedAt",
    },
    staffTable: {
      id: "staff.id", firstName: "staff.firstName", lastName: "staff.lastName",
      role: "staff.role", status: "staff.status",
    },
  };
  const state = {
    policies: [] as any[],
    distributions: [] as any[],
    acknowledgments: [] as any[],
    staff: [] as any[],
  };
  const notifications = vi.fn().mockResolvedValue(undefined);

  function tableName(table: unknown) {
    return Object.entries(tables).find(([, value]) => value === table)?.[0] ?? "";
  }
  function tableRows(table: unknown) {
    const key = tableName(table);
    const stateKey = key === "policiesTable" ? "policies"
      : key === "policyDistributionsTable" ? "distributions"
        : key === "policyAcknowledgmentsTable" ? "acknowledgments"
          : "staff";
    return state[stateKey as keyof typeof state] as any[];
  }
  function matches(row: any, predicate: any): boolean {
    if (!predicate) return true;
    if (predicate.op === "and") return predicate.args.every((arg: any) => matches(row, arg));
    if (predicate.op === "eq") return row[predicate.column.split(".")[1]] === predicate.value;
    if (predicate.op === "in") return predicate.values.includes(row[predicate.column.split(".")[1]]);
    return true;
  }
  function project(row: any, selection: any) {
    if (!selection) return row;
    return Object.fromEntries(Object.entries(selection).map(([key, column]) => [key, row[(column as string).split(".")[1]]]));
  }
  function chain(resolve: () => any[], selection?: any) {
    let rows: any[] = [];
    const c: any = {
      from(table: unknown) { rows = tableRows(table).map((row) => ({ ...row })); return c; },
      where(predicate: any) { rows = rows.filter((row) => matches(row, predicate)); return c; },
      orderBy() { return c; },
      limit(amount: number) { rows = rows.slice(0, amount); return c; },
      for() { return c; },
      then(resolveFn: (value: any) => any, rejectFn: (reason: any) => any) {
        return Promise.resolve(rows.map((row) => project(row, selection))).then(resolveFn, rejectFn);
      },
      catch(rejectFn: (reason: any) => any) {
        return Promise.resolve(rows.map((row) => project(row, selection))).catch(rejectFn);
      },
    };
    return c;
  }

  const db: any = {
    select: vi.fn((selection?: any) => chain(() => [], selection)),
    insert: vi.fn((table: unknown) => {
      let inserted: any[] = [];
      const c: any = {
        values(values: any) {
          const list = Array.isArray(values) ? values : [values];
          inserted = [];
          const rows = tableRows(table);
          for (const value of list) {
            const duplicate = table === tables.policyDistributionsTable
              && rows.some((row) => row.policyId === value.policyId && row.staffId === value.staffId);
            if (duplicate) continue;
            const row = {
              id: Math.max(0, ...rows.map((existing) => existing.id)) + 1,
              ...(table === tables.policiesTable && {
                createdAt: new Date(), updatedAt: new Date(), versionNumber: 1, isActive: true,
                requiresAcknowledgment: "yes", notifyRoles: null, description: null, content: null,
                documentPath: null, documentName: null, fileUrl: null, version: null,
                policyNumber: null, lastReviewedAt: null,
              }),
              ...(table === tables.policyAcknowledgmentsTable && { acknowledgedAt: new Date() }),
              ...value,
            };
            rows.push(row);
            inserted.push(row);
          }
          return c;
        },
        onConflictDoNothing() { return c; },
        returning() { return Promise.resolve(inserted); },
        then(resolve: (value: any) => any, reject: (reason: any) => any) { return Promise.resolve(inserted).then(resolve, reject); },
      };
      return c;
    }),
    update: vi.fn((table: unknown) => {
      let values: any;
      let rows: any[] = [];
      const c: any = {
        set(update: any) { values = update; return c; },
        where(predicate: any) { rows = tableRows(table).filter((row) => matches(row, predicate)); return c; },
        returning() { rows.forEach((row) => Object.assign(row, values)); return Promise.resolve(rows); },
      };
      return c;
    }),
    delete: vi.fn((table: unknown) => {
      let removed: any[] = [];
      const c: any = {
        where(predicate: any) {
          const rows = tableRows(table);
          removed = rows.filter((row) => matches(row, predicate));
          const remaining = rows.filter((row) => !matches(row, predicate));
          rows.splice(0, rows.length, ...remaining);
          return c;
        },
        then(resolve: (value: any) => any, reject: (reason: any) => any) { return Promise.resolve(removed).then(resolve, reject); },
      };
      return c;
    }),
    transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(db)),
  };
  return { tables, state, db, notifications };
});

vi.mock("@workspace/db", () => ({ db: mocks.db, ...mocks.tables }));
vi.mock("drizzle-orm", () => ({
  and: (...args: any[]) => ({ op: "and", args }),
  desc: (column: string) => column,
  eq: (column: string, value: unknown) => ({ op: "eq", column, value }),
  inArray: (column: string, values: unknown[]) => ({ op: "in", column, values }),
}));
vi.mock("../lib/notify", () => ({ createNotification: mocks.notifications }));
vi.mock("../lib/logger", () => ({ logger: { warn: vi.fn() } }));

import policiesRouter from "./policies";

function buildApp(role = "admin", id = 900) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { error: vi.fn(), warn: vi.fn() };
    req.session = { user: { id, type: "staff", role } };
    next();
  });
  app.use("/api", policiesRouter);
  return app;
}

function makeStaff(id: number, role: string, status = "active") {
  return { id, firstName: `Staff${id}`, lastName: "Member", role, status };
}

function makePolicy(id: number, active = true) {
  const now = new Date();
  return {
    id, policyNumber: id, title: `Policy ${id}`, category: "General", description: null, content: null,
    documentPath: null, documentName: null, fileUrl: null, version: null, versionNumber: 1,
    lastReviewedAt: null, requiresAcknowledgment: "yes", notifyRoles: "educator",
    isActive: active, distributionInitialized: true, createdAt: now, updatedAt: now,
  };
}

beforeEach(() => {
  mocks.state.policies.splice(0);
  mocks.state.distributions.splice(0);
  mocks.state.acknowledgments.splice(0);
  mocks.state.staff.splice(0, mocks.state.staff.length, makeStaff(1, "educator"), makeStaff(2, "coordinator"));
  mocks.notifications.mockClear();
  mocks.db.transaction.mockClear();
});

describe("policy distribution and lifecycle", () => {
  it("snapshots creation recipients and does not add later hires on reads", async () => {
    const response = await request(buildApp()).post("/api/policies").send({
      title: "Safe practice", category: "General", notifyRoles: "educator",
    });
    expect(response.status).toBe(201);
    expect(response.body.distributedStaffIds).toEqual([1]);
    mocks.state.staff.push(makeStaff(3, "educator"));
    const list = await request(buildApp()).get("/api/policies");
    expect(list.status).toBe(200);
    expect(list.body[0].distributedStaffIds).toEqual([1]);
    expect(mocks.notifications).toHaveBeenCalledTimes(1);
  });

  it("adds a recipient idempotently, sends one notification, and denies non-managers", async () => {
    mocks.state.policies.push(makePolicy(5));
    mocks.state.distributions.push({ id: 1, policyId: 5, staffId: 1 });
    const app = buildApp();
    const added = await request(app).post("/api/policies/5/distribution").send({ staffId: 2 });
    expect(added.status).toBe(200);
    expect(added.body.distributedStaffIds).toEqual([1, 2]);
    const duplicate = await request(app).post("/api/policies/5/distribution").send({ staffId: 2 });
    expect(duplicate.status).toBe(200);
    expect(mocks.state.distributions.filter((row) => row.staffId === 2)).toHaveLength(1);
    expect(mocks.notifications).toHaveBeenCalledTimes(1);

    const denied = await request(buildApp("educator")).post("/api/policies/5/distribution").send({ staffId: 2 });
    expect(denied.status).toBe(403);
  });

  it("prevents acknowledgement/distribution while inactive and preserves history across lifecycle and versions", async () => {
    mocks.state.policies.push(makePolicy(7));
    mocks.state.distributions.push({ id: 1, policyId: 7, staffId: 1 });
    mocks.state.acknowledgments.push({
      id: 1, policyId: 7, staffId: 1, policyVersion: 1, acknowledgedAt: new Date("2024-01-01T00:00:00Z"),
    });

    const app = buildApp();
    const deactivate = await request(app).patch("/api/policies/7").send({ isActive: false });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.versionNumber).toBe(1);
    expect(mocks.state.acknowledgments).toHaveLength(1);
    expect((await request(app).post("/api/policies/7/acknowledge").send({ staffId: 1 })).status).toBe(409);
    expect((await request(app).post("/api/policies/7/distribution").send({ staffId: 2 })).status).toBe(409);

    await request(app).patch("/api/policies/7").send({ isActive: true, bumpVersion: true });
    expect(mocks.state.acknowledgments).toHaveLength(1);
    expect(mocks.state.policies[0].versionNumber).toBe(2);
    expect(mocks.notifications).toHaveBeenCalledTimes(1);
    const ack = await request(app).post("/api/policies/7/acknowledge").send({ staffId: 1 });
    expect(ack.status).toBe(201);
    const duplicateAck = await request(app).post("/api/policies/7/acknowledge").send({ staffId: 1 });
    expect(duplicateAck.status).toBe(200);
    expect(mocks.state.acknowledgments).toHaveLength(2);
    expect(mocks.state.acknowledgments.map((row) => row.policyVersion)).toEqual([1, 2]);
    expect((await request(app).get("/api/policies")).body[0].acknowledgedStaffIds).toEqual([1]);
  });

  it("only expands recipients when normalized notifyRoles changes", async () => {
    mocks.state.policies.push(makePolicy(8));
    mocks.state.distributions.push({ id: 1, policyId: 8, staffId: 1 });
    const app = buildApp();
    const spacingOnly = await request(app).patch("/api/policies/8").send({ notifyRoles: " educator, " });
    expect(spacingOnly.status).toBe(200);
    expect(mocks.state.distributions).toHaveLength(1);
    const explicitChange = await request(app).patch("/api/policies/8").send({ notifyRoles: "educator, coordinator" });
    expect(explicitChange.status).toBe(200);
    expect(mocks.state.distributions.map((row) => row.staffId)).toEqual([1, 2]);
  });

  it("does not expand an inactive policy's distribution through a role edit", async () => {
    mocks.state.policies.push(makePolicy(9, false));
    mocks.state.distributions.push({ id: 1, policyId: 9, staffId: 1 });
    const response = await request(buildApp()).patch("/api/policies/9").send({
      notifyRoles: "educator, coordinator",
    });
    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);
    expect(response.body.distributedStaffIds).toEqual([1]);
    expect(mocks.notifications).not.toHaveBeenCalled();
  });
});