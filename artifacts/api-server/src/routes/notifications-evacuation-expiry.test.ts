import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("../lib/expiryInbox", () => ({ syncExpiryInbox: vi.fn().mockResolvedValue(undefined) }));
import request from "supertest";
import express from "express";
import pinoHttp from "pino-http";
import pino from "pino";
import { Writable } from "node:stream";

const { mockDb, mockCreateNotification, tables, setEvacuationEnabled, setRows } = vi.hoisted(() => {
  const tables = {
    notifications: { id: "id", staffId: "staff_id", read: "read", createdAt: "created_at" },
    notificationSettings: { type: "type", enabled: "enabled", advanceDays: "advance_days" },
    staff: { id: "id", status: "status", siteId: "site_id" },
    evacuations: {
      id: "id",
      drillType: "drill_type",
      siteId: "site_id",
      conductedAt: "conducted_at",
      nextDueAt: "next_due_at",
      archivedAt: "archived_at",
    },
  };

  let evacuationEnabled = true;
  let evacuationRows: unknown[] = [];
  let staffRows: Record<number, unknown[]> = {};

  return {
    tables,
    mockCreateNotification: vi.fn().mockResolvedValue(undefined),
    mockDb: {
      select: vi.fn(() => {
        let selectedRows: unknown[] = [];
        const chain = {
          from: vi.fn((table: unknown) => {
            if (table === tables.evacuations) selectedRows = evacuationRows;
            if (table === tables.notifications) selectedRows = [];
            return chain;
          }),
          where: vi.fn((predicate: unknown) => {
            const text = String(predicate);
            if (text === "eq(type,evacuation_expiry)") {
              selectedRows = [{ enabled: evacuationEnabled, advanceDays: 14 }];
            } else if (text.startsWith("eq(type,")) {
              selectedRows = [{ enabled: false, advanceDays: null }];
            } else if (text.includes("eq(drill_type,evacuation)")) {
              selectedRows = evacuationRows.filter((row) => {
                const evacuation = row as {
                  drillType?: string;
                  archivedAt?: Date | null;
                  nextDueAt?: Date | null;
                  siteId?: number | null;
                };
                return evacuation.drillType === "evacuation"
                  && evacuation.archivedAt == null
                  && evacuation.nextDueAt != null
                  && evacuation.siteId != null;
              });
            } else if (text.includes("eq(site_id,1)")) {
              selectedRows = staffRows[1] ?? [];
            } else if (text.includes("eq(site_id,2)")) {
              selectedRows = staffRows[2] ?? [];
            } else if (text.includes("eq(site_id,3)")) {
              selectedRows = staffRows[3] ?? [];
            } else if (text.includes("eq(staff_id,1)")) {
              selectedRows = [];
            }
            return chain;
          }),
          orderBy: vi.fn(() => chain),
          then(resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) {
            return Promise.resolve(selectedRows).then(resolve, reject);
          },
          catch(reject: (reason: unknown) => unknown) {
            return Promise.resolve(selectedRows).catch(reject);
          },
        };
        return chain;
      }),
    },
    setEvacuationEnabled(enabled: boolean) {
      evacuationEnabled = enabled;
    },
    setRows(rows: { evacuations: unknown[]; staff: Record<number, unknown[]> }) {
      evacuationRows = rows.evacuations;
      staffRows = rows.staff;
    },
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  notificationsTable: tables.notifications,
  notificationSettingsTable: tables.notificationSettings,
  staffTable: tables.staff,
  evacuationsTable: tables.evacuations,
  qipItemsTable: { id: "id", dueDate: "due_date", archivedAt: "archived_at", siteId: "site_id" },
  checklistRoutinesTable: { id: "id", targetDate: "target_date", siteId: "site_id", staffId: "staff_id", title: "title" },
  planningExperiencesTable: { id: "id", siteId: "site_id", weeklyPlanData: "weekly_plan_data" },
  sitesTable: { id: "id", status: "status" },
  childMedicationsTable: { id: "id", expiryDate: "expiry_date", name: "name", childId: "child_id" },
  childrenTable: { id: "id", siteId: "site_id", firstName: "first_name", lastName: "last_name", guardianEmail: "guardian_email", guardian2Email: "guardian2_email" },
  parentAccountsTable: { id: "id", guardianEmail: "guardian_email" },
  emailSendLogTable: { id: "id", dedupeKey: "dedupe_key" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => `eq(${String(column)},${String(value)})`),
  and: vi.fn((...conditions: unknown[]) => `and(${conditions.join(",")})`),
  desc: vi.fn((column: unknown) => `desc(${String(column)})`),
  isNull: vi.fn((column: unknown) => `isNull(${String(column)})`),
  isNotNull: vi.fn((column: unknown) => `isNotNull(${String(column)})`),
  not: vi.fn((condition: unknown) => `not(${String(condition)})`),
  inArray: vi.fn((column: unknown, values: unknown[]) => `inArray(${String(column)},${values.join(",")})`),
  lte: vi.fn(() => "lte"),
  gte: vi.fn(() => "gte"),
}));

