export const EDUCATOR_QUALS = [
  "Staff Details (DET)",
  "WWCC",
  "Child Safety - Mandatory Reporting and Other Obligations",
];

export const RP_QUALS = [
  "Child Safety - Mandatory Reporting and Other Obligations",
  "CPR Renewal",
  "Education Qualifications",
  "First Aid",
  "Food Safety",
  "History & Compliance",
  "Responsible Person Declaration",
  "Risk Management (DET)",
  "Staff Details (DET)",
  "WWCC",
];

export const CANNOT_WORK_QUALS = ["WWCC", "CPR Renewal", "First Aid"];

export type QualItem = { name: string; status: string; expiryDate?: Date | string | null; archivedAt?: Date | string | null };
export type QualLevel = "cannot-work" | "responsible-person" | "educator" | "incomplete";

export interface QualLevelConfig {
  cannotWorkQuals?: string[];
  responsiblePersonQuals?: string[];
  educatorQuals?: string[];
}

export function isQualExpired(q: QualItem): boolean {
  const now = new Date();
  const d = q.expiryDate instanceof Date ? q.expiryDate : q.expiryDate ? new Date(String(q.expiryDate)) : null;
  return Boolean((d && !isNaN(d.getTime()) && d < now) || q.status === "expired");
}

export function computeQualLevel(quals: QualItem[], config?: QualLevelConfig): QualLevel {
  const active = quals.filter((q) => !q.archivedAt);
  const cannotWork = config?.cannotWorkQuals ?? CANNOT_WORK_QUALS;
  const rpQuals   = config?.responsiblePersonQuals ?? RP_QUALS;
  const edQuals   = config?.educatorQuals ?? EDUCATOR_QUALS;

  const expiredNames = new Set(active.filter(isQualExpired).map((q) => q.name));
  if (cannotWork.some((n) => expiredNames.has(n))) return "cannot-work";
  const currentNames = new Set(active.filter((q) => !isQualExpired(q)).map((q) => q.name));
  if (rpQuals.every((n) => currentNames.has(n))) return "responsible-person";
  if (edQuals.every((n) => currentNames.has(n))) return "educator";
  return "incomplete";
}

export const QUAL_LEVEL_LABELS: Record<QualLevel, string> = {
  "cannot-work": "Cannot Work",
  "responsible-person": "Responsible Person",
  educator: "Educator",
  incomplete: "Incomplete",
};

export const QUAL_LEVEL_STYLES: Record<QualLevel, string> = {
  "cannot-work": "bg-red-100 text-red-800 border-red-200",
  "responsible-person": "bg-green-100 text-green-800 border-green-200",
  educator: "bg-blue-100 text-blue-800 border-blue-200",
  incomplete: "bg-amber-100 text-amber-800 border-amber-200",
};
