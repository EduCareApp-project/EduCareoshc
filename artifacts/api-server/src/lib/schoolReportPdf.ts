import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SchoolReportSummary } from "@workspace/db";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const BLUE = rgb(0.12, 0.36, 0.68);
const ORANGE = rgb(0.93, 0.48, 0.16);
const GREEN = rgb(0.2, 0.62, 0.42);
const PURPLE = rgb(0.49, 0.28, 0.78);
const TEXT = rgb(0.15, 0.18, 0.23);
const MUTED = rgb(0.42, 0.46, 0.52);

const OBLIGATION_HEADINGS: Array<[keyof SchoolReportSummary["reportingObligations"], string]> = [
  ["learningPlayProgramHighlights", "Learning, Play & Program Highlights"],
  ["teamServiceLeadership", "Team & Service Leadership"],
  ["policyPracticeUpdates", "Policy & Practice Updates"],
  ["childSafetyWellbeing", "Child Safety & Wellbeing"],
  ["communityFeedbackResolution", "Community Feedback & Resolution"],
  ["focusForFuture", "Our Focus for the Future"],
];

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = (text || "No information provided.").split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line || " ");
  }
  return lines;
}

function drawChartFrame(page: PDFPage, title: string, x: number, y: number, width: number, height: number, font: PDFFont) {
  page.drawRectangle({ x, y, width, height, borderColor: rgb(0.82, 0.84, 0.87), borderWidth: 1 });
  page.drawText(title, { x: x + 12, y: y + height - 22, size: 11, font, color: TEXT });
}

function drawWeekdayBars(
  page: PDFPage,
  report: SchoolReportSummary,
  font: PDFFont,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  drawChartFrame(page, "Average Usage by Day", x, y, width, height, font);
  const data = report.statistics.weekdayAverages;
  const max = Math.max(1, ...data.flatMap((item) => [item.bsc, item.asc, item.pupilFree ?? 0]));
  const chartBottom = y + 34;
  const chartHeight = height - 72;
  const groupWidth = (width - 34) / data.length;
  data.forEach((item, index) => {
    const baseX = x + 20 + index * groupWidth;
    const bscHeight = (item.bsc / max) * chartHeight;
    const ascHeight = (item.asc / max) * chartHeight;
    const pupilFreeHeight = ((item.pupilFree ?? 0) / max) * chartHeight;
    page.drawRectangle({ x: baseX + 2, y: chartBottom, width: 10, height: bscHeight, color: BLUE });
    page.drawRectangle({ x: baseX + 14, y: chartBottom, width: 10, height: ascHeight, color: ORANGE });
    page.drawRectangle({ x: baseX + 26, y: chartBottom, width: 10, height: pupilFreeHeight, color: PURPLE });
    page.drawText(item.day.slice(0, 3), { x: baseX + 5, y: y + 14, size: 7, font, color: MUTED });
  });
  page.drawRectangle({ x: x + width - 175, y: y + height - 23, width: 7, height: 7, color: BLUE });
  page.drawText("BSC", { x: x + width - 164, y: y + height - 23, size: 7, font, color: MUTED });
  page.drawRectangle({ x: x + width - 129, y: y + height - 23, width: 7, height: 7, color: ORANGE });
  page.drawText("ASC", { x: x + width - 118, y: y + height - 23, size: 7, font, color: MUTED });
  page.drawRectangle({ x: x + width - 83, y: y + height - 23, width: 7, height: 7, color: PURPLE });
  page.drawText("Pupil Free", { x: x + width - 72, y: y + height - 23, size: 7, font, color: MUTED });
}

