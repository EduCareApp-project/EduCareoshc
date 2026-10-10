import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { SchoolReportSummary } from "@workspace/db";
import sharp from "sharp";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const BRAND_GREEN = rgb(0, 0.53, 0.28);
const DEEP_GREEN = rgb(0.03, 0.32, 0.18);
const SOFT_GREEN = rgb(0.67, 0.84, 0.73);
const PALE_GREEN = rgb(0.94, 0.98, 0.95);
const BLACK = rgb(0.08, 0.1, 0.09);
const TEXT = rgb(0.15, 0.18, 0.16);
const MUTED = rgb(0.4, 0.44, 0.42);
const GRID = rgb(0.86, 0.89, 0.87);
const BSC_BLUE = rgb(0.15, 0.39, 0.92);
const ASC_ORANGE = rgb(0.98, 0.45, 0.09);
const PUPIL_FREE_PURPLE = rgb(0.49, 0.23, 0.93);
const VACATION_GREEN = rgb(0.09, 0.64, 0.29);

const OBLIGATION_HEADINGS: Array<[keyof SchoolReportSummary["reportingObligations"], string]> = [
  ["learningPlayProgramHighlights", "Learning, Play & Program Highlights"],
  ["teamServiceLeadership", "Team & Service Leadership"],
  ["policyPracticeUpdates", "Policy & Practice Updates"],
  ["childSafetyWellbeing", "Child Safety & Wellbeing"],
  ["communityFeedbackResolution", "Community Feedback & Resolution"],
  ["focusForFuture", "Our Focus for the Future"],
];

type PdfBranding = {
  emailLogoBytes?: Uint8Array;
  companyLogoBytes?: Uint8Array;
};

function formatAustralianDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

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

function centeredX(text: string, font: PDFFont, size: number): number {
  return (PAGE_WIDTH - font.widthOfTextAtSize(text, size)) / 2;
}

