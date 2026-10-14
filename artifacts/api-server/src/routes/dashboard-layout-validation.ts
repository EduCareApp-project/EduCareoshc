import { SaveDashboardLayoutDraftBody, PublishDashboardLayoutBody, z } from "@workspace/api-zod";

export const dashboardView = z.enum(["educator", "leadership"]);
export type DashboardView = z.infer<typeof dashboardView>;
export const dashboardTileIds = {
  educator: ["organisation-calendar", "notice-board", "service-compliance", "checklists",
    "mtop-outcomes", "missing-observations", "medication-expiry", "groceries"],
  leadership: ["posts", "jottings", "observations", "staff-compliance", "weekly-plans", "open-incidents",
    "condition-reports", "medication-expiry", "notice-board", "recent-observations", "roll-submissions", "recent-activity", "utilisation"],
} as const;
const generatedItem = SaveDashboardLayoutDraftBody.shape.items.element;
const item = generatedItem.extend({
  x: generatedItem.shape.x.int(), y: generatedItem.shape.y.int(),
  w: generatedItem.shape.w.int(), h: generatedItem.shape.h.int(),
}).strict()
  .refine((value) => value.x + value.w <= 12, "Tile extends beyond the dashboard");
export const layoutItems = z.array(item).min(1).max(32);
export const layoutDraftInput = SaveDashboardLayoutDraftBody.extend({
  items: layoutItems,
  baseRevision: SaveDashboardLayoutDraftBody.shape.baseRevision.int(),
  expectedDraftRevision: SaveDashboardLayoutDraftBody.shape.expectedDraftRevision.int(),
}).strict();
export const layoutPublishInput = PublishDashboardLayoutBody.extend({
  expectedRevision: PublishDashboardLayoutBody.shape.expectedRevision.int(),
  expectedDraftRevision: PublishDashboardLayoutBody.shape.expectedDraftRevision.int(),
}).strict();

export function hasAllDashboardTiles(view: DashboardView, items: z.infer<typeof layoutItems>) {
  const expected: readonly string[] = dashboardTileIds[view];
  return items.length === expected.length && new Set(items.map((tile) => tile.i)).size === expected.length &&
    items.every((tile) => expected.includes(tile.i));
}
export function isLayoutAdministrator(user: { type: string; role: string } | undefined) {
  return !!user && user.type === "staff" && ["director", "admin", "admin_support"].includes(user.role);
}
