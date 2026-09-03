import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { SchoolReportSummary } from "@workspace/db";
import { createSchoolReportPdf } from "./schoolReportPdf";

describe("school report PDF", () => {
  it("renders service statistics and reporting obligations into a readable PDF", async () => {
    const report = {
      id: 1,
      siteId: 1,
      reportYear: 2026,
      frequency: "term",
      period: "1",
      periodLabel: "Term 1 2026",
      statistics: {
        periodLabel: "Term 1 2026",
        termNumbers: [1],
        holidayProgramApplies: true,
        dateRange: { start: "2026-01-26", end: "2026-04-03" },
        weekdayAverages: [
          { day: "Monday", bsc: 5, asc: 8, pupilFree: 0 },
          { day: "Tuesday", bsc: 6, asc: 9, pupilFree: 0 },
          { day: "Wednesday", bsc: 7, asc: 10, pupilFree: 11 },
          { day: "Thursday", bsc: 8, asc: 11, pupilFree: 0 },
          { day: "Friday", bsc: 4, asc: 7, pupilFree: 0 },
        ],
        weeklyAverages: [
          { label: "Week 1", bsc: 6, asc: 9, pupilFree: 0 },
          { label: "Week 2", bsc: 7, asc: 8, pupilFree: 2.2 },
        ],
        holidayWeekdayAverages: [
          { day: "Monday", value: 8 },
          { day: "Tuesday", value: 9 },
          { day: "Wednesday", value: 10 },
          { day: "Thursday", value: 7 },
          { day: "Friday", value: 6 },
        ],
        holidayWeeklyAverages: [{ label: "Week 1", value: 8 }],
      },
      reportingObligations: {
        learningPlayProgramHighlights: "Children explored collaborative outdoor play.",
        teamServiceLeadership: "The team reviewed routines.",
        policyPracticeUpdates: "Policies were discussed.",
        childSafetyWellbeing: "Safety checks were completed.",
        communityFeedbackResolution: "Family feedback was reviewed.",
        focusForFuture: "Extend child-led planning.",
      },
      status: "finalized",
      createdById: 1,
      finalizedById: 1,
      finalizedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies SchoolReportSummary;

    const bytes = await createSchoolReportPdf(report, "Mahogany Rise Primary School");
    const document = await PDFDocument.load(bytes);

    expect(bytes.length).toBeGreaterThan(1_000);
    expect(document.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(document.getTitle()).toBe("Mahogany Rise Primary School - Term 1 2026");
  });
});