vi.mock("../lib/notify", () => ({
  createNotification: mockCreateNotification,
  createNotificationsForRoles: vi.fn().mockResolvedValue(undefined),
  getISOWeek: vi.fn(() => "2026-W36"),
  getYearMonth: vi.fn(() => "2026-09"),
}));

vi.mock("../lib/email", () => ({
  sendMedicationExpiryEmail: vi.fn().mockResolvedValue({ sent: [] }),
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

function buildApp(user = { id: 101, type: "staff", siteId: 1 as number | null }) {
  const app = express();
  app.use(express.json());
  app.use(pinoHttp({
    logger: pino({ level: "silent" }, new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    })),
  }));
  app.use((req, _res, next) => {
    (req as any).session = { user };
    next();
  });
  app.use("/api", notificationsRouter);
  return app;
}

function dateFromToday(offsetDays: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
}

describe("evacuation expiry notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEvacuationEnabled(true);
    setRows({ evacuations: [], staff: {} });
  });

  it("notifies each staff member only for expired and 14-day records at their home site", async () => {
    setRows({
      evacuations: [
        {
          id: 1,
          drillType: "evacuation",
          siteId: 1,
          conductedAt: dateFromToday(-91),
          nextDueAt: dateFromToday(-1),
          archivedAt: null,
        },
        {
          id: 2,
          drillType: "evacuation",
          siteId: 1,
          conductedAt: dateFromToday(-76),
          nextDueAt: dateFromToday(14),
          archivedAt: null,
        },
        {
          id: 3,
          drillType: "evacuation",
          siteId: 1,
          conductedAt: dateFromToday(-75),
          nextDueAt: dateFromToday(15),
          archivedAt: null,
        },
        {
          id: 4,
          drillType: "evacuation",
          siteId: 2,
          conductedAt: dateFromToday(-87),
          nextDueAt: dateFromToday(3),
          archivedAt: null,
        },
        {
          id: 5,
          drillType: "lockdown",
          siteId: 1,
          conductedAt: dateFromToday(-87),
          nextDueAt: dateFromToday(3),
          archivedAt: null,
        },
        {
          id: 6,
          drillType: "evacuation",
          siteId: 1,
          conductedAt: dateFromToday(-87),
          nextDueAt: dateFromToday(3),
          archivedAt: dateFromToday(-2),
        },
      ],
      staff: {
        1: [{ id: 101 }, { id: 102 }],
        2: [{ id: 201 }],
      },
    });

    await request(buildApp({ id: 101, type: "staff", siteId: 1 }))
      .get("/api/notifications/count");
    await request(buildApp({ id: 201, type: "staff", siteId: 2 }))
      .get("/api/notifications");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const notifications = mockCreateNotification.mock.calls.map(([params]) => params as {
      staffId: number;
      type: string;
      referenceId?: number;
      href?: string;
      dedupeKey?: string;
    });

    expect(notifications).toHaveLength(3);
    expect(notifications.map((notification) => [notification.referenceId, notification.staffId])).toEqual([
      [1, 101],
      [2, 101],
      [4, 201],
    ]);
    expect(notifications.every((notification) =>
      notification.type === "evacuation_expiry" &&
      notification.href === "/evacuations" &&
      notification.dedupeKey?.startsWith("evacuation_expiry:"),
    )).toBe(true);
  });

  it("does not create reminders when the evacuation expiry setting is disabled", async () => {
    setEvacuationEnabled(false);
    setRows({
      evacuations: [{
        id: 10,
        drillType: "evacuation",
        siteId: 1,
        conductedAt: dateFromToday(-91),
        nextDueAt: dateFromToday(-1),
        archivedAt: null,
      }],
      staff: { 1: [{ id: 101 }] },
    });

    await request(buildApp()).get("/api/notifications");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not create evacuation reminders for staff without a home site", async () => {
    setRows({
      evacuations: [{
        id: 11,
        drillType: "evacuation",
        siteId: 1,
        conductedAt: dateFromToday(-91),
        nextDueAt: dateFromToday(-1),
        archivedAt: null,
      }],
      staff: { 1: [{ id: 101 }] },
    });

    await request(buildApp({ id: 101, type: "staff", siteId: null }))
      .get("/api/notifications/count");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });
});