async function embedImage(document: PDFDocument, bytes?: Uint8Array): Promise<PDFImage | undefined> {
  if (!bytes?.length) return undefined;
  // Global email settings also accept SVG, GIF and WebP. Convert all accepted
  // logo formats to a bounded PNG rather than silently dropping non-PNG/JPEG.
  const png = await sharp(bytes, { density: 144, limitInputPixels: 16_000_000 })
    .rotate()
    .resize({ width: 800, height: 320, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return document.embedPng(png);
}

function fitImage(image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

function drawReportHeader(
  page: PDFPage,
  bold: PDFFont,
  emailLogo?: PDFImage,
  companyLogo?: PDFImage,
) {
  for (const [image, side] of [[emailLogo, "left"], [companyLogo, "right"]] as const) {
    if (!image) continue;
    const size = fitImage(image, 120, 45);
    page.drawImage(image, {
      x: side === "left" ? MARGIN : PAGE_WIDTH - MARGIN - size.width,
      y: 806 - size.height / 2,
      width: size.width,
      height: size.height,
    });
  }
  page.drawText("School Report", {
    x: centeredX("School Report", bold, 20), y: 798, size: 20, font: bold, color: BLACK,
  });
  page.drawLine({
    start: { x: MARGIN, y: 776 },
    end: { x: PAGE_WIDTH - MARGIN, y: 776 },
    thickness: 0.8,
    color: rgb(0, 0, 0),
  });
}

function reportHeading(report: SchoolReportSummary): string {
  if (report.frequency === "term") return `Term ${report.period} Report - ${report.reportYear}`;
  return `${report.periodLabel.replace(/\s+\d{4}$/, "")} Report - ${report.reportYear}`;
}

function drawReportIdentity(
  page: PDFPage,
  report: SchoolReportSummary,
  organisationName: string,
  siteName: string,
  regular: PDFFont,
  bold: PDFFont,
) {
  const title = `${organisationName} - ${siteName}`;
  const titleSize = Math.min(19, (PAGE_WIDTH - MARGIN * 2) / bold.widthOfTextAtSize(title, 1));
  page.drawText(title, {
    x: centeredX(title, bold, titleSize),
    y: 730,
    size: titleSize,
    font: bold,
    color: BLACK,
  });
  const subtitle = reportHeading(report);
  page.drawText(subtitle, {
    x: centeredX(subtitle, bold, 13),
    y: 696,
    size: 13,
    font: bold,
    color: BRAND_GREEN,
  });
  const period = `Reporting period: ${formatAustralianDate(report.statistics.dateRange.start)} to ${formatAustralianDate(report.statistics.dateRange.end)}`;
  page.drawText(period, {
    x: centeredX(period, regular, 8),
    y: 679,
    size: 8,
    font: regular,
    color: MUTED,
  });
}

function niceMaximum(value: number): number {
  const minimum = Math.max(value, 1);
  const magnitude = 10 ** Math.floor(Math.log10(minimum));
  const normalized = minimum / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function drawYAxis(
  page: PDFPage,
  left: number,
  bottom: number,
  width: number,
  height: number,
  maximum: number,
  font: PDFFont,
) {
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (maximum * tick) / 4;
    const y = bottom + (height * tick) / 4;
    page.drawLine({
      start: { x: left, y },
      end: { x: left + width, y },
      thickness: tick === 0 ? 0.8 : 0.35,
      color: tick === 0 ? MUTED : GRID,
    });
    const label = Number.isInteger(value) ? String(value) : value.toFixed(1);
    page.drawText(label, {
      x: left - font.widthOfTextAtSize(label, 6) - 5,
      y: y - 2,
      size: 6,
      font,
      color: MUTED,
    });
  }
}

function drawChartFrame(page: PDFPage, title: string, x: number, y: number, width: number, height: number, font: PDFFont) {
  page.drawRectangle({ x, y, width, height, borderColor: GRID, borderWidth: 1, color: rgb(1, 1, 1) });
  page.drawText(title, { x: x + 12, y: y + height - 20, size: 9, font, color: BLACK });
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
  const maximum = niceMaximum(Math.max(1, ...data.flatMap((item) => [item.bsc, item.asc, item.pupilFree ?? 0])));
  const left = x + 35;
  const bottom = y + 28;
  const chartWidth = width - 47;
  const chartHeight = height - 62;
  drawYAxis(page, left, bottom, chartWidth, chartHeight, maximum, font);
  const groupWidth = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.min(8, (groupWidth - 8) / 3);
  data.forEach((item, index) => {
    const baseX = left + index * groupWidth + (groupWidth - barWidth * 3 - 4) / 2;
    const values = [
      { value: item.bsc, color: BSC_BLUE },
      { value: item.asc, color: ASC_ORANGE },
      { value: item.pupilFree ?? 0, color: PUPIL_FREE_PURPLE },
    ];
    values.forEach(({ value, color }, valueIndex) => {
      page.drawRectangle({
        x: baseX + valueIndex * (barWidth + 2),
        y: bottom,
        width: barWidth,
        height: (value / maximum) * chartHeight,
        color,
      });
    });
    page.drawText(item.day.slice(0, 3), {
      x: left + index * groupWidth + groupWidth / 2 - 7,
      y: y + 11,
      size: 6,
      font,
      color: MUTED,
    });
  });
  const legend = [
    { label: "BSC", color: BSC_BLUE, x: x + width - 112 },
    { label: "ASC", color: ASC_ORANGE, x: x + width - 72 },
    { label: "PF", color: PUPIL_FREE_PURPLE, x: x + width - 32 },
  ];
  legend.forEach((item) => {
    page.drawRectangle({ x: item.x, y: y + height - 20, width: 6, height: 6, color: item.color });
    page.drawText(item.label, { x: item.x + 9, y: y + height - 20, size: 6, font, color: MUTED });
  });
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
  const maximum = niceMaximum(Math.max(1, ...data.flatMap((item) => [item.bsc, item.asc, item.pupilFree ?? 0])));
  const left = x + 35;
  const bottom = y + 28;
  const chartWidth = width - 47;
  const chartHeight = height - 62;
  drawYAxis(page, left, bottom, chartWidth, chartHeight, maximum, font);
  const gap = data.length > 1 ? chartWidth / (data.length - 1) : 0;
  const series = [
    { key: "bsc" as const, color: BSC_BLUE },
    { key: "asc" as const, color: ASC_ORANGE },
    { key: "pupilFree" as const, color: PUPIL_FREE_PURPLE },
  ];
  for (const { key, color } of series) {
    for (let index = 1; index < data.length; index += 1) {
      page.drawLine({
        start: {
          x: left + (index - 1) * gap,
          y: bottom + ((data[index - 1][key] ?? 0) / maximum) * chartHeight,
        },
        end: {
          x: left + index * gap,
          y: bottom + ((data[index][key] ?? 0) / maximum) * chartHeight,
        },
        thickness: 1.6,
        color,
      });
    }
    data.forEach((item, index) => {
      page.drawCircle({
        x: left + index * gap,
        y: bottom + ((item[key] ?? 0) / maximum) * chartHeight,
        size: 2,
        color,
      });
    });
  }
  data.forEach((item, index) => {
    if (data.length <= 10 || index % Math.ceil(data.length / 8) === 0 || index === data.length - 1) {
      page.drawText(item.label.replace("Week ", "W"), {
        x: left + index * gap - 5,
        y: y + 11,
        size: 5.5,
        font,
        color: MUTED,
      });
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
  drawChartFrame(page, "Average Vacation Care Usage by Day", x, y, width, height, font);
  const data = report.statistics.holidayWeekdayAverages;
  const maximum = niceMaximum(Math.max(1, ...data.map((item) => item.value)));
  const left = x + 35;
  const bottom = y + 28;
  const chartWidth = width - 47;
  const chartHeight = height - 62;
  drawYAxis(page, left, bottom, chartWidth, chartHeight, maximum, font);
  const groupWidth = chartWidth / Math.max(data.length, 1);
  const barWidth = Math.min(20, groupWidth * 0.45);
  data.forEach((item, index) => {
    page.drawRectangle({
      x: left + index * groupWidth + (groupWidth - barWidth) / 2,
      y: bottom,
      width: barWidth,
      height: (item.value / maximum) * chartHeight,
      color: VACATION_GREEN,
    });
    page.drawText(item.day.slice(0, 3), {
      x: left + index * groupWidth + groupWidth / 2 - 7,
      y: y + 11,
      size: 6,
      font,
      color: MUTED,
    });
  });
}

function average(values: number[]): number {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)) * 10) / 10;
}

function drawAveragePanel(
  page: PDFPage,
  report: SchoolReportSummary,
  regular: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  page.drawRectangle({ x, y, width, height, color: PALE_GREEN, borderColor: SOFT_GREEN, borderWidth: 1 });
  page.drawRectangle({ x, y: y + height - 5, width, height: 5, color: BRAND_GREEN });
  page.drawText("AVERAGE SERVICE", { x: x + 15, y: y + height - 31, size: 8, font: bold, color: DEEP_GREEN });
  page.drawText("ATTENDANCES", { x: x + 15, y: y + height - 43, size: 8, font: bold, color: DEEP_GREEN });
  page.drawText("Average daily numbers", { x: x + 15, y: y + height - 62, size: 7, font: regular, color: MUTED });

  const weekday = report.statistics.weekdayAverages;
  const entries: Array<{ label: string; value: number; color: ReturnType<typeof rgb> }> = [
    { label: "Before School Care", value: average(weekday.map((item) => item.bsc)), color: BSC_BLUE },
    { label: "After School Care", value: average(weekday.map((item) => item.asc)), color: ASC_ORANGE },
  ];
  const vacationValues = report.statistics.holidayWeekdayAverages
    .map((item) => item.value)
    .filter((value) => value > 0);
  if (report.statistics.holidayProgramApplies !== false && vacationValues.length) {
    entries.push({ label: "Vacation Care", value: average(vacationValues), color: VACATION_GREEN });
  }

  entries.forEach((entry, index) => {
    const cardTop = y + height - 94 - index * 92;
    page.drawRectangle({
      x: x + 12,
      y: cardTop - 63,
      width: width - 24,
      height: 68,
      color: rgb(1, 1, 1),
      borderColor: GRID,
      borderWidth: 0.6,
    });
    const labelLines = wrapText(entry.label, regular, 7.5, width - 42);
    labelLines.slice(0, 2).forEach((line, lineIndex) => {
      page.drawText(line, {
        x: x + 22,
        y: cardTop - 13 - lineIndex * 10,
        size: 7.5,
        font: regular,
        color: MUTED,
      });
    });
    page.drawText(String(entry.value), {
      x: x + 22,
      y: cardTop - 51,
      size: 22,
      font: bold,
      color: entry.color,
    });
  });
}

export async function createSchoolReportPdf(
  report: SchoolReportSummary,
  siteName: string,
  organisationName = "Elysium OSHC",
  branding: PdfBranding = {},
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const [emailLogo, companyLogo] = await Promise.all([
    embedImage(document, branding.emailLogoBytes),
    embedImage(document, branding.companyLogoBytes),
  ]);

  const overview = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawReportHeader(overview, bold, emailLogo, companyLogo);
  drawReportIdentity(overview, report, organisationName, siteName, regular, bold);
  overview.drawText("SERVICE DATA", { x: MARGIN, y: 654, size: 9, font: bold, color: DEEP_GREEN });

  const chartsWidth = 326;
  const summaryX = MARGIN + chartsWidth + 14;
  const summaryWidth = PAGE_WIDTH - MARGIN - summaryX;
  const hasVacationCare = report.statistics.holidayProgramApplies !== false
    && report.statistics.holidayWeekdayAverages.some((item) => item.value > 0);
  drawWeekdayBars(overview, report, regular, MARGIN, 443, chartsWidth, 194);
  drawWeeklyLines(overview, report, regular, MARGIN, 239, chartsWidth, 190);
  if (hasVacationCare) {
    drawHolidayBars(overview, report, regular, MARGIN, 47, chartsWidth, 178);
  }
  drawAveragePanel(
    overview,
    report,
    regular,
    bold,
    summaryX,
    hasVacationCare ? 47 : 239,
    summaryWidth,
    hasVacationCare ? 590 : 398,
  );

  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = 740;
  drawReportHeader(page, bold, emailLogo, companyLogo);
  page.drawText("REPORTING OBLIGATIONS", { x: MARGIN, y, size: 10, font: bold, color: DEEP_GREEN });
  y -= 32;
  for (const [key, heading] of OBLIGATION_HEADINGS) {
    const lines = wrapText(report.reportingObligations[key], regular, 10, PAGE_WIDTH - MARGIN * 2);
    const required = 24 + lines.length * 14 + 18;
    // Keep short sections together, but allow a long section to continue onto
    // additional pages without writing through the new header or off the page.
    const minimumSpace = required <= 740 - MARGIN ? required : 56;
    if (y - minimumSpace < MARGIN) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawReportHeader(page, bold, emailLogo, companyLogo);
      y = 740;
    }
    page.drawText(heading, { x: MARGIN, y, size: 13, font: bold, color: BLACK });
    y -= 19;
    for (const line of lines) {
      if (y < MARGIN + 14) {
        page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawReportHeader(page, bold, emailLogo, companyLogo);
        y = 740;
        page.drawText(`${heading} (continued)`, { x: MARGIN, y, size: 13, font: bold, color: BLACK });
        y -= 19;
      }
      page.drawText(line, { x: MARGIN, y, size: 10, font: regular, color: TEXT });
      y -= 14;
    }
    y -= 18;
  }

  document.setTitle(`${organisationName} - ${siteName} - ${reportHeading(report)}`);
  document.setSubject("School Report");
  document.setCreator("EduCare");
  return document.save();
}