import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import pino from "pino";
import pinoHttp from "pino-http";
import { Writable } from "node:stream";

const { mockDb, queueResults, valuesCalls, setCalls, deletedStaffIds } = vi.hoisted(() => {
  let results: unknown[][] = [];
  const valuesCalls: unknown[] = [];
  const setCalls: unknown[] = [];
  const deletedStaffIds: unknown[] = [];

  function query(result: unknown[]) {
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      innerJoin: vi.fn(),
      values: vi.fn(),
      set: vi.fn(),
      returning: vi.fn(),
      onConflictDoNothing: vi.fn(),
      then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockImplementation((predicate: unknown) => {
      if (String(predicate).startsWith("eq(staff_sites.staff_id")) deletedStaffIds.push(predicate);
      return chain;
    });
    chain.orderBy.mockReturnValue(chain);
    chain.innerJoin.mockReturnValue(chain);
    chain.values.mockImplementation((value: unknown) => {
      valuesCalls.push(value);
      return chain;
    });
    chain.set.mockImplementation((value: unknown) => {
      setCalls.push(value);
      return chain;
    });
    chain.returning.mockReturnValue(chain);
    chain.onConflictDoNothing.mockReturnValue(chain);
    return chain;
  }

  const mockDb = {
    select: vi.fn(() => query(results.shift() ?? [])),
    insert: vi.fn(() => query(results.shift() ?? [])),
    update: vi.fn(() => query(results.shift() ?? [])),
    delete: vi.fn(() => query(results.shift() ?? [])),
  };

  return {
    mockDb,
    queueResults(next: unknown[][]) { results = [...next]; },
    valuesCalls,
    setCalls,
    deletedStaffIds,
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  sitesTable: { id: "sites.id", name: "sites.name" },
  staffSitesTable: { staffId: "staff_sites.staff_id", siteId: "staff_sites.site_id" },
  staffTable: {
    id: "staff.id",
    lastName: "staff.last_name",
    isSuperAdmin: "staff.is_super_admin",
  },
}));

vi.mock("drizzle-orm", () => ({
  asc: (column: unknown) => `asc(${String(column)})`,
  eq: (column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`,
  inArray: (column: unknown, values: unknown[]) => `inArray(${String(column)},${values.join(",")})`,
  ne: (column: unknown, value: unknown) => `ne(${String(column)},${String(value)})`,
}));

import staffRouter from "./staff";

function staffMember(id: number, role: string, siteId: number | null = 1) {
  return {
    id,
    firstName: role === "admin_support" ? "Support" : "Ed",
    lastName: "User",
    email: `${role}-${id}@example.com`,
    role,
    qualifications: "",
    status: "active",
    phone: null,
    wwccNumber: null,
    bio: null,
    profilePicturePath: null,
    employmentNotes: null,
    siteId,
    isSuperAdmin: false,
  };
}

function buildApp(role: "admin" | "educator" | "coordinator" | "onboarding" = "admin") {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({
    logger: pino({ level: "silent" }, new Writable({ write(_chunk, _encoding, callback) { callback(); } })),
  }));
  app.use((req, _res, next) => {
    (req as any).session = { user: { id: 1, role } };
    next();
  });
  app.use("/api", staffRouter);
  return app;
}

describe("Admin Support staff boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    valuesCalls.length = 0;
    setCalls.length = 0;
    deletedStaffIds.length = 0;
  });

  it.each(["educator", "coordinator"] as const)("hides Admin Support from the %s staff list", async (role) => {
    const educator = staffMember(10, "educator");
    const support = staffMember(11, "admin_support", null);
    queueResults([[support, educator], []]);

    const response = await request(buildApp(role)).get("/api/staff");

    expect(response.status).toBe(200);
    expect(response.body.map((member: { id: number }) => member.id)).toEqual([educator.id]);
  });

  it.each(["educator", "coordinator"] as const)("returns not found when a %s opens Admin Support", async (role) => {
    queueResults([[staffMember(11, "admin_support", null)]]);

    const response = await request(buildApp(role)).get("/api/staff/11");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Staff member not found" });
  });

  it("clears Home Site and Associated Sites when Admin Support is created", async () => {
    const created = staffMember(11, "admin_support", null);
    queueResults([[created], [], []]);

    const response = await request(buildApp()).post("/api/staff").send({
      firstName: "Support",
      lastName: "User",
      email: "support@example.com",
      role: "admin_support",
      qualifications: "",
      siteId: 7,
      associatedSiteIds: [8, 9],
    });

    expect(response.status).toBe(201);
    expect(valuesCalls[0]).toMatchObject({ role: "admin_support", siteId: null });
    expect(deletedStaffIds).toHaveLength(1);
    expect(response.body).toMatchObject({ siteId: null, associatedSiteIds: [], associatedSites: [] });
  });

  it("clears Home Site and Associated Sites when existing staff becomes Admin Support", async () => {
    const existing = staffMember(12, "educator", 7);
    const updated = staffMember(12, "admin_support", null);
    queueResults([[existing], [updated], [], []]);

    const response = await request(buildApp()).patch("/api/staff/12").send({
      role: "admin_support",
      siteId: 7,
      associatedSiteIds: [8, 9],
    });

    expect(response.status).toBe(200);
    expect(setCalls[0]).toMatchObject({ role: "admin_support", siteId: null });
    expect(deletedStaffIds).toHaveLength(1);
    expect(response.body).toMatchObject({ siteId: null, associatedSiteIds: [], associatedSites: [] });
  });
});

describe("Onboarding staff boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    valuesCalls.length = 0;
    setCalls.length = 0;
    deletedStaffIds.length = 0;
  });

  it("returns only the signed-in staff member from the staff list", async () => {
    const ownProfile = staffMember(1, "onboarding", null);
    const educator = staffMember(10, "educator");
    queueResults([[educator, ownProfile], []]);

    const response = await request(buildApp("onboarding")).get("/api/staff");

    expect(response.status).toBe(200);
    expect(response.body.map((member: { id: number }) => member.id)).toEqual([1]);
  });

  it("does not let onboarding staff open another profile", async () => {
    queueResults([[staffMember(10, "educator")]]);

    const response = await request(buildApp("onboarding")).get("/api/staff/10");

    expect(response.status).toBe(404);
  });

  it("creates onboarding profiles without site assignments", async () => {
    const created = staffMember(11, "onboarding", null);
    queueResults([[created], [], []]);

    const response = await request(buildApp()).post("/api/staff").send({
      firstName: "New",
      lastName: "Starter",
      email: "starter@example.com",
      role: "onboarding",
      qualifications: "",
      siteId: 7,
      associatedSiteIds: [8, 9],
    });

    expect(response.status).toBe(201);
    expect(valuesCalls[0]).toMatchObject({ role: "onboarding", siteId: null });
    expect(deletedStaffIds).toHaveLength(1);
  });
});