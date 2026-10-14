import type { DashboardLayoutItem } from "@workspace/api-client-react";

export type DashboardKind = "educator" | "leadership";
export type LayoutItem = DashboardLayoutItem;

export const EDUCATOR_IDS = [
  "organisation-calendar", "notice-board", "service-compliance", "checklists",
  "mtop-outcomes", "missing-observations", "medication-expiry", "groceries",
] as const;
export const LEADERSHIP_IDS = [
  "posts", "jottings", "observations", "staff-compliance", "weekly-plans", "open-incidents",
  "condition-reports", "medication-expiry", "notice-board", "recent-observations",
  "roll-submissions", "recent-activity", "utilisation",
] as const;

export const WIDGET_LABELS: Record<string, string> = {
  "organisation-calendar": "Organisation calendar", "notice-board": "Notice board",
  "service-compliance": "Service compliance", checklists: "Checklists",
  "mtop-outcomes": "MTOP outcomes", "missing-observations": "Children with no active data",
  "medication-expiry": "Notifications", groceries: "Groceries",
  posts: "Posts", jottings: "Jottings", observations: "Observations",
  "staff-compliance": "Staff compliance", "weekly-plans": "Weekly plans",
  "open-incidents": "Open incidents", "condition-reports": "Open condition reports",
  "recent-observations": "Recent observations", "roll-submissions": "Roll submissions", "recent-activity": "Recent activity",
  utilisation: "Utilisation",
};

export const idsFor = (d: DashboardKind): readonly string[] => (d === "educator" ? EDUCATOR_IDS : LEADERSHIP_IDS);

const g = (i: string, x: number, y: number, w: number, h: number): LayoutItem => ({ i, x, y, w, h });

export const DEFAULT_LAYOUTS: Record<DashboardKind, LayoutItem[]> = {
  educator: [
    g("organisation-calendar", 0, 0, 4, 18), g("notice-board", 4, 0, 8, 8),
    g("service-compliance", 4, 8, 4, 9), g("checklists", 8, 8, 4, 9),
    g("mtop-outcomes", 4, 17, 4, 8), g("missing-observations", 8, 17, 4, 8),
    g("medication-expiry", 4, 25, 8, 8), g("groceries", 4, 33, 8, 3),
  ],
  leadership: [
    g("posts", 0, 0, 4, 4), g("jottings", 4, 0, 4, 4), g("observations", 8, 0, 4, 4),
    g("staff-compliance", 0, 4, 3, 4), g("weekly-plans", 3, 4, 3, 4),
    g("open-incidents", 6, 4, 3, 4), g("condition-reports", 9, 4, 3, 4),
    g("medication-expiry", 0, 8, 12, 8), g("notice-board", 0, 16, 12, 9),
    g("recent-observations", 0, 25, 12, 11), g("roll-submissions", 0, 36, 12, 12), g("recent-activity", 0, 48, 12, 12),
    g("utilisation", 0, 60, 12, 16),
  ],
};

export function minSize(id: string): { minW: number; minH: number } {
  if (id === "groceries") return { minW: 3, minH: 2 };
  if (["posts", "jottings", "observations", "staff-compliance", "weekly-plans", "open-incidents", "condition-reports"].includes(id)) return { minW: 2, minH: 3 };
  return { minW: 3, minH: 4 };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));

/** Clamp every item into the valid contract and guarantee every known id is present exactly once. */
export function normalizeItems(d: DashboardKind, items: LayoutItem[] | null | undefined): LayoutItem[] {
  const ids = idsFor(d);
  const defaults = DEFAULT_LAYOUTS[d];
  const seen = new Set<string>();
  const out: LayoutItem[] = [];
  for (const it of items ?? []) {
    if (!ids.includes(it.i) || seen.has(it.i)) continue;
    seen.add(it.i);
    const w = clamp(it.w, 2, 12), h = clamp(it.h, 2, 48);
    out.push({ i: it.i, w, h, x: clamp(it.x, 0, 12 - w), y: clamp(it.y, 0, 1000) });
  }
  let bottom = out.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  for (const id of ids) {
    if (seen.has(id)) continue;
    const def = defaults.find((x) => x.i === id)!;
    out.push({ ...def, y: Math.min(1000, bottom) });
    bottom += def.h;
  }
  return out;
}

export const sameItems = (a: LayoutItem[], b: LayoutItem[]) =>
  a.length === b.length && a.every((it) => { const o = b.find((x) => x.i === it.i); return !!o && o.x === it.x && o.y === it.y && o.w === it.w && o.h === it.h; });

export const readingOrder = (items: LayoutItem[]) => [...items].sort((a, b) => a.y - b.y || a.x - b.x);

export function errStatus(e: unknown): number | undefined {
  const s = (e as { status?: number } | null)?.status;
  return typeof s === "number" ? s : undefined;
}
