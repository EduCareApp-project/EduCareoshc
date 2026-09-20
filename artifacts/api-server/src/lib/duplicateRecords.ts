export type DuplicateChildRow = {
  id: number; firstName: string; lastName: string; dateOfBirth: string;
  guardianName: string; guardianEmail: string; guardianPhone: string;
  guardian2Name?: string | null; guardian2Email?: string | null; guardian2Phone?: string | null;
  siteId?: number | null; siteName?: string | null; status: string;
};

export type DuplicateGuardianRow = DuplicateChildRow;
export type SimilarityReasons = { field: string; similarity: number }[];

const clean = (value: unknown) => String(value ?? "").toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const normalizeDuplicateValue = clean;

function tokenSimilarity(a: string, b: string): number {
  const left = clean(a).split(/\s+/).filter(Boolean);
  const right = clean(b).split(/\s+/).filter(Boolean);
  if (!left.length || !right.length) return 0;
  const used = new Set<number>();
  let total = 0;
  for (const token of left) {
    let best = 0, bestIndex = -1;
    right.forEach((candidate, index) => {
      if (used.has(index)) return;
      const similarity = stringSimilarity(token, candidate);
      if (similarity > best) { best = similarity; bestIndex = index; }
    });
    if (bestIndex >= 0) { used.add(bestIndex); total += best; }
  }
  return total / Math.max(left.length, right.length);
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0]; previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = old;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

const contactSimilarity = (a: string, b: string) => {
  const left = clean(a), right = clean(b);
  return left && right ? (left === right ? 1 : stringSimilarity(left, right)) : 0;
};

export function compareChildren(a: DuplicateChildRow, b: DuplicateChildRow) {
  const fields = [
    { field: "firstName", similarity: tokenSimilarity(a.firstName, b.firstName), weight: .3 },
    { field: "lastName", similarity: tokenSimilarity(a.lastName, b.lastName), weight: .3 },
    { field: "dateOfBirth", similarity: a.dateOfBirth === b.dateOfBirth ? 1 : 0, weight: .25 },
    { field: "guardianContact", similarity: Math.max(
      contactSimilarity(a.guardianEmail, b.guardianEmail),
      contactSimilarity(a.guardianPhone, b.guardianPhone),
    ), weight: .15 },
  ];
  return { score: fields.reduce((sum, field) => sum + field.similarity * field.weight, 0),
    reasons: fields.filter((field) => field.similarity > 0).map(({ field, similarity }) => ({ field, similarity })) };
}

export type GuardianIdentity = {
  key: string; name: string; email: string; phone: string;
  childIds: number[]; siteIds: number[]; siteNames: string[];
};

export function guardianIdentities(rows: DuplicateGuardianRow[]): GuardianIdentity[] {
  const byKey = new Map<string, GuardianIdentity>();
  rows.forEach((row) => {
    for (const guardian of [
      { name: row.guardianName, email: row.guardianEmail, phone: row.guardianPhone },
      { name: row.guardian2Name, email: row.guardian2Email, phone: row.guardian2Phone },
    ]) {
      const email = clean(guardian.email);
      if (!email) continue;
      const key = `email:${email}`;
      const existing = byKey.get(key) ?? { key, name: guardian.name ?? "", email: guardian.email ?? "",
        phone: guardian.phone ?? "", childIds: [], siteIds: [], siteNames: [] };
      if (!existing.childIds.includes(row.id)) existing.childIds.push(row.id);
      if (row.siteId != null && !existing.siteIds.includes(row.siteId)) existing.siteIds.push(row.siteId);
      if (row.siteName && !existing.siteNames.includes(row.siteName)) existing.siteNames.push(row.siteName);
      byKey.set(key, existing);
    }
  });
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function compareGuardians(a: GuardianIdentity, b: GuardianIdentity) {
  const fields = [
    { field: "name", similarity: tokenSimilarity(a.name, b.name), weight: .55 },
    { field: "phone", similarity: contactSimilarity(a.phone, b.phone), weight: .30 },
    { field: "email", similarity: contactSimilarity(a.email, b.email), weight: .15 },
  ];
  return { score: fields.reduce((sum, field) => sum + field.similarity * field.weight, 0),
    reasons: fields.filter((field) => field.similarity > 0).map(({ field, similarity }) => ({ field, similarity })) };
}

export function scanDuplicateChildren(rows: DuplicateChildRow[], threshold: number) {
  const results: { first: DuplicateChildRow; second: DuplicateChildRow; score: number; reasons: SimilarityReasons }[] = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const compared = compareChildren(rows[i], rows[j]);
    if (compared.score >= threshold) {
      const [first, second] = rows[i].id <= rows[j].id ? [rows[i], rows[j]] : [rows[j], rows[i]];
      results.push({ first, second, ...compared });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.first.id - b.first.id || a.second.id - b.second.id).slice(0, 1000);
}

export function scanDuplicateGuardians(rows: DuplicateGuardianRow[], threshold: number) {
  const identities = guardianIdentities(rows), results: { first: GuardianIdentity; second: GuardianIdentity; score: number; reasons: SimilarityReasons }[] = [];
  for (let i = 0; i < identities.length; i++) for (let j = i + 1; j < identities.length; j++) {
    const compared = compareGuardians(identities[i], identities[j]);
    if (compared.score >= threshold) results.push({ first: identities[i], second: identities[j], ...compared });
  }
  return results.sort((a, b) => b.score - a.score || a.first.key.localeCompare(b.first.key)).slice(0, 1000);
}