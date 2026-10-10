import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { select, queue, logError } = vi.hoisted(() => {
  const queue: unknown[][] = [];
  const select = vi.fn(() => {
    const data = queue.shift() ?? [];
    const chain: any = {};
    for (const key of ["from", "innerJoin", "where", "orderBy"]) chain[key] = vi.fn(() => chain);
    chain.then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(data).then(resolve);
    return chain;
  });
  return { select, queue, logError: vi.fn() };
});
vi.mock("@workspace/db", () => ({
  db: { select },
  sitesTable: { id: "siteId", name: "name", identifier: "identifier", status: "status", serviceStartDate: "serviceStartDate" },
  schoolReportTermsTable: { id: "termId", siteId: "siteId" },
  schoolReportRowsTable: { id: "rowId", termId: "termId", weekBeginning: "weekBeginning" },
}));
import router from "./dashboard-utilisation";

function app(user?: any) {
  const instance = express();
  instance.use((req, _res, next) => {
    (req as any).session = { user };
    (req as any).log = { error: logError };
    next();
  });
  instance.use(router);
  return instance;
}
const dates = { startDate: "2026-10-05", endDate: "2026-10-09" };
describe("Leadership utilisation API", () => {
  beforeEach(() => { queue.length = 0; select.mockClear(); logError.mockClear(); });
  it("requires sign-in before reading attendance", async () => {
    expect((await request(app()).get("/dashboard/utilisation").query(dates)).status).toBe(401);
    expect(select).not.toHaveBeenCalled();
  });
  it.each([
    { type: "school", siteId: 1 }, { type: "guardian", role: "admin" },
    ...["educator", "coordinator", "onboarding"].map((role) => ({ type: "staff", role })),
  ])("rejects non-leadership accounts: %j", async (user) => {
    expect((await request(app(user)).get("/dashboard/utilisation").query(dates)).status).toBe(403);
    expect(select).not.toHaveBeenCalled();
  });
  it.each(["admin", "admin_support", "educational_leader"])("allows %s and returns all sites", async (role) => {
    queue.push([{ id: 1, name: "Mahogany", identifier: "MAH", status: "active", serviceStartDate: null }], []);
    const result = await request(app({ type: "staff", role })).get("/dashboard/utilisation").query(dates);
    expect(result.status).toBe(200);
    expect(result.body.startDate).toBe(dates.startDate);
    expect(result.body.sites[0].siteName).toBe("Mahogany");
    expect(select).toHaveBeenCalledTimes(2);
  });
  it("uses stored start dates and excludes pending or not-yet-opened sites from the returned charts and totals", async () => {
    queue.push([
      { id: 1, name: "Open midweek", identifier: "MID", status: "active", serviceStartDate: "2026-10-07" },
      { id: 2, name: "Pending", identifier: null, status: "pending", serviceStartDate: "2026-01-01" },
      { id: 3, name: "Opens later", identifier: null, status: "active", serviceStartDate: "2026-10-12" },
    ], [1, 2, 3].map((siteId) => ({
      siteId,
      row: {
        id: siteId, serviceType: "BSC", weekBeginning: "2026-10-05",
        monday: "1", tuesday: "2", wednesday: "3", thursday: "4", friday: "5",
      },
    })));
    const result = await request(app({ type: "staff", role: "admin" })).get("/dashboard/utilisation").query(dates);
    expect(result.status).toBe(200);
    expect(select).toHaveBeenNthCalledWith(1, expect.objectContaining({ serviceStartDate: "serviceStartDate" }));
    expect(result.body.sites.map((site: { siteId: number }) => site.siteId)).toEqual([1]);
    expect(result.body.totals).toEqual({ bsc: 12, asc: 0, pupilFree: 0, vac: 0 });
    expect(result.body.sites[0].recordedSessions.bsc).toBe(3);
  });
  it.each([
    {}, { ...dates, startDate: "2026-02-30" }, { ...dates, endDate: "invalid" },
    { startDate: "2026-10-10", endDate: "2026-10-01" },
  ])("rejects invalid or reversed dates before reading the database: %j", async (query) => {
    expect((await request(app({ type: "staff", role: "admin" })).get("/dashboard/utilisation").query(query)).status).toBe(400);
    expect(select).not.toHaveBeenCalled();
  });
  it("reports a database failure explicitly instead of fabricated zero attendance", async () => {
    select.mockImplementationOnce(() => { throw new Error("Unavailable"); });
    const result = await request(app({ type: "staff", role: "admin" })).get("/dashboard/utilisation").query(dates);
    expect(result.status).toBe(500);
    expect(result.body.error).toContain("Failed to load");
    expect(logError).toHaveBeenCalled();
  });
});
