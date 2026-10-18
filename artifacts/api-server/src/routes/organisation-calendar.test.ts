import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  rows: [] as unknown[][], conditions: [] as unknown[], values: [] as unknown[],
  insert: vi.fn(), update: vi.fn(), delete: vi.fn(),
}));
vi.mock("drizzle-orm", () => ({
  eq: (field: unknown, value: unknown) => ({ eq: [field, value] }),
  gte: (field: unknown, value: unknown) => ({ gte: [field, value] }),
  lte: (field: unknown, value: unknown) => ({ lte: [field, value] }),
  isNull: (field: unknown) => ({ isNull: field }),
  asc: (field: unknown) => field,
  and: (...parts: unknown[]) => ({ and: parts.filter((part) => part !== undefined) }),
}));
vi.mock("@workspace/db", () => {
  const chain = () => {
    const c: Record<string, unknown> = {};
    c.from = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.where = vi.fn((condition) => { mock.conditions.push(condition); return c; });
    c.values = vi.fn((value) => { mock.values.push(value); return c; });
    c.set = vi.fn((value) => { mock.values.push(value); return c; });
    c.limit = vi.fn(async () => mock.rows.shift() ?? []);
    c.returning = vi.fn(async () => mock.rows.shift() ?? []);
    c.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(mock.rows.shift() ?? []).then(resolve);
    return c;
  };
  mock.insert.mockImplementation(chain);
  mock.update.mockImplementation(chain);
  mock.delete.mockImplementation(chain);
  return {
    staffTable: { id: "staff.id", organisationId: "staff.org" },
    parentAccountsTable: {}, schoolAccountsTable: {}, sitesTable: {},
    calendarEventsTable: {
      id: "event.id", organisationId: "event.org", siteId: "event.site", startDate: "event.start",
      endDate: "event.end", startTime: "event.time", createdBy: "event.owner",
    },
    db: { select: vi.fn(chain), insert: mock.insert, update: mock.update, delete: mock.delete },
    systemDb: { select: vi.fn(chain) },
    withOrganisationContext: (_id: number, next: () => unknown) => next(),
    currentOrganisationId: () => 1,
  };
});
import router, { calendarCreateInput, canManageCalendarEvent } from "./organisation-calendar";

const educator = { id: 21, type: "staff", role: "educator" };
const input = { title: "Staff meeting", startDate: "2026-10-14", endDate: "2026-10-14" };
const row = { id: 10, organisationId: 1, siteId: null, ...input, createdBy: 21,
  description: "", location: "", startTime: null, endTime: null, createdAt: new Date(), updatedAt: new Date() };
function app(user: { id: number; type: string; role: string } | null = educator) {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    (req as any).session = { user };
    (req as any).log = { error: vi.fn() };
    next();
  });
  instance.use("/api/organisation-calendar", router);
  return instance;
}
const url = "/api/organisation-calendar/events";

