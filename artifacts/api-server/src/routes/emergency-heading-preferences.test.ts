import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const { chain, mockDb } = vi.hoisted(() => {
  const chain: any = {
    from: vi.fn(), where: vi.fn(), limit: vi.fn(), set: vi.fn(), returning: vi.fn(),
  };
  for (const method of ["from", "where", "set"]) chain[method].mockReturnValue(chain);
  return { chain, mockDb: { select: vi.fn(() => chain), update: vi.fn(() => chain) } };
});
vi.mock("@workspace/db", () => ({
  db: mockDb, staffTable: { id: "staff.id", emergencyRecordHeadings: "staff.emergency_record_headings" },
}));
vi.mock("drizzle-orm", () => ({
  eq: (column: string, id: number) => ({ column, id }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings: [...strings], values }),
}));
import router from "./emergency-heading-preferences";

function app(type: string | null = "staff") {
  const result = express();
  result.use(express.json());
  result.use((req: any, _res, next) => {
    req.session = { user: type ? { type, id: 42 } : undefined };
    req.log = { error: vi.fn() };
    next();
  });
  result.use("/api", router);
  return result;
}
const path = "/api/auth/emergency-record-headings";

describe("Account emergency heading preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.limit.mockResolvedValue([{ collapsedHeadings: null }]);
    chain.returning.mockResolvedValue([{ collapsedHeadings: { lockdown: true } }]);
  });
  it("returns null for an account with no saved settings", async () => {
    const response = await request(app()).get(path);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ collapsedHeadings: null });
    expect(chain.where).toHaveBeenCalledWith({ column: "staff.id", id: 42 });
  });
  it("returns saved heading values", async () => {
    chain.limit.mockResolvedValue([{ collapsedHeadings: { lockdown: true, other: false } }]);
    const response = await request(app()).get(path);
    expect(response.body.collapsedHeadings).toEqual({ lockdown: true, other: false });
  });
  it("saves only the signed-in staff member's settings and merges changed headings", async () => {
    const response = await request(app()).patch(path).send({ lockdown: true, staffId: 999 });
    expect(response.status).toBe(200);
    expect(chain.where).toHaveBeenCalledWith({ column: "staff.id", id: 42 });
    const expression = chain.set.mock.calls[0][0].emergencyRecordHeadings;
    expect(expression.strings.join("")).toContain("||");
    expect(expression.values).toContain(JSON.stringify({ lockdown: true }));
    expect(response.body).toEqual({ collapsedHeadings: { lockdown: true } });
  });
  it.each(["get", "patch"] as const)("requires staff authentication on %s", async (method) => {
    expect((await request(app(null))[method](path).send({ other: true })).status).toBe(401);
    expect((await request(app("guardian"))[method](path).send({ other: true })).status).toBe(403);
    expect((await request(app("school"))[method](path).send({ other: true })).status).toBe(403);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });
  it.each([null, [], { other: "false" }, { lockdown: 1 }])("rejects malformed heading settings: %j", async (body) => {
    const response = await request(app()).patch(path).set("Content-Type", "application/json").send(JSON.stringify(body));
    expect(response.status).toBe(400);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
  it("returns an explicit error when persistence fails", async () => {
    chain.returning.mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await request(app()).patch(path).send({ other: true });
    expect(response.status).toBe(500);
    expect(response.body.error).toContain("Could not save");
  });
});
