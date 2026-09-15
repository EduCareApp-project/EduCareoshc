import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const permissionFields = {
  heading: "Science Centre Visit",
  excursionDate: "2026-10-20",
  description: "Hands-on exhibits and planetarium",
  venue: "Melbourne Science Centre",
  purpose: "Extend the term science program",
  cost: "$18.50",
  departureTime: "08:15 AM",
  arrivalAtVenue: "09:05 AM",
  departureFromVenue: "01:40 PM",
  arrivalTime: "02:35 PM",
  maximumChildren: "32",
  transportMethod: "Chartered bus",
  restraintsFitted: "Lap-sash belts on every seat",
  childToStaffRatio: "1:6",
  staffAttending: "A. Educator, B. Leader, C. First Aid",
  itemsToBring: "Hat, lunch, water bottle",
  otherInformation: "Children must wear the service polo",
  medicalAuthorisationText: "I authorise emergency medical treatment.",
};

const updatedPermissionFields = {
  ...permissionFields,
  heading: "Updated Science Centre Visit",
  excursionDate: "2026-10-21",
  description: "Updated internal description",
  venue: "Updated Discovery Centre",
  purpose: "Updated learning purpose",
  cost: "$20.00",
  departureTime: "08:25 AM",
  arrivalAtVenue: "09:15 AM",
  departureFromVenue: "01:50 PM",
  arrivalTime: "02:45 PM",
  maximumChildren: "30",
  transportMethod: "Two chartered buses",
  restraintsFitted: "Approved restraints on every seat",
  childToStaffRatio: "1:5",
  staffAttending: "D. Director, E. Educator",
  itemsToBring: "Hat, packed lunch, raincoat",
  otherInformation: "Updated family information",
  medicalAuthorisationText: "Updated emergency medical authority.",
};

function responseFields(fields: typeof permissionFields) {
  return { ...fields, excursionDate: `${fields.excursionDate}T00:00:00.000Z` };
}

const { mockDb, state, tables } = vi.hoisted(() => {
  const tables = {
    childrenTable: { name: "children", siteId: "siteId", guardianEmail: "guardianEmail", guardian2Email: "guardian2Email" },
    parentAccountsTable: { name: "parents" },
    excursionsTable: { name: "excursions", id: "id", siteId: "siteId", status: "status", excursionDate: "excursionDate", createdAt: "createdAt" },
    excursionRecipientsTable: { name: "recipients", id: "id", excursionId: "excursionId", guardianEmail: "guardianEmail", childNameSnapshot: "childNameSnapshot", decision: "decision", createdAt: "createdAt" },
    excursionResponseLogsTable: { name: "logs", excursionId: "excursionId", recipientId: "recipientId", guardianEmail: "guardianEmail", createdAt: "createdAt" },
    excursionRiskAssessmentUploadsTable: { name: "uploads", id: "id", objectPath: "objectPath", claimedExcursionId: "claimedExcursionId" },
    guardianNotificationsTable: { name: "notifications", guardianEmail: "guardianEmail", createdAt: "createdAt", dedupeKey: "dedupeKey" },
  };
  const state = { excursion: null as any, recipient: null as any };

  function rowsFor(table: any, selection?: any) {
    if (selection?.excursion && selection?.recipient && state.excursion && state.recipient) {
      return [{ excursion: state.excursion, recipient: state.recipient }];
    }
    switch (table?.name) {
      case "excursions": return state.excursion ? [state.excursion] : [];
      case "recipients": return state.recipient ? [state.recipient] : [];
      case "logs": return [];
      case "children": return [];
      case "parents": return [];
      default: return [];
    }
  }

  function select(selection?: any) {
    let table: any;
    const chain: any = {
      from(value: any) { table = value; return chain; },
      innerJoin() { return chain; },
      where() { return chain; },
      orderBy() { return chain; },
      limit() { return chain; },
      then(resolve: any, reject: any) { return Promise.resolve(rowsFor(table, selection)).then(resolve, reject); },
    };
    return chain;
  }

  function insert(table: any) {
    let values: any;
    const chain: any = {
      values(value: any) {
        values = value;
        if (table.name === "excursions") {
          const now = new Date("2026-09-15T00:00:00.000Z");
          state.excursion = {
            id: 41, status: "draft", riskAssessmentPath: null, riskAssessmentName: null,
            sentAt: null, completedAt: null, createdAt: now, updatedAt: now,
            description: "", venue: "", purpose: "", cost: "", departureTime: "",
            arrivalTime: "", arrivalAtVenue: "", departureFromVenue: "", maximumChildren: "",
            transportMethod: "", restraintsFitted: "", childToStaffRatio: "", staffAttending: "",
            itemsToBring: "", otherInformation: "", medicalAuthorisationText: "",
            ...value,
          };
        }
        return chain;
      },
      onConflictDoNothing() { return chain; },
      returning() {
        if (table.name === "excursions") return Promise.resolve([state.excursion]);
        return Promise.resolve(values ? [values] : []);
      },
      then(resolve: any, reject: any) { return Promise.resolve([]).then(resolve, reject); },
    };
    return chain;
  }

  function update(table: any) {
    let values: any;
    const chain: any = {
      set(value: any) { values = value; return chain; },
      where() { return chain; },
      returning() {
        if (table.name === "excursions") {
          state.excursion = { ...state.excursion, ...values };
          return Promise.resolve([state.excursion]);
        }
        return Promise.resolve([]);
      },
    };
    return chain;
  }

  const mockDb: any = {
    select: vi.fn(select),
    insert: vi.fn(insert),
    update: vi.fn(update),
    transaction: vi.fn(async (callback: any) => callback(mockDb)),
  };
  return { mockDb, state, tables };
});

