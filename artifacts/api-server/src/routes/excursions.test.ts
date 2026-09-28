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
    childrenTable: { name: "children", siteId: "siteId", status: "status", guardianEmail: "guardianEmail", guardian2Email: "guardian2Email" },
    parentAccountsTable: { name: "parents" },
    excursionsTable: { name: "excursions", id: "id", siteId: "siteId", status: "status", excursionDate: "excursionDate", createdAt: "createdAt" },
    excursionRecipientsTable: { name: "recipients", id: "id", excursionId: "excursionId", guardianEmail: "guardianEmail", childNameSnapshot: "childNameSnapshot", hiddenFromGuardianAt: "hiddenFromGuardianAt", viewedAt: "viewedAt", acknowledgedAt: "acknowledgedAt", decision: "decision", createdAt: "createdAt" },
    excursionResponseLogsTable: { name: "logs", excursionId: "excursionId", recipientId: "recipientId", guardianEmail: "guardianEmail", event: "event", createdAt: "createdAt" },
    excursionRiskAssessmentUploadsTable: { name: "uploads", id: "id", objectPath: "objectPath", claimedExcursionId: "claimedExcursionId" },
    guardianNotificationsTable: { name: "notifications", guardianEmail: "guardianEmail", createdAt: "createdAt", dedupeKey: "dedupeKey" },
  };
  const state = {
    excursion: null as any,
    recipient: null as any,
    logs: [] as any[],
    children: [] as any[],
    parentAccounts: [] as any[],
    notifications: [] as any[],
  };

  function rowsFor(table: any, selection?: any) {
    if (selection?.excursion && selection?.recipient && state.excursion && state.recipient) {
      return [{ excursion: state.excursion, recipient: state.recipient }];
    }
    switch (table?.name) {
      case "excursions": return state.excursion ? [state.excursion] : [];
      case "recipients": return state.recipient ? [state.recipient] : [];
      case "logs": return state.logs;
      case "children": return state.children;
      case "parents": return state.parentAccounts;
      case "notifications": return state.notifications;
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
        if (table.name === "logs") {
          const rows = Array.isArray(value) ? value : [value];
          state.logs.push(...rows.map((row, index) => ({
            id: state.logs.length + index + 1,
            metadata: null,
            createdAt: new Date(`2026-09-15T0${state.logs.length + index + 2}:00:00.000Z`),
            ...row,
          })));
        }
        if (table.name === "notifications" && !state.notifications.some((row) => row.dedupeKey === value.dedupeKey)) {
          state.notifications.push({ id: state.notifications.length + 1, ...value });
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
    let milestoneUpdate = false;
    const chain: any = {
      set(value: any) {
        values = value;
        const keys = Object.keys(value);
        milestoneUpdate = keys.length === 1 && (keys[0] === "viewedAt" || keys[0] === "acknowledgedAt");
        return chain;
      },
      where() {
        if (table.name === "recipients" && !milestoneUpdate) {
          state.recipient = { ...state.recipient, ...values };
        }
        return chain;
      },
      returning() {
        if (table.name === "excursions") {
          state.excursion = { ...state.excursion, ...values };
          return Promise.resolve([state.excursion]);
        }
        if (table.name === "recipients") {
          if (milestoneUpdate) {
            const timestamp = Object.keys(values)[0];
            if (state.recipient[timestamp] !== null) return Promise.resolve([]);
          }
          state.recipient = { ...state.recipient, ...values };
          return Promise.resolve([state.recipient]);
        }
        return Promise.resolve([]);
      },
    };
    return chain;
  }

  function deleteRows(table: any) {
    const chain: any = {
      where() {
        if (table.name === "notifications") state.notifications = [];
        if (table.name === "recipients") state.recipient = null;
        return Promise.resolve();
      },
    };
    return chain;
  }

  const mockDb: any = {
    select: vi.fn(select),
    insert: vi.fn(insert),
    update: vi.fn(update),
    delete: vi.fn(deleteRows),
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
      : {
          user: {
            id: 7,
            type: "staff",
            role: req.header("x-role") ?? "admin",
            email: "admin@example.com",
            name: "Admin",
            siteId: req.header("x-role") === "educational_leader" ? 3 : null,
          },
        };
    next();
  });
  app.use("/api", excursionsRouter);
  return app;
}

