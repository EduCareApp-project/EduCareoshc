import type { SchoolReportRow, Site } from "@workspace/db";
import type { DashboardUtilisation, UtilisationCounts, UtilisationSite } from "@workspace/api-zod";
import { metricsForDay } from "./schoolReportStatistics";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const emptyCounts = (): UtilisationCounts => ({ bsc: 0, asc: 0, pupilFree: 0, vac: 0 });

export function validCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function hasRecordedValue(value: string | null | undefined): boolean {
  if (value == null || value.trim() === "") return false;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0;
}

/**
 * Live school-report attendance, not frozen report-summary snapshots.
 * Totals count session bookings (not unique children or capacity utilisation).
 */
export function calculateSchoolUtilisation(
  sites: Pick<Site, "id" | "name" | "identifier" | "status">[],
  rows: Array<{ siteId: number; row: SchoolReportRow }>,
  startDate: string,
  endDate: string,
): DashboardUtilisation {
  const resultSites: UtilisationSite[] = sites.map((site) => ({
    siteId: site.id, siteName: site.name, identifier: site.identifier, status: site.status,
    totals: emptyCounts(), recordedSessions: emptyCounts(),
  }));
  const bySite = new Map(resultSites.map((site) => [site.siteId, site]));
  const weeks = new Map<string, {
    siteId: number; weekBeginning: string;
    bsc?: SchoolReportRow; asc?: SchoolReportRow; vac?: SchoolReportRow;
  }>();
  for (const { siteId, row } of rows) {
    if (!bySite.has(siteId)) continue;
    const service = row.serviceType.toLowerCase();
    if (service !== "bsc" && service !== "asc" && service !== "vac") continue;
    const key = `${siteId}:${row.weekBeginning}`;
    const week = weeks.get(key) ?? { siteId, weekBeginning: row.weekBeginning };
    // As in school reports, a session/week is counted once, even if report
    // configurations overlap. Prefer the most recently generated row.
    if (!week[service] || row.id > week[service].id) week[service] = row;
    weeks.set(key, week);
  }
  for (const week of weeks.values()) {
    const site = bySite.get(week.siteId)!;
    for (const [offset, day] of DAYS.entries()) {
      const date = shiftCalendarDate(week.weekBeginning, offset);
      if (date < startDate || date > endDate) continue;
      const metrics = metricsForDay(week.bsc, week.asc, day);
      for (const service of ["bsc", "asc", "pupilFree"] as const) {
        site.totals[service] += metrics[service];
      }
      const bscClosed = week.bsc?.[`${day}PupilFree`] === true;
      const ascClosed = week.asc?.[`${day}PupilFree`] === true;
      if (!bscClosed && hasRecordedValue(week.bsc?.[day])) site.recordedSessions.bsc++;
      if (!bscClosed && !ascClosed && hasRecordedValue(week.asc?.[day])) site.recordedSessions.asc++;
      if (bscClosed && !ascClosed && hasRecordedValue(week.asc?.[day])) site.recordedSessions.pupilFree++;
      if (hasRecordedValue(week.vac?.[day])) {
        site.totals.vac += Number(week.vac![day]);
        site.recordedSessions.vac++;
      }
    }
  }
  const totals = emptyCounts();
  for (const site of resultSites) {
    for (const service of ["bsc", "asc", "pupilFree", "vac"] as const) totals[service] += site.totals[service];
  }
  return { startDate, endDate, totals, sites: resultSites };
}
