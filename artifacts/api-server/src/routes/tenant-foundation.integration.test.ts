/**
 * Opt-in development database checks. All fixtures and mutations are rolled
 * back, including on assertion failure. Never run against production.
 */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const state = vi.hoisted(() => ({ tx: undefined as any, actual: undefined as any }));
vi.mock("@workspace/db", async (original) => {
  const actual = await original<typeof import("@workspace/db")>();
  state.actual = actual.db;
  return { ...actual, db: new Proxy({}, {
    get(_target, key) {
      const target = state.tx ?? actual.db;
      const value = target[key as keyof typeof target];
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) };
});
import {
  db, organisationTable, staffTable, calendarEventsTable,
  dashboardLayoutsTable, parentAccountsTable, sitesTable, schoolAccountsTable,
} from "@workspace/db";
import calendar from "./organisation-calendar";
import layouts from "./dashboard-layouts";
import company from "./organisation";
import { organisationContext } from "../middlewares/organisation-context";
import { dashboardTileIds } from "./dashboard-layout-validation";

const enabled = process.env.RUN_TENANT_DB_TESTS === "1" && process.env.NODE_ENV !== "production";
function app(user: { id: number; type: string; role: string; siteId?: number }) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).session = { user };
    (req as any).log = { error: vi.fn() };
    next();
  });
  a.use(organisationContext);
  a.use("/calendar", calendar);
  a.use("/layouts", layouts);
  a.use(company);
  a.get("/context", (_req, res) => res.json({ organisationId: res.locals.organisationId }));
  return a;
}
const rollback = new Error("Intentional tenant fixture rollback");
async function isolated(run: () => Promise<void>) {
  try {
    await state.actual.transaction(async (tx: any) => {
      state.tx = tx;
      await run();
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally { state.tx = undefined; }
}
async function fixtures() {
  const suffix = randomUUID();
  const orgs = await db.insert(organisationTable).values([
    { name: `Tenant test A ${suffix}` }, { name: `Tenant test B ${suffix}` },
  ]).returning();
  const staff = await db.insert(staffTable).values(orgs.map((org, index) => ({
    firstName: "Isolation", lastName: "Test", email: `tenant-${index}-${suffix}@example.invalid`,
    qualifications: "", role: "admin", organisationId: org.id,
  }))).returning();
  return { orgs, staff, apps: staff.map((member) => app({ id: member.id, type: "staff", role: "admin" })) };
}
describe.skipIf(!enabled)("tenant foundation — real database rollback checks", () => {
  it("isolates calendar reads, creates, edits and deletes despite tampered IDs", () => isolated(async () => {
    const { orgs, apps } = await fixtures();
    const payload = { title: "Tenant-private meeting", startDate: "2026-10-17", endDate: "2026-10-17" };
    const created = await request(apps[0]).post("/calendar/events").send(payload);
    expect(created.status).toBe(201);
    expect(created.body.organisationId).toBe(orgs[0].id);
    const id = created.body.id;
    const listed = await request(apps[1]).get("/calendar/events?from=2026-10-01&to=2026-10-31");
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([]);
    expect((await request(apps[1]).patch(`/calendar/events/${id}`).send(payload)).status).toBe(404);
    expect((await request(apps[1]).delete(`/calendar/events/${id}`)).status).toBe(404);
    expect((await request(apps[1]).post("/calendar/events").send({
      ...payload, organisationId: orgs[0].id,
    })).status).toBe(400);
    expect((await db.select().from(calendarEventsTable).where(eq(calendarEventsTable.id, id)))[0].title)
      .toBe(payload.title);
  }));
  it("keeps company settings and shared layouts within the verified company", () => isolated(async () => {
    const { orgs, apps } = await fixtures();
    const items = dashboardTileIds.educator.map((i, index) => ({ i, x: 0, y: index * 3, w: 12, h: 3 }));
    await db.insert(dashboardLayoutsTable).values({
      organisationId: orgs[0].id, dashboard: "educator", items, revision: 1,
    });
    const layout = await request(apps[1]).get("/layouts/educator");
    expect(layout.status).toBe(200);
    expect(layout.body.published).toBeNull();
    const own = await request(apps[1]).get(`/organisation?organisationId=${orgs[0].id}`);
    expect(own.status).toBe(200);
    expect(own.body.id).toBe(orgs[1].id);
    expect((await request(apps[1]).put("/organisation").send({
      name: "Updated company B", id: orgs[0].id,
    })).status).toBe(200);
    const [unchanged] = await db.select().from(organisationTable).where(eq(organisationTable.id, orgs[0].id));
    expect(unchanged.name).toBe(orgs[0].name);
  }));
  it("resolves guardian and school ownership without trusting the session site", () => isolated(async () => {
    const { orgs } = await fixtures();
    const suffix = randomUUID();
    const [guardian] = await db.insert(parentAccountsTable).values({
      guardianEmail: `tenant-guardian-${suffix}@example.invalid`, organisationId: orgs[1].id,
    }).returning();
    const [site] = await db.insert(sitesTable).values({ name: "Isolation service", orgId: orgs[1].id }).returning();
    const [school] = await db.insert(schoolAccountsTable).values({
      username: `tenant-school-${suffix}`, siteId: site.id,
    }).returning();
    for (const user of [
      { id: guardian.id, type: "guardian", role: "guardian" },
      { id: school.id, type: "school", role: "school", siteId: site.id },
    ]) {
      const response = await request(app(user)).get("/context");
      expect(response.status).toBe(200);
      expect(response.body.organisationId).toBe(orgs[1].id);
      expect((await request(app(user)).put("/organisation").send({ name: "Wrong" })).status).toBe(403);
    }
    const movedSession = app({ id: school.id, type: "school", role: "school", siteId: site.id + 1 });
    expect((await request(movedSession).get("/context")).status).toBe(403);
  }));
});
