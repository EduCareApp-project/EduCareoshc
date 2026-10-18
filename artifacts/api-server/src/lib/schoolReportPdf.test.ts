import { PDFDocument, PDFPage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SchoolReportSummary } from "@workspace/db";
import { createSchoolReportPdf } from "./schoolReportPdf";

function reportFixture() {
    const report = {
      organisationId: 1,
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
      finalizedPdfPath: "/objects/generated/school-reports/test-report",
      finalizedPdfName: "Elysium OSHC - Mahogany Rise Primary School - Term 1 Report - 2026.pdf",
      finalizedPdfCreatedAt: new Date(),
      archivedById: null,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies SchoolReportSummary;
    return report;
}

describe("school report PDF", () => {
  afterEach(() => vi.restoreAllMocks());
  it("renders service statistics and reporting obligations into a readable PDF", async () => {
    const report = reportFixture();
    const logo = new Uint8Array(await readFile("assets/educare-logo-dark.png"));
    const bytes = await createSchoolReportPdf(
      report,
      "Mahogany Rise Primary School",
      "Elysium OSHC",
      { emailLogoBytes: logo, companyLogoBytes: logo },
    );
    const document = await PDFDocument.load(bytes);
    const embeddedImages = document.context
      .enumerateIndirectObjects()
      .filter(([, object]) => object.toString().includes("/Subtype /Image"));

    expect(bytes.length).toBeGreaterThan(1_000);
    expect(document.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(embeddedImages.length).toBeGreaterThanOrEqual(2);
    expect(document.getTitle()).toBe(
      "Elysium OSHC - Mahogany Rise Primary School - Term 1 Report - 2026",
    );
  });
  it("centres School Report between both logos above a black divider on every page", async () => {
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    const images = vi.spyOn(PDFPage.prototype, "drawImage");
    const lines = vi.spyOn(PDFPage.prototype, "drawLine");
    const report = reportFixture();
    for (const key of Object.keys(report.reportingObligations) as Array<keyof typeof report.reportingObligations>) {
      report.reportingObligations[key] = "Children worked together to explore new activities and plan their learning. ".repeat(140) + `\nEND_OF_${key}`;
    }
    const emailLogoBytes = new Uint8Array(await readFile("assets/educare-logo-dark.png"));
    const companyLogoBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><rect width="400" height="80" fill="blue"/></svg>');
    const document = await PDFDocument.load(await createSchoolReportPdf(report, "Test School", "Test Company", {
      emailLogoBytes, companyLogoBytes,
    }));
    expect(document.getPageCount()).toBeGreaterThan(2);
    const headings = text.mock.calls.filter(([value]) => value === "School Report");
    expect(headings).toHaveLength(document.getPageCount());
    for (const [, options] of headings) {
      const width = options!.font!.widthOfTextAtSize("School Report", options!.size!);
      expect(options!.x! + width / 2).toBeCloseTo(595 / 2);
      expect(options!.y).toBeGreaterThan(776);
    }
    expect(text.mock.calls.some(([value]) => value === "EduCare")).toBe(false);
    for (const key of Object.keys(report.reportingObligations)) {
      expect(text.mock.calls.some(([value]) => value === `END_OF_${key}`)).toBe(true);
    }
    for (const [, options] of text.mock.calls.filter(([, options]) => options?.size === 10)) {
      expect(options!.y).toBeGreaterThanOrEqual(48);
      expect(options!.y).toBeLessThan(776);
    }
    expect(images.mock.calls).toHaveLength(document.getPageCount() * 2);
    for (let index = 0; index < images.mock.calls.length; index += 2) {
      const left = images.mock.calls[index][1]!;
      const right = images.mock.calls[index + 1][1]!;
      expect(left.x).toBe(48);
      expect(right.x! + right.width!).toBeCloseTo(547);
      expect(left.y).toBeGreaterThan(776);
      expect(right.y).toBeGreaterThan(776);
      expect(left.width).toBeLessThanOrEqual(120);
      expect(right.width).toBeLessThanOrEqual(120);
    }
    const dividers = lines.mock.calls.filter(([options]) => options.start.y === 776);
    expect(dividers).toHaveLength(document.getPageCount());
    expect(dividers[0][0]).toMatchObject({
      start: { x: 48, y: 776 }, end: { x: 547, y: 776 },
      color: { red: 0, green: 0, blue: 0 },
    });
  });
  it.each(["png", "jpeg", "webp", "gif"] as const)("supports the %s email-logo format accepted by Global Settings", async (format) => {
    const emailLogoBytes = await sharp({
      create: { width: 200, height: 50, channels: 4, background: "#336699" },
    }).toFormat(format).toBuffer();
    const document = await PDFDocument.load(await createSchoolReportPdf(reportFixture(), "School", "Company", { emailLogoBytes }));
    expect(document.getPageCount()).toBeGreaterThanOrEqual(2);
    const images = document.context.enumerateIndirectObjects().filter(([, object]) => object.toString().includes("/Subtype /Image"));
    expect(images.length).toBeGreaterThanOrEqual(1);
  });
  it("retains a centred heading and divider when logos have not been configured, without adding built-in branding", async () => {
    const text = vi.spyOn(PDFPage.prototype, "drawText");
    const images = vi.spyOn(PDFPage.prototype, "drawImage");
    const document = await PDFDocument.load(await createSchoolReportPdf(reportFixture(), "School"));
    expect(images).not.toHaveBeenCalled();
    expect(text.mock.calls.filter(([value]) => value === "School Report")).toHaveLength(document.getPageCount());
    expect(text.mock.calls.some(([value]) => value === "EduCare")).toBe(false);
  });
  it("rejects an unreadable configured logo instead of saving a report with a missing logo", async () => {
    await expect(createSchoolReportPdf(reportFixture(), "School", "Company", {
      emailLogoBytes: new TextEncoder().encode("not an image"),
    })).rejects.toThrow();
  });
});