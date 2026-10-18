import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const table = (name: string, cols: string[]) => Object.fromEntries([["table", name], ...cols.map((c) => [c, `${name}.${c}`])]);
  const notificationsTable = table("notifications", ["staffId", "type", "read", "dedupeKey"]);
  const tables = {
    notificationsTable,
    notificationSettingsTable: table("settings", ["siteId"]),
    childrenTable: table("children", ["id", "status", "siteId"]),
    childMedicationsTable: table("medications", ["id", "childId", "slot", "name", "expiryDate"]),
    staffTable: table("staff", ["id", "status"]),
    staffQualificationsTable: table("qualifications", ["id", "staffId", "name", "expiryDate", "archivedAt"]),
  };
  const state = {
    medications: [] as any[], qualifications: [] as any[], settings: [] as any[], inbox: [] as any[],
    joins: [] as any[], updates: [] as any[],
  };
  type Expr = { op: string; args: any[] };
  const evaluate = (expr: Expr, row: any): boolean => {
    const [column, value] = expr.args;
    const key = String(column).split(".")[1];
    if (expr.op === "and") return expr.args.filter(Boolean).every((e) => evaluate(e, row));
    if (expr.op === "or") return expr.args.filter(Boolean).some((e) => evaluate(e, row));
    if (expr.op === "null") return row[key] == null;
    if (expr.op === "in") return value.includes(row[key]);
    if (expr.op === "notIn") return !value.includes(row[key]);
    if (expr.op === "eq") return row[key] === value;
    return true;
  };
  const db = {
    select: vi.fn(() => {
      let rows: any[] = [];
      let selectedTable = "";
      const chain: any = {
        from: (t: any) => {
          selectedTable = t.table;
          rows = state[selectedTable as "medications"] ?? [];
          return chain;
        },
        innerJoin: (_t: any, predicate: Expr) => {
          state.joins.push(predicate);
          // Joined fixtures represent active sources; simulate recipient scoping.
          const text = JSON.stringify(predicate);
          if (selectedTable === "medications" && text.includes("children.siteId")) {
            const scope = predicate.args.find((e: Expr) => e.args[0] === "children.siteId");
            rows = rows.filter((r) => r.siteId === scope.args[1]);
          }
          if (selectedTable === "qualifications") {
            const scope = predicate.args.find((e: Expr) => e.args[0] === "staff.id" && typeof e.args[1] === "number");
            if (scope) rows = rows.filter((r) => r.staffId === scope.args[1]);
          }
          return chain;
        },
        where: (predicate: Expr) => { rows = rows.filter((row) => evaluate(predicate, row)); return chain; },
        then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
      };
      return chain;
    }),
    update: vi.fn(() => ({
      set: (values: any) => ({
        where: async (predicate: Expr) => {
          state.updates.push(predicate);
          for (const row of state.inbox) if (evaluate(predicate, row)) Object.assign(row, values);
        },
      }),
    })),
  };
  return { tables, state, db };
});
vi.mock("@workspace/db", () => ({ ...mocks.tables, db: mocks.db, currentOrganisationId: () => 1 }));
vi.mock("drizzle-orm", () => {
  const fn = (op: string) => (...args: any[]) => ({ op, args });
  return { eq: fn("eq"), and: fn("and"), or: fn("or"), inArray: fn("in"), notInArray: fn("notIn"), isNull: fn("null") };
});
vi.mock("./channelMap", () => ({ isInAppChannelEnabled: vi.fn().mockResolvedValue(true) }));
vi.mock("./notify", () => ({
  createNotification: vi.fn(async (params: any) => {
    if (!mocks.state.inbox.some((n) => n.dedupeKey === params.dedupeKey)) mocks.state.inbox.push({ ...params, read: false });
  }),
}));
import { expiryReminderKey, syncExpiryInbox } from "./expiryInbox";
const staff = { id: 10, role: "educator", siteId: 7 };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T02:00:00Z"));
  for (const key of Object.keys(mocks.state)) (mocks.state as any)[key] = [];
});

