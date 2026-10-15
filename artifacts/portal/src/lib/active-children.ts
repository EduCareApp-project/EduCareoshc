/** Match profiles by ID and status, never by name (names can be duplicated). */
export function onlyActiveChildren<T extends { id: number; status: string }>(children: readonly T[]): T[] {
  return children.filter((child) => child.status === "active");
}

/** General/group records stay visible; child-linked records need an active child. */
export function hasActiveChildLink(childIds: readonly number[], activeIds: ReadonlySet<number>): boolean {
  return childIds.length === 0 || childIds.some((id) => activeIds.has(id));
}
