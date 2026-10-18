import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const { mockDb, updateChain } = vi.hoisted(() => {
  const updateChain = {
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
  };
  return { mockDb: { update: vi.fn(() => updateChain) }, updateChain };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  childrenTable: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "child-id-condition"),
  and: vi.fn((...conditions) => conditions),
}));

import childrenRouter from "./children";

const child = {
  id: 4,
  firstName: "Test",
  lastName: "Child",
  dateOfBirth: new Date("2020-01-01"),
  enrollmentDate: new Date("2026-01-01"),
  status: "active",
  guardianName: "Test Guardian",
  guardianEmail: "guardian@example.test",
  guardianPhone: "0000000000",
  hasMedicalCondition: true,
  medicalRiskPlan: { conditions: [] },
  hasMealConsideration: false,
  mealConsiderationDetails: null,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.organisationId = 1;
    res.locals.organisationContextVerified = true;
    req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
    next();
  });
  app.use("/api", childrenRouter);
  return app;
}

describe("PATCH /children/:id meal considerations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateChain.set.mockReturnValue(updateChain);
    updateChain.where.mockReturnValue(updateChain);
    updateChain.returning.mockImplementation(async () => [{
      ...child,
      ...updateChain.set.mock.calls.at(-1)?.[0],
    }]);
  });

  it.each([
    { hasMealConsideration: true, mealConsiderationDetails: "Vegetarian meals" },
    { hasMealConsideration: true, mealConsiderationDetails: "Updated dietary requirements" },
    { hasMealConsideration: false, mealConsiderationDetails: null },
  ])("saves and returns the meal fields without changing other details: %j", async (data) => {
    const response = await request(buildApp()).patch("/api/children/4").send(data);

    expect(response.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith(data);
    expect(response.body).toMatchObject({
      ...data,
      firstName: child.firstName,
      hasMedicalCondition: true,
      medicalRiskPlan: child.medicalRiskPlan,
    });
  });

  it("does not add or reset meal fields in unrelated partial updates", async () => {
    const response = await request(buildApp())
      .patch("/api/children/4").send({ firstName: "Updated" });
    expect(response.status).toBe(200);
    expect(updateChain.set).toHaveBeenCalledWith({ firstName: "Updated" });
  });

  it.each([
    { hasMealConsideration: "true" },
    { mealConsiderationDetails: { invalid: "object" } },
    {},
    { unsupportedField: "value" },
  ])("rejects invalid or empty updates before writing: %j", async (data) => {
    const response = await request(buildApp()).patch("/api/children/4").send(data);
    expect(response.status).toBe(400);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});