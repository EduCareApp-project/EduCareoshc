import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { mockDb, chain, ensureSchoolAccount } = vi.hoisted(() => {
  const chain = { values: vi.fn(), set: vi.fn(), where: vi.fn(), returning: vi.fn() };
  return {
    mockDb: { insert: vi.fn(() => chain), update: vi.fn(() => chain) },
    chain,
    ensureSchoolAccount: vi.fn(),
  };
});
vi.mock("@workspace/db", () => ({ db: mockDb, sitesTable: { id: "id" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => "site-id-condition") }));
vi.mock("../lib/schoolAccounts", () => ({ ensureSchoolAccount }));

import sitesRouter from "./sites";

const site = { id: 4, name: "Test Site", identifier: "ABC12", createdAt: new Date() };
const duplicate = { cause: { code: "23505", constraint: "sites_identifier_unique" } };

function app() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { error: vi.fn() } as any;
    next();
  });
  app.use("/api", sitesRouter);
  return app;
}

describe("Site identifiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.values.mockReturnValue(chain);
    chain.set.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.returning.mockResolvedValue([site]);
  });

  it.each(["1", "AB", "A12", "AB12", "12345", "ABCDE", "AB123"])("accepts a code of up to five characters: %s", async (identifier) => {
    chain.returning.mockResolvedValueOnce([{ ...site, identifier }]);
    const response = await request(app()).post("/api/sites").send({ name: site.name, identifier });
    expect(response.status).toBe(201);
    expect(chain.values).toHaveBeenCalledWith({ name: site.name, identifier });
    expect(response.body.identifier).toBe(identifier);
    expect(ensureSchoolAccount).toHaveBeenCalledWith(site.id, site.name);
  });

  it("normalizes lowercase and surrounding whitespace on edits", async () => {
    const response = await request(app()).patch("/api/sites/4").send({ identifier: " ab123 " });
    expect(response.status).toBe(200);
    expect(chain.set).toHaveBeenCalledWith({ identifier: "AB123" });
  });

  it.each(["ABC123", "AB-12", "#", 12345])("rejects an invalid code: %s", async (identifier) => {
    const response = await request(app()).post("/api/sites").send({ name: site.name, identifier });
    expect(response.status).toBe(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("leaves the code unassigned when creating without one", async () => {
    chain.returning.mockResolvedValueOnce([{ ...site, identifier: null }]);
    const response = await request(app()).post("/api/sites").send({ name: site.name });
    expect(response.status).toBe(201);
    expect(chain.values).toHaveBeenCalledWith({ name: site.name, identifier: null });
    expect(response.body.identifier).toBeNull();
  });

  it("preserves a code during unrelated edits", async () => {
    const response = await request(app()).patch("/api/sites/4").send({ name: "Renamed site" });
    expect(response.status).toBe(200);
    expect(chain.set).toHaveBeenCalledWith({ name: "Renamed site" });
  });

  it.each(["A", "12", "BSC", "ASC1"])("saves and returns a short code on edit: %s", async (identifier) => {
    chain.returning.mockResolvedValueOnce([{ ...site, identifier }]);
    const response = await request(app()).patch("/api/sites/4").send({ identifier });
    expect(response.status).toBe(200);
    expect(chain.set).toHaveBeenCalledWith({ identifier });
    expect(response.body.identifier).toBe(identifier);
  });

  it.each(["post", "patch"] as const)("returns a clear conflict on duplicate %s", async (method) => {
    chain.returning.mockRejectedValueOnce(duplicate);
    const response = await request(app())[method](method === "post" ? "/api/sites" : "/api/sites/4")
      .send({ name: site.name, identifier: "ABC12" });
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("already used");
  });

  it.each(["", "   ", null])("leaves an explicitly blank code unassigned: %s", async (identifier) => {
    chain.returning.mockResolvedValueOnce([{ ...site, identifier: null }]);
    const response = await request(app()).post("/api/sites").send({ name: site.name, identifier });
    expect(response.status).toBe(201);
    expect(chain.values).toHaveBeenCalledWith({ name: site.name, identifier: null });
    expect(response.body.identifier).toBeNull();
  });

  it("allows clearing an existing code without generating a replacement", async () => {
    chain.returning.mockResolvedValueOnce([{ ...site, identifier: null }]);
    const response = await request(app()).patch("/api/sites/4").send({ identifier: null });
    expect(response.status).toBe(200);
    expect(chain.set).toHaveBeenCalledWith({ identifier: null });
    expect(response.body.identifier).toBeNull();
  });
});
