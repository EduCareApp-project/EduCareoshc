/**
 * Opt-in development database checks. All fixtures and mutations are rolled
 * back, including on assertion failure. Never run against production.
 */
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const state = vi.hoisted(() => ({ tx: undefined as any, actual: undefined as any, tenantDb: undefined as any }));
vi.mock("@workspace/db", async (original) => {
  const actual = await original<typeof import("@workspace/db")>();
  state.actual = actual.systemDb;
  state.tenantDb = actual.db;
  const scopedMock = new Proxy({}, {
    get(_target, key) {
      const target = state.tx ?? actual.systemDb;
      const value = target[key as keyof typeof target];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { ...actual, db: scopedMock, systemDb: scopedMock };
});
import {
  db, organisationTable, staffTable, calendarEventsTable,
  dashboardLayoutsTable, parentAccountsTable, sitesTable, schoolAccountsTable,
  childrenTable, childDocumentsTable, noticesTable, childMedicationsTable, passwordResetTokensTable,
  guardianFinancialAccountsTable, guardianCommunicationLogsTable, guardianPaymentPlansTable,
} from "@workspace/db";
vi.mock("../lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendGuardianNoticeEmail: vi.fn(),
  sendMedicationLogEmail: vi.fn(),
}));
import calendar from "./organisation-calendar";
import layouts from "./dashboard-layouts";
import company from "./organisation";
import children from "./children";
import staffRoutes from "./staff";
import siteRoutes from "./sites";
import medicationRoutes from "./medications";
import notices from "./notices";
import guardians from "./guardians";
import auth from "./auth";
import financial from "./guardian-financial";
import { organisationContext } from "../middlewares/organisation-context";
import { dashboardTileIds } from "./dashboard-layout-validation";

const enabled = process.env.RUN_TENANT_DB_TESTS === "1" && process.env.NODE_ENV !== "production";
function app(user: { id: number; type: string; role: string; siteId?: number }) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).session = { user, save: (cb: () => void) => cb() };
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  a.use(organisationContext);
  a.use("/calendar", calendar);
  a.use("/layouts", layouts);
  a.use(company);
  a.use(children);
  a.use(staffRoutes);
  a.use(siteRoutes);
  a.use(medicationRoutes);
  a.use(notices);
  a.use(financial);
  a.use(guardians);
  a.use(auth);
  a.get("/context", (_req, res) => res.json({ organisationId: res.locals.organisationId }));
  a.get("/request-scope", async (_req, res, next) => {
    try {
      const result = await state.tenantDb.execute(sql`SELECT current_setting('portal.organisation_id')::integer AS owner,
        (SELECT count(*)::integer FROM staff) AS visible_staff`);
      res.json(result.rows[0]);
    } catch (error) { next(error); }
  });
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
    { name: `Tenant test A ${suffix}`, organisationId: `TEST-A-${suffix}` },
    { name: `Tenant test B ${suffix}`, organisationId: `TEST-B-${suffix}` },
  ]).returning();
  const staff = await db.insert(staffTable).values(orgs.map((org, index) => ({
    firstName: "Isolation", lastName: "Test", email: `tenant-${index}-${suffix}@example.invalid`,
    qualifications: "", role: "admin", organisationId: org.id,
  }))).returning();
  return { orgs, staff, apps: staff.map((member) => app({ id: member.id, type: "staff", role: "admin" })) };
}
const childPayload = {
  firstName: "Isolation", lastName: "Child", dateOfBirth: "2020-01-01", enrollmentDate: "2026-01-01",
  guardianName: "Isolation Guardian", guardianPhone: "0000000000", status: "active",
};
describe.skipIf(!enabled)("tenant foundation — real database rollback checks", () => {
  it("binds the actual restricted connection to verified ownership for every account role", () => isolated(async () => {
    const { orgs, staff } = await fixtures();
    const [site] = await db.insert(sitesTable).values({ name: "Role scope service", orgId: orgs[1].id }).returning();
    const [guardian] = await db.insert(parentAccountsTable).values({
      guardianEmail: `role-${randomUUID()}@example.invalid`, organisationId: orgs[1].id,
    }).returning();
    const [school] = await db.insert(schoolAccountsTable).values({
      siteId: site.id, username: `school-${randomUUID()}`, organisationId: orgs[1].id,
    }).returning();
    const check = async (user: any) => {
      const response = await request(app({ ...user, organisationId: orgs[0].id } as any)).get("/request-scope");
      expect(response.status).toBe(200);
      expect(response.body.owner).toBe(orgs[1].id);
      // Fixtures are deliberately uncommitted. The separate restricted
      // connection must not see existing Elysium/other-company staff instead.
      expect(response.body.visible_staff).toBe(0);
    };
    for (const role of ["director", "admin", "admin_support", "educational_leader", "coordinator", "educator", "onboarding"]) {
      await db.update(staffTable).set({ role }).where(eq(staffTable.id, staff[1].id));
      await check({ id: staff[1].id, type: "staff", role });
    }
    await check({ id: guardian.id, type: "guardian", role: "guardian", email: guardian.guardianEmail });
    await check({ id: school.id, type: "school", role: "school", siteId: site.id });
  }));
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
  it("keeps children, documents and service assignments in one company", () => isolated(async () => {
    const { orgs, apps } = await fixtures();
    const sites = await db.insert(sitesTable).values(orgs.map((org) => ({ name: "Company service", orgId: org.id }))).returning();
    const email = `shared-${randomUUID()}@example.invalid`;
    const created = await request(apps[0]).post("/children").send({
      ...childPayload, guardianEmail: email, siteId: sites[0].id,
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await request(apps[1]).get("/children")).body).toEqual([]);
    expect((await request(apps[1]).get(`/children/${id}`)).status).toBe(404);
    expect((await request(apps[1]).patch(`/children/${id}`).send({ firstName: "Wrong" })).status).toBe(404);
    expect((await request(apps[1]).delete(`/children/${id}`)).status).toBe(404);
    expect((await request(apps[1]).post("/children").send({
      ...childPayload, guardianEmail: email, siteId: sites[0].id,
    })).status).toBe(400);
    expect((await request(apps[0]).patch(`/children/${id}`).send({ siteId: sites[1].id })).status).toBe(400);
    const [doc] = await db.insert(childDocumentsTable).values({
      childId: id, documentName: "Protected document", category: "other", documentPath: "/objects/isolation-test.pdf",
    }).returning();
    const other = await request(apps[0]).post("/children").send({
      ...childPayload, guardianEmail: email, siteId: sites[0].id,
    });
    expect(other.status).toBe(201);
    expect((await request(apps[1]).get(`/children/${id}/documents`)).status).toBe(404);
    expect((await request(apps[0]).delete(`/children/${other.body.id}/documents/${doc.id}`)).status).toBe(404);
    expect((await db.select().from(childDocumentsTable).where(eq(childDocumentsTable.id, doc.id)))).toHaveLength(1);
    expect((await request(apps[0]).get(`/children/${id}`)).body.firstName).toBe(childPayload.firstName);
  }));
  it("keeps staff CRUD and both service assignments in one company", () => isolated(async () => {
    const { orgs, staff, apps } = await fixtures();
    const [foreignSite] = await db.insert(sitesTable).values({ name: "Foreign service", orgId: orgs[1].id }).returning();
    expect((await request(apps[1]).get(`/staff/${staff[0].id}`)).status).toBe(404);
    expect((await request(apps[1]).patch(`/staff/${staff[0].id}`).send({ bio: "Wrong" })).status).toBe(404);
    expect((await request(apps[1]).delete(`/staff/${staff[0].id}`)).status).toBe(404);
    expect((await request(apps[0]).patch(`/staff/${staff[0].id}`).send({ siteId: foreignSite.id })).status).toBe(400);
    expect((await request(apps[0]).patch(`/staff/${staff[0].id}`).send({ associatedSiteIds: [foreignSite.id] })).status).toBe(400);
    expect((await request(apps[0]).get("/staff")).body.map((row: { id: number }) => row.id)).toEqual([staff[0].id]);
  }));
  it("permits manual service-code reuse across companies, but not within a company", () => isolated(async () => {
    const { apps } = await fixtures();
    const first = await request(apps[0]).post("/sites").send({ name: "Service A", identifier: "TEST1" });
    expect(first.status).toBe(201);
    expect((await request(apps[1]).post("/sites").send({ name: "Service B", identifier: "TEST1" })).status).toBe(201);
    expect((await request(apps[1]).patch(`/sites/${first.body.id}`).send({ name: "Wrong" })).status).toBe(404);
    expect((await request(apps[1]).delete(`/sites/${first.body.id}`)).status).toBe(404);
    const unassigned = await request(apps[0]).post("/sites").send({ name: "No code supplied" });
    expect(unassigned.status).toBe(201);
    expect(unassigned.body.identifier).toBeNull();
    // PostgreSQL aborts the surrounding rollback-only transaction after a
    // uniqueness violation. Keep the intentional collision last.
    expect((await request(apps[0]).post("/sites").send({ name: "Duplicate", identifier: "TEST1" })).status).toBe(409);
  }));
  it("scopes company-wide notices, including notices without a site", () => isolated(async () => {
    const { orgs, apps } = await fixtures();
    const [notice] = await db.insert(noticesTable).values({
      organisationId: orgs[0].id, title: "Internal", content: "Private company announcement", audience: "leadership",
    }).returning();
    expect((await request(apps[1]).get("/notices")).body).toEqual([]);
    expect((await request(apps[1]).patch(`/notices/${notice.id}`).send({ title: "Wrong" })).status).toBe(404);
    expect((await request(apps[1]).delete(`/notices/${notice.id}`)).status).toBe(404);
    expect((await request(apps[0]).get("/notices")).body[0].id).toBe(notice.id);
  }));
  it("prevents medication ID/child ID substitution and foreign witnesses", () => isolated(async () => {
    const { orgs, apps, staff } = await fixtures();
    const rows = await db.insert(childrenTable).values(orgs.map((org, index) => ({
      ...childPayload, organisationId: org.id, guardianEmail: `medical-${index}-${randomUUID()}@example.invalid`,
    }))).returning();
    const [med] = await db.insert(childMedicationsTable).values({ childId: rows[0].id, slot: 1, name: "Medication" }).returning();
    expect((await request(apps[1]).get(`/children/${rows[0].id}/medications`)).status).toBe(404);
    expect((await request(apps[1]).put(`/children/${rows[0].id}/medications/1`).send({ name: "Wrong" })).status).toBe(404);
    expect((await request(apps[1]).get(`/children/${rows[1].id}/medications/${med.id}/logs`)).status).toBe(404);
    expect((await request(apps[0]).post(`/children/${rows[0].id}/medications/${med.id}/logs`).send({
      administeredAt: "2026-10-17T10:00:00Z", dosageAdministered: "1", methodOfAdministration: "oral",
      administeredById: staff[0].id, witnessId: staff[1].id,
    })).status).toBe(400);
  }));
  it("requires an organisation code for duplicate identities and preserves existing password hashes", () => isolated(async () => {
    const { orgs, staff, apps } = await fixtures();
    const email = `duplicate-${randomUUID()}@example.invalid`;
    const hash = await bcrypt.hash("Existing-test-password", 4);
    for (const member of staff) await db.update(staffTable).set({ email, passwordHash: hash }).where(eq(staffTable.id, member.id));
    const ambiguous = await request(apps[0]).post("/auth/login").send({ email, password: "Existing-test-password" });
    expect(ambiguous.status).toBe(401);
    const selected = await request(apps[0]).post("/auth/login").send({
      email, password: "Existing-test-password", organisationCode: orgs[1].organisationId,
    });
    expect(selected.status).toBe(200);
    expect(selected.body.user.id).toBe(staff[1].id);
    expect((await db.select().from(staffTable).where(eq(staffTable.id, staff[0].id)))[0].passwordHash).toBe(hash);
  }));
  it("matches guardian children by company as well as email and scopes password resets to one account", () => isolated(async () => {
    const { orgs } = await fixtures();
    const email = `guardian-${randomUUID()}@example.invalid`;
    const accounts = await db.insert(parentAccountsTable).values(orgs.map((org) => ({
      guardianEmail: email, organisationId: org.id, passwordHash: "Original",
    }))).returning();
    const children = await db.insert(childrenTable).values(orgs.map((org) => ({
      ...childPayload, organisationId: org.id, guardianEmail: email,
    }))).returning();
    const a = app({ id: accounts[0].id, type: "guardian", role: "guardian" });
    // The test session middleware supplies no email by default.
    const guardianApp = express();
    guardianApp.use(express.json());
    guardianApp.use((req, _res, next) => {
      (req as any).session = { user: { id: accounts[0].id, type: "guardian", role: "guardian", email } };
      (req as any).log = { error: vi.fn(), warn: vi.fn() };
      next();
    });
    guardianApp.use(auth);
    const own = await request(guardianApp).get("/auth/my-children");
    expect(own.status).toBe(200);
    expect(own.body.map((row: { id: number }) => row.id)).toEqual([children[0].id]);
    expect((await request(guardianApp).put(`/auth/my-children/${children[1].id}/pickups`).send([])).status).toBe(404);
    const token = randomUUID();
    await db.insert(passwordResetTokensTable).values({
      token, email, userType: "guardian", organisationId: orgs[0].id, accountId: accounts[0].id,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const reset = await request(a).post("/auth/reset-password").send({ token, password: "New-test-password" });
    expect(reset.status).toBe(200);
    const actual = await db.select().from(parentAccountsTable).where(eq(parentAccountsTable.id, accounts[1].id));
    expect(actual[0].passwordHash).toBe("Original");
    expect((await request(a).post("/auth/reset-password").send({ token, password: "Another-password" })).status).toBe(400);
  }));
  it("isolates financial accounts, reports, communication logs and plans for a shared guardian email", () => isolated(async () => {
    const { orgs, apps } = await fixtures();
    const email = `financial-${randomUUID()}@example.invalid`;
    await db.insert(childrenTable).values(orgs.map((org) => ({
      ...childPayload, organisationId: org.id, guardianEmail: email,
    })));
    const path = `/guardians/${encodeURIComponent(email)}/financial`;
    expect((await request(apps[0]).patch(path).send({ status: "suspended", reasoning: "Company A only" })).status).toBe(200);
    const b = await request(apps[1]).get(path);
    expect(b.status).toBe(200);
    expect(b.body.status).toBe("active");
    expect(b.body.reasoning).toBeNull();
    const [account] = await db.select().from(guardianFinancialAccountsTable)
      .where(eq(guardianFinancialAccountsTable.organisationId, orgs[0].id));
    expect(account.reasoning).toBe("Company A only");
    expect((await request(apps[1]).get("/guardians/financial/suspended-report")).body).toEqual([]);
    const communication = await request(apps[0]).post(`${path}/communications`).send({ note: "Company A note" });
    expect(communication.status).toBe(201);
    const plan = await request(apps[0]).post(`${path}/payment-plans`).send({ type: "one_off", amount: "10.00" });
    expect(plan.status).toBe(201);
    expect((await request(apps[1]).get(path)).body.communications).toEqual([]);
    expect((await request(apps[1]).get(path)).body.plans).toEqual([]);
    await request(apps[1]).delete(`${path}/communications/${communication.body.id}`);
    await request(apps[1]).patch(`${path}/payment-plans/${plan.body.id}`).send({ received: true });
    await request(apps[1]).delete(`${path}/payment-plans/${plan.body.id}`);
    const [log] = await db.select().from(guardianCommunicationLogsTable).where(eq(guardianCommunicationLogsTable.id, communication.body.id));
    const [savedPlan] = await db.select().from(guardianPaymentPlansTable).where(eq(guardianPaymentPlansTable.id, plan.body.id));
    expect(log.note).toBe("Company A note");
    expect(savedPlan.receivedAt).toBeNull();
    const report = await request(apps[1]).get("/guardians/financial/communication-log");
    expect(report.status).toBe(200);
    expect(report.body.entries).toEqual([]);
  }));
});