vi.mock("@workspace/db", () => ({ db: mockDb, ...tables }));
vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {},
  ObjectNotFoundError: class extends Error {},
}));
vi.mock("../lib/email", () => ({ sendGuardianExcursionEmail: vi.fn() }));
vi.mock("../lib/emailBranding", () => ({ getEmailBranding: vi.fn() }));
vi.mock("../lib/channelMap", () => ({ isEmailChannelEnabled: vi.fn().mockResolvedValue(false) }));
vi.mock("../lib/appUrl", () => ({ getAppUrl: () => "http://localhost" }));

import excursionsRouter from "./excursions";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { error: vi.fn(), warn: vi.fn() };
    req.session = req.header("x-user") === "guardian"
      ? { user: { id: 9, type: "guardian", role: "guardian", email: "guardian@example.com", name: "Guardian" } }
      : { user: { id: 7, type: "staff", role: "admin", email: "admin@example.com", name: "Admin", siteId: null } };
    next();
  });
  app.use("/api", excursionsRouter);
  return app;
}

beforeEach(() => {
  state.excursion = null;
  state.recipient = null;
  vi.clearAllMocks();
});

describe("excursion permission-form field round trip", () => {
  it("preserves every field through create, staff detail, and update", async () => {
    const app = buildApp();
    const created = await request(app).post("/api/excursions").send({ siteId: 3, ...permissionFields });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject(responseFields(permissionFields));

    const staffDetail = await request(app).get("/api/excursions/41");
    expect(staffDetail.status).toBe(200);
    expect(staffDetail.body).toMatchObject(responseFields(permissionFields));

    const updated = await request(app).patch("/api/excursions/41").send(updatedPermissionFields);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject(responseFields(updatedPermissionFields));

    const editedDetail = await request(app).get("/api/excursions/41");
    expect(editedDetail.status).toBe(200);
    expect(editedDetail.body).toMatchObject(responseFields(updatedPermissionFields));
  });

  it("returns the exact updated permission fields in guardian detail", async () => {
    const app = buildApp();
    await request(app).post("/api/excursions").send({ siteId: 3, ...permissionFields });
    await request(app).patch("/api/excursions/41").send(updatedPermissionFields);
    state.excursion = { ...state.excursion, status: "sent", sentAt: new Date("2026-09-15T01:00:00.000Z") };
    state.recipient = {
      id: 55, excursionId: 41, guardianEmail: "guardian@example.com", guardianId: 9,
      guardianNameSnapshot: "Guardian", childId: 12, childNameSnapshot: "Sam Student",
      viewedAt: null, acknowledgedAt: null, decision: null, createdAt: new Date("2026-09-15T01:00:00.000Z"),
    };

    const response = await request(app)
      .get("/api/guardian/excursions/41/recipients/55")
      .set("x-user", "guardian");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(responseFields(updatedPermissionFields));
  });
});