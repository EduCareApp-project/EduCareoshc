import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { chain, database } = vi.hoisted(() => {
  const chain: any = { from: vi.fn(), where: vi.fn(), limit: vi.fn(), set: vi.fn(), returning: vi.fn() };
  for (const key of ["from", "where", "set"]) chain[key].mockReturnValue(chain);
  return { chain, database: { select: vi.fn(() => chain), update: vi.fn(() => chain) } };
});
vi.mock("@workspace/db", () => ({
  db: database,
  staffTable: { id: "staff.id", recentObservationsCollapsed: "staff.recent_observations_collapsed" },
}));
vi.mock("drizzle-orm", () => ({ eq: (column: string, id: number) => ({ column, id }) }));
import router from "./dashboard-preferences";

function app(type: string | null = "staff", id = 42) {
  const server = express();
  server.use(express.json());
  server.use((req: any, _res, next) => {
    req.session = { user: type ? { type, id } : undefined };
    req.log = { error: vi.fn() };
    next();
  });
  server.use("/api", router);
  return server;
}
const path = "/api/auth/dashboard-preferences";
beforeEach(() => {
  vi.clearAllMocks();
  chain.limit.mockResolvedValue([{ recentObservationsCollapsed: false }]);
  chain.returning.mockResolvedValue([{ recentObservationsCollapsed: true }]);
});
describe("personal dashboard preferences", () => {
  it("loads the signed-in staff account's preferences", async () => {
    const response = await request(app()).get(path);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ recentObservationsCollapsed: false });
    expect(chain.where).toHaveBeenCalledWith({ column: "staff.id", id: 42 });
  });
  it("ignores supplied account IDs and saves only the signed-in account", async () => {
    const response = await request(app()).patch(path).send({ recentObservationsCollapsed: true, id: 99, staffId: 99 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ recentObservationsCollapsed: true });
    expect(chain.set).toHaveBeenCalledWith({ recentObservationsCollapsed: true });
    expect(chain.where).toHaveBeenCalledWith({ column: "staff.id", id: 42 });
  });
  it("restores the saved collapsed choice in a new request and can save expanded", async () => {
    await request(app()).patch(path).send({ recentObservationsCollapsed: true });
    chain.limit.mockResolvedValueOnce([{ recentObservationsCollapsed: true }]);
    expect((await request(app()).get(path)).body.recentObservationsCollapsed).toBe(true);
    chain.returning.mockResolvedValueOnce([{ recentObservationsCollapsed: false }]);
    expect((await request(app()).patch(path).send({ recentObservationsCollapsed: false })).body.recentObservationsCollapsed).toBe(false);
  });
  it.each(["get", "patch"] as const)("requires staff authentication for %s", async method => {
    for (const [type, status] of [[null, 401], ["school", 403], ["guardian", 403]] as const) {
      expect((await request(app(type))[method](path).send({ recentObservationsCollapsed: true })).status).toBe(status);
    }
    expect(database.select).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
  });
  it.each([{}, [], { recentObservationsCollapsed: "true" }, { recentObservationsCollapsed: 1 }])("rejects invalid preferences %j", async body => {
    expect((await request(app()).patch(path).send(body)).status).toBe(400);
    expect(database.update).not.toHaveBeenCalled();
  });
  it("reports persistence failures instead of reporting a successful save", async () => {
    chain.returning.mockRejectedValueOnce(new Error("Database unavailable"));
    expect((await request(app()).patch(path).send({ recentObservationsCollapsed: true })).status).toBe(500);
  });
  it("reports an unknown staff account", async () => {
    chain.limit.mockResolvedValueOnce([]);
    expect((await request(app()).get(path)).status).toBe(404);
  });
});
