import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => {
  const data = new Map<string, unknown[]>();
  const db = { select: vi.fn(() => ({
    from: (table: string) => {
      const chain: any = {};
      chain.where = vi.fn(() => chain);
      chain.orderBy = vi.fn(() => chain);
      chain.limit = vi.fn(async () => data.get(table) ?? []);
      chain.then = (resolve: any, reject: any) => Promise.resolve(data.get(table) ?? []).then(resolve, reject);
      return chain;
    },
  })) };
  return { db, data };
});
vi.mock("@workspace/db", () => ({
  db: mocks.db,
  childrenTable: "children", staffTable: "staff", observationsTable: "observations",
  programsTable: "programs", nqsAreasTable: "nqs", outcomesTable: "outcomes",
  postsTable: "posts", incidentsTable: "incidents", conditionReportsTable: "conditions",
  sitesTable: "sites", planningExperiencesTable: "plans", staffQualificationsTable: "qualifications",
  jottingsTable: "jottings", welfareNotesTable: "welfare", behaviouralNotificationsTable: "behaviour",
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), gte: vi.fn(), count: vi.fn(), desc: vi.fn(), isNotNull: vi.fn(), and: vi.fn(), lte: vi.fn(), ne: vi.fn(),
}));
import router from "./dashboard";

const observation = {
  id: 1, childId: 10, staffId: 20, description: "Test observation", observationDate: "2026-10-15",
  outcomeIds: [], createdAt: new Date(), updatedAt: new Date(), publishedAt: new Date(),
};
function app() {
  const server = express();
  server.use((req: any, _res, next) => { req.log = { error: vi.fn() }; next(); });
  server.use(router);
  return server;
}
beforeEach(() => {
  mocks.data.clear();
  mocks.data.set("observations", [observation]);
  mocks.data.set("children", [{ id: 10, firstName: "Alex", lastName: "Example", siteId: 7 }]);
  mocks.data.set("staff", [{ id: 20, firstName: "Test", lastName: "Educator", siteId: 8 }]);
  mocks.data.set("sites", [{ id: 7, name: "Child Service", identifier: "C7" }, { id: 8, name: "Staff Service", identifier: "S8" }]);
});
describe("Recent Observations child site codes", () => {
  it("uses the child's service code rather than the submitter's service", async () => {
    const response = await request(app()).get("/dashboard/recent-observations");
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ childName: "Alex Example", siteName: "Child Service", siteIdentifier: "C7" });
  });
  it("resolves the child's current assigned service on each request", async () => {
    mocks.data.set("children", [{ id: 10, firstName: "Alex", lastName: "Example", siteId: 8 }]);
    const response = await request(app()).get("/dashboard/recent-observations");
    expect(response.body[0].siteIdentifier).toBe("S8");
  });
  it.each([null, 999])("returns no site code when the child's service is absent or missing (%s)", async siteId => {
    mocks.data.set("children", [{ id: 10, firstName: "Alex", lastName: "Example", siteId }]);
    const response = await request(app()).get("/dashboard/recent-observations");
    expect(response.status).toBe(200);
    expect(response.body[0].siteIdentifier).toBeNull();
  });
  it("does not invent codes for services without an assigned code", async () => {
    mocks.data.set("sites", [{ id: 7, name: "Child Service", identifier: null }]);
    const response = await request(app()).get("/dashboard/recent-observations");
    expect(response.body[0]).toMatchObject({ siteName: "Child Service", siteIdentifier: null });
  });
});
