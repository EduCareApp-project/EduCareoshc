import { Router, type Request } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, dashboardLayoutsTable as layouts, dashboardLayoutDraftsTable as drafts, organisationTable } from "@workspace/db";
import { dashboardView, hasAllDashboardTiles, isLayoutAdministrator, layoutDraftInput, layoutItems, layoutPublishInput, type DashboardView } from "./dashboard-layout-validation";

const router = Router();
class LayoutConflict extends Error {}
type Published = typeof layouts.$inferSelect;
type Draft = typeof drafts.$inferSelect;
function document(row: Published | Draft | undefined) {
  return row ? { items: layoutItems.parse(row.items), revision: row.revision,
    baseRevision: "baseRevision" in row ? row.baseRevision : row.revision } : null;
}
async function organisationId() {
  const [row] = await db.select({ id: organisationTable.id }).from(organisationTable).orderBy(asc(organisationTable.id)).limit(1);
  if (!row) throw new Error("Organisation is not configured");
  return row.id;
}
function publishedScope(org: number, view: DashboardView) {
  return and(eq(layouts.organisationId, org), eq(layouts.dashboard, view));
}
function draftScope(org: number, view: DashboardView, staffId: number) {
  return and(eq(drafts.organisationId, org), eq(drafts.dashboard, view), eq(drafts.staffId, staffId));
}
function failure(req: Request, res: any, error: unknown, message: string) {
  if (error instanceof LayoutConflict) { res.status(409).json({ error: error.message }); return; }
  req.log.error({ err: error }, message);
  res.status(500).json({ error: message });
}
router.use((req, res, next) => {
  if (!req.session.user) { res.status(401).json({ error: "Sign in to access dashboard layouts" }); return; }
  if (req.session.user.type !== "staff" || req.session.user.role === "onboarding") {
    res.status(403).json({ error: "Dashboard layouts are available to staff only" }); return;
  }
  if (req.method !== "GET" && !isLayoutAdministrator(req.session.user)) {
    res.status(403).json({ error: "Only administrators can change dashboard layouts" }); return;
  }
  next();
});
router.get("/:dashboard", async (req, res) => {
  const view = dashboardView.safeParse(req.params.dashboard);
  if (!view.success) { res.status(400).json({ error: "Unknown dashboard" }); return; }
  try {
    const org = await organisationId();
    const user = req.session.user!;
    const [published] = await db.select().from(layouts).where(publishedScope(org, view.data)).limit(1);
    const [draft] = isLayoutAdministrator(user)
      ? await db.select().from(drafts).where(draftScope(org, view.data, user.id)).limit(1) : [];
    res.json({ dashboard: view.data, canEdit: isLayoutAdministrator(user), published: document(published), draft: document(draft) });
  } catch (error) { failure(req, res, error, "Unable to load dashboard layout"); }
});
router.put("/:dashboard/draft", async (req, res) => {
  const view = dashboardView.safeParse(req.params.dashboard);
  const input = layoutDraftInput.safeParse(req.body);
  if (!view.success || !input.success || !hasAllDashboardTiles(view.data, input.data.items)) {
    res.status(400).json({ error: "Provide every dashboard tile exactly once, with valid sizes and positions" }); return;
  }
  try {
    const org = await organisationId();
    const user = req.session.user!;
    const values = { items: input.data.items, baseRevision: input.data.baseRevision,
      revision: input.data.expectedDraftRevision + 1, updatedAt: new Date() };
    const [saved] = input.data.expectedDraftRevision === 0
      ? await db.insert(drafts).values({ ...values, organisationId: org, dashboard: view.data, staffId: user.id })
        .onConflictDoNothing().returning()
      : await db.update(drafts).set(values).where(and(draftScope(org, view.data, user.id),
        eq(drafts.revision, input.data.expectedDraftRevision))).returning();
    if (!saved) throw new LayoutConflict("Your draft changed in another session. Reload it before saving again.");
    res.json(document(saved));
  } catch (error) { failure(req, res, error, "Unable to save your private layout draft"); }
});
router.delete("/:dashboard/draft", async (req, res) => {
  const view = dashboardView.safeParse(req.params.dashboard);
  if (!view.success) { res.status(400).json({ error: "Unknown dashboard" }); return; }
  try {
    const org = await organisationId();
    await db.delete(drafts).where(draftScope(org, view.data, req.session.user!.id));
    res.status(204).end();
  } catch (error) { failure(req, res, error, "Unable to discard your layout draft"); }
});
router.post("/:dashboard/publish", async (req, res) => {
  const view = dashboardView.safeParse(req.params.dashboard);
  const input = layoutPublishInput.safeParse(req.body);
  if (!view.success || !input.success) { res.status(400).json({ error: "Provide valid layout revisions" }); return; }
  try {
    const org = await organisationId();
    const user = req.session.user!;
    const result = await db.transaction(async (tx) => {
      // Bootstrap inside the transaction, so failure never leaves an empty shared layout.
      await tx.insert(layouts).values({ organisationId: org, dashboard: view.data, items: [], revision: 0 }).onConflictDoNothing();
      // Shared lock first: concurrent administrators cannot overwrite each other.
      const [published] = await tx.select().from(layouts).where(publishedScope(org, view.data)).for("update").limit(1);
      const [draft] = await tx.select().from(drafts).where(draftScope(org, view.data, user.id)).for("update").limit(1);
      if (!draft || draft.revision !== input.data.expectedDraftRevision)
        throw new LayoutConflict("Your saved draft changed. Save or reload it before applying.");
      if (published.revision !== input.data.expectedRevision || published.revision !== draft.baseRevision)
        throw new LayoutConflict("Another administrator applied a newer layout. Restart from the current layout before applying.");
      const items = layoutItems.parse(draft.items);
      if (!hasAllDashboardTiles(view.data, items)) throw new LayoutConflict("The saved draft is missing dashboard tiles.");
      const revision = published.revision + 1;
      const [updated] = await tx.update(layouts).set({ items, revision, updatedAt: new Date() })
        .where(publishedScope(org, view.data)).returning();
      const [updatedDraft] = await tx.update(drafts).set({ baseRevision: revision, revision: draft.revision + 1, updatedAt: new Date() })
        .where(draftScope(org, view.data, user.id)).returning();
      return { dashboard: view.data, canEdit: true, published: document(updated), draft: document(updatedDraft) };
    });
    res.json(result);
  } catch (error) { failure(req, res, error, "Unable to apply dashboard layout"); }
});
export default router;
