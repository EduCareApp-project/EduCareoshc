import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => {
  const state = { results: [] as unknown[][], writes: 0, transactionMapping: null as unknown };
  const chain: Record<string, any> = {};
  for (const name of ["from", "where", "limit", "orderBy", "for"]) chain[name] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => void) => Promise.resolve(state.results.shift() ?? []).then(resolve);
  const db = {
    select: vi.fn(() => chain),
    transaction: vi.fn(async (fn: any) => fn(db)),
    insert: vi.fn(() => ({ values: (row: any) => ({ onConflictDoUpdate: () => ({
      returning: async () => { state.writes++; return [row]; },
    }) }) })),
  };
  return { state, db, getServices: vi.fn(), getRoll: vi.fn() };
});
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => mocks.db }));
vi.mock("../lib/kidsoft", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/kidsoft")>();
  return { ...original, getKidsoftServices: mocks.getServices, getKidsoftRoll: mocks.getRoll };
});
import router, { canAccessKidsoftSite } from "./kidsoft-roll";
import { KidsoftError } from "../lib/kidsoft";

const siteId = 7;
const mapping = { siteId, serviceId: "source-service", serviceName: "Test service" };
const old = { bookings: [{ bookingId: "old", childId: "c1", childName: "Saved Child", sessionName: "BSC", startTime: "07:00", endTime: "09:00", absent: false }], refreshedAt: new Date("2026-01-01T00:00:00Z") };
function app(user: object = { type: "school", siteId }) {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => { (req as any).session = { user }; (req as any).log = { error: vi.fn() }; next(); });
  server.use(router);
  return server;
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T01:00:00Z"));
  vi.clearAllMocks(); mocks.state.results = []; mocks.state.writes = 0;
  mocks.getServices.mockResolvedValue([{ id: mapping.serviceId, name: mapping.serviceName }]);
  mocks.getRoll.mockResolvedValue(old.bookings);
});
afterEach(() => vi.useRealTimers());
function schoolRows(snapshot: unknown = old) {
  mocks.state.results = [[{ featureSettings: { schoolPortalVisibleTabs: ["roll"] } }], [{ status: "active" }], [mapping], [snapshot]];
}
describe("Kidsoft school access and snapshot safety", () => {
  it("allows own-school access only, never guardians or onboarding", () => {
    expect(canAccessKidsoftSite({ type: "school", siteId }, siteId)).toBe(true);
    expect(canAccessKidsoftSite({ type: "school", siteId }, 8)).toBe(false);
    expect(canAccessKidsoftSite({ type: "guardian", siteId }, siteId)).toBe(false);
    expect(canAccessKidsoftSite({ type: "staff", role: "onboarding", siteId }, siteId)).toBe(false);
    expect(canAccessKidsoftSite({ type: "staff", role: "educator", siteId }, 8)).toBe(false);
    expect(canAccessKidsoftSite({ type: "staff", role: "admin" }, 8)).toBe(true);
  });
  it("rejects other-school reads and refreshes before accessing DB or Kidsoft", async () => {
    expect((await request(app()).get("/schools/8/kidsoft-roll?date=2026-10-15")).status).toBe(403);
    expect((await request(app()).post("/schools/8/kidsoft-roll/refresh").send({ date: "2026-10-15" })).status).toBe(403);
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.getRoll).not.toHaveBeenCalled();
  });
  it("reads the saved day without contacting Kidsoft", async () => {
    schoolRows();
    const response = await request(app()).get("/schools/7/kidsoft-roll?date=2026-10-15");
    expect(response.status).toBe(200);
    expect(response.body.date).toBe("2026-10-15");
    expect(response.body.bookings[0].childName).toBe("Saved Child");
    expect(response.body.totalChildren).toBe(1);
    expect(mocks.getRoll).not.toHaveBeenCalled();
    expect(mocks.getServices).not.toHaveBeenCalled();
  });
  it("blocks schools reading or refreshing yesterday and tomorrow before any database or upstream access", async () => {
    for (const date of ["2026-10-14", "2026-10-16"]) {
      expect((await request(app()).get(`/schools/7/kidsoft-roll?date=${date}`)).status).toBe(403);
      expect((await request(app()).post("/schools/7/kidsoft-roll/refresh").send({ date })).status).toBe(403);
    }
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.getRoll).not.toHaveBeenCalled();
  });
  it("uses Melbourne today rather than the UTC date", async () => {
    vi.setSystemTime(new Date("2026-10-14T13:30:00Z"));
    schoolRows();
    expect((await request(app()).get("/schools/7/kidsoft-roll?date=2026-10-15")).status).toBe(200);
    expect((await request(app()).get("/schools/7/kidsoft-roll?date=2026-10-14")).status).toBe(403);
  });
  it("keeps date selection available to authorised staff", async () => {
    mocks.state.results = [[{ status: "active" }], [mapping], [old]];
    expect((await request(app({ type: "staff", role: "admin" })).get("/schools/7/kidsoft-roll?date=2026-10-14")).status).toBe(200);
  });
  it("does not save or return the previous day's roll if midnight passes during refresh", async () => {
    schoolRows();
    mocks.getRoll.mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-10-15T13:00:00Z"));
      return old.bookings;
    });
    expect((await request(app()).post("/schools/7/kidsoft-roll/refresh").send({ date: "2026-10-15" })).status).toBe(403);
    expect(mocks.state.writes).toBe(0);
  });
  it("blocks the roll when disabled in school visibility settings", async () => {
    mocks.state.results = [[{ featureSettings: { schoolPortalVisibleTabs: ["reports"] } }]];
    expect((await request(app()).get("/schools/7/kidsoft-roll?date=2026-10-15")).status).toBe(403);
    expect(mocks.getRoll).not.toHaveBeenCalled();
  });
  it("retains the previous snapshot on upstream failure", async () => {
    schoolRows(); mocks.getRoll.mockRejectedValue(new KidsoftError());
    const response = await request(app()).post("/schools/7/kidsoft-roll/refresh").send({ date: "2026-10-15" });
    expect(response.status).toBe(502);
    expect(mocks.db.insert).not.toHaveBeenCalled();
    expect(mocks.state.writes).toBe(0);
  });
  it("saves a successful school-triggered refresh", async () => {
    schoolRows(); mocks.state.results.push([mapping]);
    const response = await request(app()).post("/schools/7/kidsoft-roll/refresh").send({ date: "2026-10-15" });
    expect(response.status).toBe(200);
    expect(response.body.date).toBe("2026-10-15");
    expect(mocks.getRoll).toHaveBeenCalledWith(mapping.serviceId, "2026-10-15");
    expect(mocks.state.writes).toBe(1);
  });
  it("does not save if the mapping changes while Kidsoft is being read", async () => {
    schoolRows(); mocks.state.results.push([{ ...mapping, serviceId: "different-service" }]);
    expect((await request(app()).post("/schools/7/kidsoft-roll/refresh").send({ date: "2026-10-15" })).status).toBe(409);
    expect(mocks.state.writes).toBe(0);
  });
  it("throttles repeated refreshes without an upstream request", async () => {
    schoolRows({ ...old, refreshedAt: new Date() });
    expect((await request(app()).post("/schools/7/kidsoft-roll/refresh").send({ date: "2026-10-15" })).status).toBe(429);
    expect(mocks.getServices).not.toHaveBeenCalled();
  });
  it("rejects invalid calendar days", async () => {
    expect((await request(app()).get("/schools/7/kidsoft-roll?date=2026-02-30")).status).toBe(400);
    expect(mocks.db.select).not.toHaveBeenCalled();
  });
  it("forbids schools and educators from changing service mappings", async () => {
    expect((await request(app()).put("/kidsoft/mappings/7").send({ serviceId: null })).status).toBe(403);
    expect((await request(app({ type: "staff", role: "educator", siteId })).get("/kidsoft/setup")).status).toBe(403);
  });
});