function drawWeeklyLines(
  page: PDFPage,
  report: SchoolReportSummary,
  font: PDFFont,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  drawChartFrame(page, "Average Daily Usage by Week", x, y, width, height, font);
  const data = report.statistics.weeklyAverages;
  const max = Math.max(1, ...data.flatMap((item) => [item.bsc, item.asc, item.pupilFree ?? 0]));
  const left = x + 25;
  const bottom = y + 34;
  const usableWidth = width - 50;
  const usableHeight = height - 70;
  const gap = data.length > 1 ? usableWidth / (data.length - 1) : 0;
  for (let index = 1; index < data.length; index += 1) {
    const previous = data[index - 1];
    const current = data[index];
    page.drawLine({
      start: { x: left + (index - 1) * gap, y: bottom + (previous.bsc / max) * usableHeight },
      end: { x: left + index * gap, y: bottom + (current.bsc / max) * usableHeight },
      thickness: 2,
      color: BLUE,
    });
    page.drawLine({
      start: { x: left + (index - 1) * gap, y: bottom + (previous.asc / max) * usableHeight },
      end: { x: left + index * gap, y: bottom + (current.asc / max) * usableHeight },
      thickness: 2,
      color: ORANGE,
    });
    page.drawLine({
      start: { x: left + (index - 1) * gap, y: bottom + ((previous.pupilFree ?? 0) / max) * usableHeight },
      end: { x: left + index * gap, y: bottom + ((current.pupilFree ?? 0) / max) * usableHeight },
      thickness: 2,
      color: PURPLE,
    });
  }
  data.forEach((item, index) => {
    const pointX = left + index * gap;
    page.drawCircle({ x: pointX, y: bottom + (item.bsc / max) * usableHeight, size: 2.5, color: BLUE });
    page.drawCircle({ x: pointX, y: bottom + (item.asc / max) * usableHeight, size: 2.5, color: ORANGE });
    page.drawCircle({ x: pointX, y: bottom + ((item.pupilFree ?? 0) / max) * usableHeight, size: 2.5, color: PURPLE });
    if (data.length <= 14 || index % Math.ceil(data.length / 12) === 0) {
      page.drawText(item.label, { x: pointX - 7, y: y + 13, size: 5.5, font, color: MUTED, rotate: undefined });
    }
  });
}

function drawHolidayBars(
  page: PDFPage,
  report: SchoolReportSummary,
  font: PDFFont,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  drawChartFrame(page, "Average Holiday Program Usage by Day", x, y, width, height, font);
  const data = report.statistics.holidayWeekdayAverages;
  const max = Math.max(1, ...data.map((item) => item.value));
  data.forEach((item, index) => {
    const rowY = y + height - 50 - index * 28;
    page.drawText(item.day, { x: x + 14, y: rowY + 4, size: 8, font, color: MUTED });
    page.drawRectangle({
      x: x + 82,
      y: rowY,
      width: ((width - 115) * item.value) / max,
      height: 13,
      color: GREEN,
    });
    page.drawText(String(item.value), { x: x + width - 27, y: rowY + 3, size: 7, font, color: TEXT });
  });
}

export async function createSchoolReportPdf(report: SchoolReportSummary, siteName: string): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  const overview = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  overview.drawText("School Report", { x: MARGIN, y: 780, size: 25, font: bold, color: TEXT });
  overview.drawText(siteName, { x: MARGIN, y: 752, size: 15, font: bold, color: BLUE });
  overview.drawText(report.periodLabel, { x: MARGIN, y: 731, size: 11, font: regular, color: MUTED });
  overview.drawText("SERVICE STATISTICS", { x: MARGIN, y: 690, size: 10, font: bold, color: MUTED });
  drawWeekdayBars(overview, report, bold, MARGIN, 444, 499, 220);
  drawWeeklyLines(overview, report, bold, MARGIN, 205, 499, 215);
  drawHolidayBars(overview, report, bold, MARGIN, 38, 499, 145);

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = 788;
  page.drawText("REPORTING OBLIGATIONS", { x: MARGIN, y, size: 10, font: bold, color: MUTED });
  y -= 32;
  for (const [key, heading] of OBLIGATION_HEADINGS) {
    const lines = wrapText(report.reportingObligations[key], regular, 10, PAGE_WIDTH - MARGIN * 2);
    const required = 24 + lines.length * 14 + 18;
    if (y - required < MARGIN) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = 788;
    }
    page.drawText(heading, { x: MARGIN, y, size: 13, font: bold, color: TEXT });
    y -= 19;
    for (const line of lines) {
      page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: TEXT });
      y -= 14;
    }
    y -= 18;
  }

  document.setTitle(`${siteName} - ${report.periodLabel}`);
  document.setSubject("School Report");
  document.setCreator("EduCare");
  return document.save();
}