export type EmergencyDrillType = "evacuation" | "lockdown" | "shelter_in_place" | "other";
export type EmergencyComplianceStatus = "current" | "expired" | "missing";

type ComplianceSite = {
  id: number;
  name: string;
};

type EmergencyRecord = {
  siteId: number | null;
  drillType: string;
  conductedAt: Date | string;
  nextDueAt: Date | string | null;
  archivedAt: Date | string | null;
};

export type EmergencyStatus = {
  siteId: number;
  siteName: string;
  drillType: EmergencyDrillType;
  status: EmergencyComplianceStatus;
  lastConducted: string | null;
  nextDue: string | null;
};

const DRILL_TYPE_ORDER: EmergencyDrillType[] = [
  "evacuation",
  "lockdown",
  "shelter_in_place",
  "other",
];

function normaliseDrillType(value: string): EmergencyDrillType {
  return DRILL_TYPE_ORDER.includes(value as EmergencyDrillType)
    ? value as EmergencyDrillType
    : "other";
}

export function buildEmergencyStatuses(
  sites: ComplianceSite[],
  records: EmergencyRecord[],
  now = new Date(),
): EmergencyStatus[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const scopedSiteIds = new Set(sites.map((site) => site.id));
  const latestBySiteAndType = new Map<string, EmergencyRecord>();

  for (const record of records) {
    if (record.siteId == null || !scopedSiteIds.has(record.siteId) || record.archivedAt) continue;
    const drillType = normaliseDrillType(record.drillType);
    const key = `${record.siteId}:${drillType}`;
    const existing = latestBySiteAndType.get(key);
    if (!existing || new Date(record.conductedAt) > new Date(existing.conductedAt)) {
      latestBySiteAndType.set(key, record);
    }
  }

  return [...sites]
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((site) => {
      const recordedTypes = new Set<EmergencyDrillType>(["evacuation"]);
      for (const key of latestBySiteAndType.keys()) {
        const [siteId, drillType] = key.split(":");
        if (Number(siteId) === site.id) recordedTypes.add(drillType as EmergencyDrillType);
      }

      return [...recordedTypes]
        .sort((a, b) => DRILL_TYPE_ORDER.indexOf(a) - DRILL_TYPE_ORDER.indexOf(b))
        .map((drillType): EmergencyStatus => {
          const record = latestBySiteAndType.get(`${site.id}:${drillType}`);
          if (!record) {
            return {
              siteId: site.id,
              siteName: site.name,
              drillType,
              status: "missing",
              lastConducted: null,
              nextDue: null,
            };
          }

          const nextDue = record.nextDueAt ? new Date(record.nextDueAt) : null;
          const isCurrent = nextDue != null && !Number.isNaN(nextDue.getTime()) && nextDue >= today;
          return {
            siteId: site.id,
            siteName: site.name,
            drillType,
            status: isCurrent ? "current" : "expired",
            lastConducted: new Date(record.conductedAt).toISOString(),
            nextDue: nextDue && !Number.isNaN(nextDue.getTime()) ? nextDue.toISOString() : null,
          };
        });
    });
}