describe("expiry inbox acknowledgement and recurrence", () => {
  it("keeps acknowledgement during same-day polling, but repeats expired medicals and qualifications next day", async () => {
    mocks.state.medications = [{ id: 1, childId: 2, slot: 1, name: "Inhaler", expiry: "2026-10-01", firstName: "Child", lastName: "One", siteId: 7 }];
    mocks.state.qualifications = [{ id: 3, staffId: 10, name: "First aid", expiry: "2026-10-01", firstName: "Staff", lastName: "One" }];
    await syncExpiryInbox(staff);
    expect(mocks.state.inbox.filter((n) => !n.read)).toHaveLength(2);
    mocks.state.inbox.forEach((n) => n.read = true);
    await syncExpiryInbox(staff);
    expect(mocks.state.inbox.filter((n) => !n.read)).toHaveLength(0);
    vi.setSystemTime(new Date("2026-10-16T02:00:00Z"));
    await syncExpiryInbox(staff);
    expect(mocks.state.inbox.filter((n) => !n.read)).toHaveLength(2);
    expect(mocks.state.inbox).toHaveLength(4);
    vi.useRealTimers();
  });

  it("retires renewed/deleted/archived sources and only touches this recipient's expiry notifications", async () => {
    mocks.state.medications = [{ id: 1, childId: 2, slot: 1, name: "Medicine", expiry: "2026-10-01", siteId: 7 }];
    mocks.state.qualifications = [{ id: 3, staffId: 10, name: "Aid", expiry: "2026-10-01", archivedAt: new Date() }];
    mocks.state.inbox = [
      { staffId: 99, type: "medication_expiry", read: false, dedupeKey: "other" },
      { staffId: 10, type: "post_comment", read: false, dedupeKey: "post" },
    ];
    await syncExpiryInbox(staff);
    expect(mocks.state.inbox.some((n) => n.type === "staff_qualification_expiry")).toBe(false);
    mocks.state.medications[0].expiry = "2027-10-01";
    await syncExpiryInbox(staff);
    expect(mocks.state.inbox.filter((n) => n.staffId === 10 && n.type === "medication_expiry").every((n) => n.read)).toBe(true);
    expect(mocks.state.inbox.filter((n) => n.dedupeKey === "other" || n.dedupeKey === "post").every((n) => !n.read)).toBe(true);
    vi.useRealTimers();
  });

  it("scopes educators to their own medical site and personal qualifications; no all-site fetch for site-less educators", async () => {
    mocks.state.medications = [
      { id: 1, childId: 2, slot: 1, name: "Local", expiry: "2026-10-01", siteId: 7 },
      { id: 2, childId: 3, slot: 1, name: "Other site", expiry: "2026-10-01", siteId: 8 },
    ];
    mocks.state.qualifications = [
      { id: 3, staffId: 10, name: "Own", expiry: "2026-10-01" },
      { id: 4, staffId: 99, name: "Other staff", expiry: "2026-10-01" },
    ];
    await syncExpiryInbox(staff);
    expect(mocks.state.inbox.map((n) => n.referenceId)).toEqual([1, 3]);
    await syncExpiryInbox({ ...staff, id: 11, siteId: null });
    expect(mocks.state.inbox.some((n) => n.staffId === 11 && n.type === "medication_expiry")).toBe(false);
    vi.useRealTimers();
  });

  it("does not repeat upcoming reminders daily; renewal changes the key and overdue reminders use the Melbourne day", () => {
    expect(expiryReminderKey("medication_expiry", 1, "2026-10-30", 10, "2026-10-15"))
      .toBe(expiryReminderKey("medication_expiry", 1, "2026-10-30", 10, "2026-10-16"));
    expect(expiryReminderKey("medication_expiry", 1, "2026-10-01", 10, "2026-10-15"))
      .not.toBe(expiryReminderKey("medication_expiry", 1, "2026-10-01", 10, "2026-10-16"));
    vi.useRealTimers();
  });
});
