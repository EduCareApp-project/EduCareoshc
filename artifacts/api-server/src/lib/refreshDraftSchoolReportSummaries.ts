import { and, asc, eq, inArray } from "drizzle-orm";
import {
  db,
  schoolReportRowsTable,
  schoolReportSummariesTable,
  schoolReportTermsTable,
} from "@workspace/db";
import { calculateSchoolReportStatistics } from "./schoolReportStatistics";

export async function refreshDraftSchoolReportSummaries(
  siteId: number,
  reportYear: number,
): Promise<void> {
  const draftReports = await db.select().from(schoolReportSummariesTable).where(and(
    eq(schoolReportSummariesTable.siteId, siteId),
    eq(schoolReportSummariesTable.reportYear, reportYear),
    eq(schoolReportSummariesTable.status, "draft"),
  ));
  if (draftReports.length === 0) return;

  const termNumbers = Array.from(new Set(
    draftReports.flatMap((report) => report.statistics.termNumbers),
  ));
  if (termNumbers.length === 0) return;

  const terms = await db.select().from(schoolReportTermsTable).where(and(
    eq(schoolReportTermsTable.siteId, siteId),
    eq(schoolReportTermsTable.reportYear, reportYear),
    inArray(schoolReportTermsTable.termNumber, termNumbers),
  )).orderBy(asc(schoolReportTermsTable.termNumber));
  if (terms.length === 0) return;

  const rows = await db.select().from(schoolReportRowsTable).where(
    inArray(schoolReportRowsTable.termId, terms.map((term) => term.id)),
  ).orderBy(asc(schoolReportRowsTable.weekNumber), asc(schoolReportRowsTable.id));

  for (const report of draftReports) {
    const reportTerms = terms
      .filter((term) => report.statistics.termNumbers.includes(term.termNumber))
      .map((term) => ({
        ...term,
        rows: rows.filter((row) => row.termId === term.id),
      }));
    const statistics = calculateSchoolReportStatistics(reportTerms, report.periodLabel);
    if (JSON.stringify(statistics) === JSON.stringify(report.statistics)) continue;

    await db.update(schoolReportSummariesTable).set({
      statistics,
      updatedAt: new Date(),
    }).where(eq(schoolReportSummariesTable.id, report.id));
  }
}