beforeEach(() => {
  state.excursion = null;
  state.recipient = null;
  state.logs = [];
  state.children = [];
  state.parentAccounts = [];
  state.notifications = [];
  vi.clearAllMocks();
});

describe("holiday-program excursion recipients", () => {
  it("accepts an active guardian whose child belongs to a different site", async () => {
    state.children = [{
      id: 12,
      firstName: "Sam",
      lastName: "Student",
      siteId: 1,
      status: "active",
      guardianName: "Guardian Example",
      guardianEmail: "guardian@example.com",
      guardian2Name: null,
      guardian2Email: null,
    }];
    state.parentAccounts = [{
      id: 9,
      guardianEmail: "guardian@example.com",
      blockedAt: null,
    }];

    const response = await request(buildApp())
      .post("/api/excursions/recipients/verify")
      .send({ siteId: 6, emails: ["guardian@example.com"] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{
      email: "guardian@example.com",
      valid: true,
      guardianName: "Guardian Example",
      children: [{ childId: 12, childName: "Sam Student", siteId: 1 }],
    }]);
  });

  it("removes a sent recipient's in-app notification without removing the recipient", async () => {
    state.excursion = {
      id: 41,
      siteId: 3,
      status: "sent",
    };
    state.recipient = {
      id: 55,
      excursionId: 41,
      guardianEmail: "guardian@example.com",
    };
    state.notifications = [{
      id: 81,
      guardianEmail: "guardian@example.com",
      dedupeKey: "excursion:41:recipient:55:sent",
    }];

    const response = await request(buildApp())
      .delete("/api/excursions/41/recipients/55/notification");

    expect(response.status).toBe(204);
    expect(state.notifications).toEqual([]);
    expect(state.recipient).toMatchObject({
      id: 55,
      excursionId: 41,
      hiddenFromGuardianAt: expect.any(Date),
    });
  });

  it("undoes reminder removal by restoring guardian visibility and notification without sending email", async () => {
    state.excursion = {
      id: 41, siteId: 3, status: "sent", heading: "Science Centre Visit", excursionDate: "2026-10-20",
    };
    state.recipient = {
      id: 55, excursionId: 41, guardianEmail: "guardian@example.com",
      childNameSnapshot: "Sam Student", hiddenFromGuardianAt: null,
    };
    state.notifications = [{
      id: 81, guardianEmail: "guardian@example.com", dedupeKey: "excursion:41:recipient:55:sent",
    }];
    const app = buildApp();

    expect((await request(app).delete("/api/excursions/41/recipients/55/notification")).status).toBe(204);
    expect(state.recipient.hiddenFromGuardianAt).toBeInstanceOf(Date);
    expect(state.notifications).toHaveLength(0);

    const restored = await request(app).put("/api/excursions/41/recipients/55/notification");
    expect(restored.status).toBe(204);
    expect(state.recipient.hiddenFromGuardianAt).toBeNull();
    expect(state.notifications).toMatchObject([{
      guardianEmail: "guardian@example.com",
      type: "guardian_excursion",
      href: "/excursions/41/recipients/55",
      dedupeKey: "excursion:41:recipient:55:sent",
    }]);
    expect((await request(app).put("/api/excursions/41/recipients/55/notification")).status).toBe(204);
    expect(state.notifications).toHaveLength(1);
    expect((await request(app).delete("/api/excursions/41/recipients/55/notification")).status).toBe(204);
    expect(state.notifications).toHaveLength(0);
  });

  it("rejects undo from guardians and staff outside the excursion site", async () => {
    state.excursion = { id: 41, siteId: 4, status: "sent" };
    state.recipient = { id: 55, excursionId: 41, guardianEmail: "guardian@example.com", hiddenFromGuardianAt: new Date() };
    const app = buildApp();

    expect((await request(app).put("/api/excursions/41/recipients/55/notification").set("x-user", "guardian")).status).toBe(403);
    expect((await request(app).put("/api/excursions/41/recipients/55/notification").set("x-role", "educational_leader")).status).toBe(403);
    expect(state.recipient.hiddenFromGuardianAt).toBeInstanceOf(Date);
    expect(state.notifications).toHaveLength(0);
  });

  it("undoes removal on a completed excursion without sending a new permission notification", async () => {
    state.excursion = { id: 41, siteId: 3, status: "completed" };
    state.recipient = {
      id: 55, excursionId: 41, guardianEmail: "guardian@example.com",
      hiddenFromGuardianAt: new Date(),
    };
    const response = await request(buildApp()).put("/api/excursions/41/recipients/55/notification");
    expect(response.status).toBe(204);
    expect(state.recipient.hiddenFromGuardianAt).toBeNull();
    expect(state.notifications).toHaveLength(0);
  });

  it("does not list a past excursion in the guardian's upcoming excursions", async () => {
    state.excursion = {
      id: 41,
      siteId: 3,
      status: "sent",
      excursionDate: "2000-01-01",
    };
    state.recipient = {
      id: 55,
      excursionId: 41,
      guardianEmail: "guardian@example.com",
    };

    const response = await request(buildApp())
      .get("/api/guardian/excursions")
      .set("x-user", "guardian");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
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

  it("lets an administrator edit a published excursion without changing guardian responses", async () => {
    const app = buildApp();
    await request(app).post("/api/excursions").send({ siteId: 3, ...permissionFields });
    state.excursion = { ...state.excursion, status: "sent", sentAt: new Date("2026-09-15T01:00:00.000Z") };
    state.recipient = {
      id: 55, excursionId: 41, guardianEmail: "guardian@example.com", guardianId: 9,
      guardianNameSnapshot: "Guardian", childId: 12, childNameSnapshot: "Sam Student",
      viewedAt: new Date("2026-09-15T02:00:00.000Z"),
      acknowledgedAt: new Date("2026-09-15T03:00:00.000Z"),
      decision: "granted",
      createdAt: new Date("2026-09-15T01:00:00.000Z"),
    };
    const originalRecipient = { ...state.recipient };

    const response = await request(app)
      .patch("/api/excursions/41")
      .send({ ...updatedPermissionFields, siteId: 3, recipientEmails: [] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(responseFields(updatedPermissionFields));
    expect(response.body.status).toBe("sent");
    expect(state.recipient).toEqual(originalRecipient);
  });

  it("does not let a published excursion move to another site", async () => {
    const app = buildApp();
    await request(app).post("/api/excursions").send({ siteId: 3, ...permissionFields });
    state.excursion = { ...state.excursion, status: "sent", sentAt: new Date("2026-09-15T01:00:00.000Z") };

    const response = await request(app)
      .patch("/api/excursions/41")
      .send({ heading: "Changed", siteId: 4 });

    expect(response.status).toBe(409);
    expect(state.excursion.heading).toBe(permissionFields.heading);
  });

  it("does not let non-administrators edit a published excursion", async () => {
    const app = buildApp();
    await request(app).post("/api/excursions").send({ siteId: 3, ...permissionFields });
    state.excursion = { ...state.excursion, status: "sent", sentAt: new Date("2026-09-15T01:00:00.000Z") };

    const response = await request(app)
      .patch("/api/excursions/41")
      .set("x-role", "educational_leader")
      .send({ heading: "Changed" });

    expect(response.status).toBe(403);
    expect(state.excursion.heading).toBe(permissionFields.heading);
  });
});

describe("guardian excursion activity idempotency", () => {
  function seedSentExcursion() {
    state.excursion = {
      id: 41,
      siteId: 3,
      heading: "Science Centre Visit",
      excursionDate: "2026-10-20",
      description: "Hands-on exhibits",
      venue: "Melbourne Science Centre",
      purpose: "Science program",
      cost: "$18.50",
      departureTime: "08:15 AM",
      arrivalAtVenue: "09:05 AM",
      departureFromVenue: "01:40 PM",
      arrivalTime: "02:35 PM",
      maximumChildren: "32",
      transportMethod: "Chartered bus",
      restraintsFitted: "Lap-sash belts",
      childToStaffRatio: "1:6",
      staffAttending: "A. Educator",
      itemsToBring: "Hat and lunch",
      otherInformation: "Wear the service polo",
      medicalAuthorisationText: "I authorise emergency treatment.",
      riskAssessmentPath: null,
      riskAssessmentName: null,
      status: "sent",
      createdByStaffId: 7,
      sentAt: new Date("2026-09-15T01:00:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-09-15T00:00:00.000Z"),
      updatedAt: new Date("2026-09-15T01:00:00.000Z"),
    };
    state.recipient = {
      id: 55,
      excursionId: 41,
      guardianEmail: "guardian@example.com",
      guardianId: 9,
      guardianNameSnapshot: "Guardian",
      childId: 12,
      childNameSnapshot: "Sam Student",
      viewedAt: null,
      acknowledgedAt: null,
      decision: null,
      createdAt: new Date("2026-09-15T01:00:00.000Z"),
    };
  }

  it("records repeated viewed and acknowledged requests only once", async () => {
    seedSentExcursion();
    const app = buildApp();

    for (const event of ["viewed", "viewed", "acknowledged", "acknowledged"]) {
      const response = await request(app)
        .post(`/api/guardian/excursions/41/recipients/55/${event}`)
        .set("x-user", "guardian");
      expect(response.status).toBe(200);
    }

    expect(state.logs.filter((log) => log.event === "viewed")).toHaveLength(1);
    expect(state.logs.filter((log) => log.event === "acknowledged")).toHaveLength(1);
  });

  it.each(["viewed", "acknowledged"] as const)(
    "records simultaneous %s requests only once",
    async (event) => {
      seedSentExcursion();
      const app = buildApp();

      const responses = await Promise.all([
        request(app).post(`/api/guardian/excursions/41/recipients/55/${event}`).set("x-user", "guardian"),
        request(app).post(`/api/guardian/excursions/41/recipients/55/${event}`).set("x-user", "guardian"),
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(state.logs.filter((log) => log.event === event)).toHaveLength(1);
    },
  );

  it("hides duplicate milestones while preserving reminders and each guardian history", async () => {
    seedSentExcursion();
    state.logs = [
      { id: 1, excursionId: 41, recipientId: 55, guardianEmail: "guardian@example.com", event: "viewed", metadata: null, createdAt: new Date("2026-09-15T08:00:00.000Z") },
      { id: 2, excursionId: 41, recipientId: 55, guardianEmail: "guardian@example.com", event: "viewed", metadata: null, createdAt: new Date("2026-09-15T07:00:00.000Z") },
      { id: 3, excursionId: 41, recipientId: 55, guardianEmail: "guardian@example.com", event: "acknowledged", metadata: null, createdAt: new Date("2026-09-15T09:00:00.000Z") },
      { id: 4, excursionId: 41, recipientId: 55, guardianEmail: "guardian@example.com", event: "acknowledged", metadata: null, createdAt: new Date("2026-09-15T08:30:00.000Z") },
      { id: 5, excursionId: 41, recipientId: 55, guardianEmail: "guardian@example.com", event: "reminder", metadata: null, createdAt: new Date("2026-09-15T10:00:00.000Z") },
      { id: 6, excursionId: 41, recipientId: 55, guardianEmail: "guardian@example.com", event: "reminder", metadata: null, createdAt: new Date("2026-09-15T11:00:00.000Z") },
      { id: 7, excursionId: 41, recipientId: 56, guardianEmail: "other@example.com", event: "viewed", metadata: null, createdAt: new Date("2026-09-15T12:00:00.000Z") },
      { id: 8, excursionId: 41, recipientId: 56, guardianEmail: "other@example.com", event: "acknowledged", metadata: null, createdAt: new Date("2026-09-15T12:30:00.000Z") },
    ];

    const response = await request(buildApp()).get("/api/excursions/41");

    expect(response.status).toBe(200);
    expect(response.body.logs.filter((log: any) => log.event === "viewed")).toHaveLength(2);
    expect(response.body.logs.filter((log: any) => log.event === "acknowledged")).toHaveLength(2);
    expect(response.body.logs.filter((log: any) => log.event === "reminder")).toHaveLength(2);
    expect(response.body.logs.filter((log: any) => log.guardianEmail === "guardian@example.com")).toHaveLength(4);
    expect(response.body.logs.filter((log: any) => log.guardianEmail === "other@example.com")).toHaveLength(2);
  });
});