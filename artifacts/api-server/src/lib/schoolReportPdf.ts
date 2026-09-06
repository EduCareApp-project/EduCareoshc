import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { SchoolReportSummary } from "@workspace/db";

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
  educareLogoBytes?: Uint8Array;
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
  try {
    return await document.embedPng(bytes);
  } catch {
    try {
      return await document.embedJpg(bytes);
    } catch {
      return undefined;
    }
  }
}

function fitImage(image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

function drawEduCareHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  logo?: PDFImage,
) {
  page.drawRectangle({ x: 0, y: 780, width: PAGE_WIDTH, height: 62, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: 778, width: PAGE_WIDTH, height: 2, color: BRAND_GREEN });
  let textX = MARGIN;
  if (logo) {
    const size = fitImage(logo, 30, 30);
    page.drawImage(logo, { x: MARGIN, y: 796, width: size.width, height: size.height });
    textX += size.width + 10;
  } else {
    page.drawCircle({ x: MARGIN + 14, y: 811, size: 14, color: BRAND_GREEN });
    page.drawText("E", { x: MARGIN + 9, y: 805, size: 14, font: bold, color: rgb(1, 1, 1) });
    textX += 38;
  }
  page.drawText("EduCare", { x: textX, y: 803, size: 18, font: bold, color: BLACK });
  const dividerX = textX + bold.widthOfTextAtSize("EduCare", 18) + 16;
  page.drawLine({
    start: { x: dividerX, y: 796 },
    end: { x: dividerX, y: 824 },
    thickness: 1,
    color: GRID,
  });
  page.drawText("School Report", { x: dividerX + 16, y: 805, size: 11, font: regular, color: MUTED });
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
  companyLogo?: PDFImage,
) {
  const title = `${organisationName} - ${siteName}`;
  const titleSize = 19;
  const titleWidth = bold.widthOfTextAtSize(title, titleSize);
  const logoBox = companyLogo ? 42 : 0;
  const gap = companyLogo ? 12 : 0;
  const groupWidth = logoBox + gap + titleWidth;
  const groupX = (PAGE_WIDTH - groupWidth) / 2;
  if (companyLogo) {
    const size = fitImage(companyLogo, logoBox, 38);
    page.drawImage(companyLogo, {
      x: groupX + (logoBox - size.width) / 2,
      y: 720 + (38 - size.height) / 2,
      width: size.width,
      height: size.height,
    });
  }
  page.drawText(title, {
    x: groupX + logoBox + gap,
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
  const [educareLogo, companyLogo] = await Promise.all([
    embedImage(document, branding.educareLogoBytes),
    embedImage(document, branding.companyLogoBytes),
  ]);

  const overview = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawEduCareHeader(overview, regular, bold, educareLogo);
  drawReportIdentity(overview, report, organisationName, siteName, regular, bold, companyLogo);
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
  let y = 788;
  page.drawRectangle({ x: 0, y: 824, width: PAGE_WIDTH, height: 18, color: BRAND_GREEN });
  page.drawText("EduCare", { x: MARGIN, y: 804, size: 10, font: bold, color: DEEP_GREEN });
  page.drawText("REPORTING OBLIGATIONS", { x: MARGIN, y, size: 10, font: bold, color: DEEP_GREEN });
  y -= 32;
  for (const [key, heading] of OBLIGATION_HEADINGS) {
    const lines = wrapText(report.reportingObligations[key], regular, 10, PAGE_WIDTH - MARGIN * 2);
    const required = 24 + lines.length * 14 + 18;
    if (y - required < MARGIN) {
      page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawRectangle({ x: 0, y: 824, width: PAGE_WIDTH, height: 18, color: BRAND_GREEN });
      page.drawText("EduCare", { x: MARGIN, y: 804, size: 10, font: bold, color: DEEP_GREEN });
      y = 776;
    }
    page.drawText(heading, { x: MARGIN, y, size: 13, font: bold, color: BLACK });
    y -= 19;
    for (const line of lines) {
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