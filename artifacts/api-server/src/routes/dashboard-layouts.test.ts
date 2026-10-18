import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  rows: [] as unknown[][], where: [] as unknown[], values: [] as any[],
  writes: [] as string[], transaction: vi.fn(),
}));
vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (column: unknown, value: unknown) => ({ column, value }),
  asc: (column: unknown) => column,
}));
vi.mock("@workspace/db", () => {
  const chain = () => {
    const c: any = {};
    for (const method of ["from", "orderBy", "for", "onConflictDoNothing"]) c[method] = () => c;
    c.where = (condition: unknown) => { m.where.push(condition); return c; };
    c.values = c.set = (value: unknown) => { m.values.push(value); return c; };
    c.limit = c.returning = async () => m.rows.shift() ?? [];
    c.then = (resolve: (value: unknown) => unknown) => Promise.resolve(m.rows.shift() ?? []).then(resolve);
    return c;
  };
  const db: any = {
    select: chain,
    insert: (table: { name: string }) => { m.writes.push(`insert:${table.name}`); return chain(); },
    update: (table: { name: string }) => { m.writes.push(`update:${table.name}`); return chain(); },
    delete: (table: { name: string }) => { m.writes.push(`delete:${table.name}`); return chain(); },
  };
  m.transaction.mockImplementation((fn) => fn(db));
  db.transaction = m.transaction;
  return {
    db, systemDb: db,
    withOrganisationContext: (_id: number, next: () => unknown) => next(),
    currentOrganisationId: () => 1,
    staffTable: { id: "staff.id", organisationId: "staff.org" },
    parentAccountsTable: {}, schoolAccountsTable: {}, sitesTable: {},
    dashboardLayoutsTable: { name: "shared", organisationId: "shared.org", dashboard: "shared.view" },
    dashboardLayoutDraftsTable: { name: "draft", organisationId: "draft.org", dashboard: "draft.view",
      staffId: "draft.owner", revision: "draft.revision" },
  };
});
import router from "./dashboard-layouts";
import { dashboardTileIds, layoutDraftInput, layoutPublishInput } from "./dashboard-layout-validation";
const admin = { id: 23, type: "staff", role: "admin" };
const items = dashboardTileIds.educator.map((i, index) => ({ i, x: 0, y: index * 3, w: 12, h: 3 }));
const draft = { items, revision: 1, baseRevision: 0, staffId: 23, organisationId: 1, dashboard: "educator" };
const input = { items, baseRevision: 0, expectedDraftRevision: 0 };
const url = "/api/dashboard-layouts/educator";
function app(user: typeof admin | null = admin) {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).session = { user }; (req as any).log = { error: vi.fn() }; next();
  });
  a.use("/api/dashboard-layouts", router);
  return a;
}
beforeEach(() => {
  m.rows.length = 0; m.where.length = 0; m.values.length = 0; m.writes.length = 0;
  vi.clearAllMocks();
});
describe("dashboard private drafts and organisation layouts", () => {
  it("returns only the current administrator's private draft", async () => {
    m.rows.push([{ organisationId: 1 }], [], [draft]);
    const r = await request(app()).get(url);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ canEdit: true, published: null, draft: { items, revision: 1 } });
    expect(JSON.stringify(m.where)).toContain('"column":"draft.owner","value":23');
    expect(r.body.draft.staffId).toBeUndefined();
  });
  it("returns shared layout without querying drafts for an educator", async () => {
    m.rows.push([{ organisationId: 1 }], [{ items, revision: 2 }]);
    const r = await request(app({ ...admin, role: "educator" })).get(url);
    expect(r.body).toMatchObject({ canEdit: false, draft: null, published: { items, revision: 2, baseRevision: 2 } });
    expect(m.where).toHaveLength(2); // membership + published layout; no private draft
  });
  it.each(["educator", "coordinator", "educational_leader", "onboarding"])("denies %s writes", async (role) => {
    for (const [method, path] of [["put", "/draft"], ["post", "/publish"], ["delete", "/draft"]] as const) {
      expect((await request(app({ ...admin, role }))[method](url + path).send(input)).status).toBe(403);
    }
    expect(m.writes).toHaveLength(0);
  });
  it.each(["school", "guardian"])("denies %s reads", async (type) => {
    expect((await request(app({ ...admin, type })).get(url)).status).toBe(403);
  });
  it("denies anonymous reads", async () => {
    expect((await request(app(null)).get(url)).status).toBe(401);
  });
  it.each(["admin", "admin_support", "director"])("allows %s to save only their own draft", async (role) => {
    m.rows.push([{ organisationId: 1 }], [draft]);
    const r = await request(app({ ...admin, role })).put(url + "/draft").send(input);
    expect(r.status).toBe(200);
    expect(m.values[0]).toMatchObject({ staffId: 23, organisationId: 1, dashboard: "educator", revision: 1 });
    expect(m.writes).toEqual(["insert:draft"]);
  });
  it("rejects unknown, duplicate and missing tile IDs", async () => {
    for (const bad of [items.slice(1), [...items.slice(1), items[1]], [...items.slice(1), { ...items[0], i: "fake" }]]) {
      m.rows.push([{ organisationId: 1 }]);
      expect((await request(app()).put(url + "/draft").send({ ...input, items: bad })).status).toBe(400);
    }
    expect(m.writes).toHaveLength(0);
  });
  it("enforces integral bounded geometry/revisions and rejects server-owned fields", async () => {
    for (const bad of [
      { ...input, items: [{ ...items[0], x: 0.5 }, ...items.slice(1)] },
      { ...input, items: [{ ...items[0], x: 10, w: 3 }, ...items.slice(1)] },
      { ...input, items: [{ ...items[0], h: 99 }, ...items.slice(1)] },
      { ...input, expectedDraftRevision: 0.5 }, { ...input, staffId: 999 },
    ]) expect(layoutDraftInput.safeParse(bad).success).toBe(false);
    expect(layoutPublishInput.safeParse({ expectedRevision: 0, expectedDraftRevision: 1.5 }).success).toBe(false);
  });
  it("rejects stale private saves rather than overwriting them", async () => {
    m.rows.push([{ organisationId: 1 }], []);
    const r = await request(app()).put(url + "/draft").send({ ...input, expectedDraftRevision: 2 });
    expect(r.status).toBe(409);
    expect(JSON.stringify(m.where)).toContain('"column":"draft.revision","value":2');
  });
  it("discards only the caller's private draft, never the shared layout", async () => {
    m.rows.push([{ organisationId: 1 }], []);
    expect((await request(app()).delete(url + "/draft")).status).toBe(204);
    expect(m.writes).toEqual(["delete:draft"]);
    expect(JSON.stringify(m.where)).toContain('"column":"draft.owner","value":23');
  });
  it("publishes the saved private draft atomically and advances both revisions", async () => {
    m.rows.push([{ organisationId: 1 }], [], [{ items: [], revision: 0 }], [draft],
      [{ items, revision: 1 }], [{ ...draft, revision: 2, baseRevision: 1 }]);
    const r = await request(app()).post(url + "/publish").send({ expectedRevision: 0, expectedDraftRevision: 1 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ published: { items, revision: 1 }, draft: { revision: 2, baseRevision: 1 } });
    expect(m.transaction).toHaveBeenCalledOnce();
    expect(m.writes).toEqual(["insert:shared", "update:shared", "update:draft"]);
  });
  it("does not apply a draft based on an outdated shared layout", async () => {
    m.rows.push([{ organisationId: 1 }], [], [{ items, revision: 2 }], [draft]);
    expect((await request(app()).post(url + "/publish").send({ expectedRevision: 0, expectedDraftRevision: 1 })).status).toBe(409);
    expect(m.writes).toEqual(["insert:shared"]); // bootstrap is rolled back by real transaction
  });
  it("does not apply a saved draft changed in another session", async () => {
    m.rows.push([{ organisationId: 1 }], [], [{ items, revision: 0 }], [{ ...draft, revision: 2 }]);
    expect((await request(app()).post(url + "/publish").send({ expectedRevision: 0, expectedDraftRevision: 1 })).status).toBe(409);
    expect(m.writes).toEqual(["insert:shared"]);
  });
});