beforeEach(() => {
  mock.rows.length = 0; mock.conditions.length = 0; mock.values.length = 0;
  vi.clearAllMocks();
});
describe("organisation calendar", () => {
  it("creates a shared event with server-owned organisation and creator", async () => {
    mock.rows.push([{ organisationId: 1 }], [row]);
    const response = await request(app()).post(url).send(input);
    expect(response.status).toBe(201);
    expect(response.body.canEdit).toBe(true);
    expect(response.body.startDate).toBe("2026-10-14");
    expect(mock.values[0]).toMatchObject({ organisationId: 1, siteId: null, createdBy: 21,
      description: "", location: "", startTime: null, endTime: null });
  });
  it("lists overlapping events only in the organisation's global calendar", async () => {
    mock.rows.push([{ organisationId: 1 }], [row, { ...row, id: 11, createdBy: 99 }]);
    const response = await request(app()).get(`${url}?from=2026-10-01&to=2026-10-31`);
    expect(response.status).toBe(200);
    expect(response.body.map((event: { canEdit: boolean }) => event.canEdit)).toEqual([true, false]);
    expect(JSON.stringify(mock.conditions)).toContain('"isNull":"event.site"');
    expect(JSON.stringify(mock.conditions)).toContain('"eq":["event.org",1]');
    expect(JSON.stringify(mock.conditions)).toContain('"lte":["event.start","2026-10-31"]');
    expect(JSON.stringify(mock.conditions)).toContain('"gte":["event.end","2026-10-01"]');
  });
  it.each(["school", "guardian"])("denies %s access", async (type) => {
    const response = await request(app({ id: 21, type, role: type })).get(`${url}?from=2026-10-01&to=2026-10-31`);
    expect(response.status).toBe(403);
  });
  it("denies onboarding and anonymous accounts", async () => {
    expect((await request(app({ ...educator, role: "onboarding" })).post(url).send(input)).status).toBe(403);
    expect((await request(app(null)).post(url).send(input)).status).toBe(401);
  });
  it.each([
    { ...input, title: " " }, { ...input, startDate: "2026-02-30" },
    { ...input, endDate: "2026-10-13" }, { ...input, startTime: "24:00" },
    { ...input, startTime: "12:00", endTime: "11:00" }, { ...input, endTime: "12:00" },
    { ...input, organisationId: 2 }, { ...input, siteId: 55 }, { ...input, createdBy: 99 },
  ])("rejects malformed or client-owned protected fields: %j", async (data) => {
    mock.rows.push([{ organisationId: 1 }]);
    expect((await request(app()).post(url).send(data)).status).toBe(400);
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it("preserves leap days and permits overnight multi-day events", () => {
    expect(calendarCreateInput.safeParse({ ...input, startDate: "2028-02-29", endDate: "2028-03-01",
      startTime: "23:00", endTime: "01:00" }).success).toBe(true);
  });
  it("lets the creator edit with an atomic ownership condition", async () => {
    mock.rows.push([{ organisationId: 1 }], [row], [{ ...row, title: "Updated" }]);
    const response = await request(app()).patch(`${url}/10`).send({ ...input, title: "Updated" });
    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Updated");
    expect(JSON.stringify(mock.conditions)).toContain('"eq":["event.owner",21]');
  });
  it.each(["patch", "delete"] as const)("denies another educator's %s operation", async (method) => {
    mock.rows.push([{ organisationId: 1 }], [{ ...row, createdBy: 99 }]);
    const response = await request(app())[method](`${url}/10`).send(input);
    expect(response.status).toBe(403);
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.delete).not.toHaveBeenCalled();
  });
  it.each(["admin", "director", "educational_leader", "admin_support"])("allows %s to delete any organisation event", async (role) => {
    mock.rows.push([{ organisationId: 1 }], [{ ...row, createdBy: 99 }], [{ id: 10 }]);
    const response = await request(app({ ...educator, role })).delete(`${url}/10`);
    expect(response.status).toBe(204);
  });
  it("allows a coordinator to manage only their own events", () => {
    expect(canManageCalendarEvent({ ...educator, role: "coordinator" }, row)).toBe(true);
    expect(canManageCalendarEvent({ ...educator, role: "coordinator" }, { createdBy: 99 })).toBe(false);
  });
  it("returns not found for events outside the organisation/global scope", async () => {
    mock.rows.push([{ organisationId: 1 }], []);
    expect((await request(app()).delete(`${url}/10`)).status).toBe(404);
    expect(mock.delete).not.toHaveBeenCalled();
    expect(JSON.stringify(mock.conditions)).toContain('"eq":["event.org",1]');
  });
  it("reports write failure instead of claiming success", async () => {
    mock.rows.push([{ organisationId: 1 }]);
    mock.insert.mockImplementationOnce(() => { throw new Error("database unavailable"); });
    expect((await request(app()).post(url).send(input)).status).toBe(500);
  });
  it("rejects invalid date ranges and fractional ids", async () => {
    mock.rows.push([{ organisationId: 1 }], [{ organisationId: 1 }]);
    expect((await request(app()).get(`${url}?from=2026-10-31&to=2026-10-01`)).status).toBe(400);
    expect((await request(app()).delete(`${url}/1.3`)).status).toBe(400);
  });
});
