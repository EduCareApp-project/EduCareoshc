import type { DashboardKind, LayoutItem } from "./dashboard-layout";

export type Rescue = { userId: number; dashboard: DashboardKind; items: LayoutItem[]; base: number; rev: number };
const key = (u: number, d: DashboardKind) => `dashboard-layout-rescue:${u}:${d}`;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const store = (): Store | null => { try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; } };

export function writeRescue(r: Rescue, s: Store | null = store()) {
  try { s?.setItem(key(r.userId, r.dashboard), JSON.stringify(r)); } catch { /* storage unavailable */ }
}
export function clearRescue(userId: number | null, d: DashboardKind, s: Store | null = store()) {
  if (userId == null) return;
  try { s?.removeItem(key(userId, d)); } catch { /* ignore */ }
}
/** Only returns a copy that belongs to this exact user and dashboard. */
export function readRescue(userId: number | null, d: DashboardKind, s: Store | null = store()): Rescue | null {
  if (userId == null) return null;
  try {
    const raw = s?.getItem(key(userId, d));
    if (!raw) return null;
    const r = JSON.parse(raw) as Rescue;
    if (r.userId !== userId || r.dashboard !== d || !Array.isArray(r.items) ||
      !Number.isInteger(r.base) || r.base < 0 || !Number.isInteger(r.rev) || r.rev < 0 ||
      !r.items.every((it) => it && typeof it.i === "string" &&
        [it.x, it.y, it.w, it.h].every((value) => typeof value === "number" && Number.isFinite(value)))) return null;
    return r;
  } catch { return null; }
}
