import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const BLUE = rgb(0.29, 0.55, 0.82);
const RESPONSE_BLUE = rgb(0.1, 0.43, 0.68);
const BLACK = rgb(0.05, 0.05, 0.05);
const GREY = rgb(0.45, 0.45, 0.45);

export type ExcursionFormPdfInput = {
  organisationName: string;
  servicePhone?: string | null;
  serviceEmail?: string | null;
  managerName?: string;
  managerPhone?: string | null;
  managerEmail?: string | null;
  includeManager: boolean;
  includeManagerContact: boolean;
  includeServiceContact: boolean;
  companyLogoBytes: Uint8Array;
  excursion: {
    heading: string;
    purpose: string;
    excursionDate: string | Date;
    cost: string;
    departureTime: string;
    arrivalAtVenue: string;
    departureFromVenue: string;
    arrivalTime: string;
    transportMethod: string;
    restraintsFitted: string;
    childToStaffRatio: string;
    staffAttending: string;
    otherInformation: string;
    itemsToBring: string;
    medicalAuthorisationText: string;
  };
};

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\n]/g, " ");
}

function formatDate(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? safeText(value)
    : date.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const output: string[] = [];
  for (const paragraph of safeText(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
      } else {
        if (line) output.push(line);
        line = word;
      }
    }
    output.push(line || " ");
  }
  return output;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size = 7.4,
  color = BLACK,
  maxLines = 6,
): number {
  let fittedSize = size;
  let lines = wrap(text, font, fittedSize, width);
  while (lines.length > maxLines && fittedSize > 4.2) {
    fittedSize -= 0.3;
    lines = wrap(text, font, fittedSize, width);
  }
  const lineHeight = fittedSize + 1.7;
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, size: fittedSize, font, color }));
  return y - lines.length * lineHeight;
}

async function embedLogo(document: PDFDocument, bytes: Uint8Array): Promise<PDFImage> {
  try {
    return await document.embedPng(bytes);
  } catch {
    return document.embedJpg(bytes);
  }
}

function drawLogo(page: PDFPage, logo: PDFImage, x: number, y: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
  page.drawImage(logo, { x, y, width: logo.width * scale, height: logo.height * scale });
}

function drawSectionTitle(page: PDFPage, title: string, x: number, y: number, width: number, bold: PDFFont) {
  page.drawRectangle({ x, y, width, height: 18, color: BLUE, borderColor: BLACK, borderWidth: 0.5 });
  const size = 9;
  page.drawText(title, {
    x: x + (width - bold.widthOfTextAtSize(title, size)) / 2,
    y: y + 5,
    size,
    font: bold,
    color: rgb(1, 1, 1),
  });
}

function drawLineField(page: PDFPage, label: string, x: number, y: number, width: number, bold: PDFFont) {
  page.drawText(label, { x, y, size: 7.6, font: bold, color: BLACK });
  const labelWidth = bold.widthOfTextAtSize(label, 7.6);
  page.drawLine({ start: { x: x + labelWidth + 4, y: y - 1 }, end: { x: x + width, y: y - 1 }, thickness: 0.6, color: BLACK });
}

export async function generateExcursionFormPdf(input: ExcursionFormPdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(document, input.companyLogoBytes);

  const title = "EXCURSION PERMISSION FORM";
  page.drawText(title, {
    x: (PAGE_WIDTH - bold.widthOfTextAtSize(title, 20)) / 2,
    y: 548,
    size: 20,
    font: bold,
    color: BLACK,
  });
  page.drawLine({ start: { x: 338, y: 545 }, end: { x: 655, y: 545 }, thickness: 1.2, color: BLACK });

  let contactY = 566;
  page.drawText(safeText(input.organisationName), { x: 25, y: contactY, size: 8.5, font: bold, color: BLACK });
  contactY -= 12;
  if (input.includeManager && input.managerName) {
    page.drawText(`Manager: ${safeText(input.managerName)}`, { x: 25, y: contactY, size: 8, font: regular, color: BLACK });
    contactY -= 11;
  }
  if (input.includeManagerContact && input.managerPhone) {
    page.drawText(safeText(input.managerPhone), { x: 25, y: contactY, size: 8, font: regular, color: BLACK });
    contactY -= 11;
  }
  if (input.includeManagerContact && input.managerEmail) {
    page.drawText(safeText(input.managerEmail), { x: 25, y: contactY, size: 8, font: regular, color: BLACK });
    contactY -= 11;
  }
  if (input.includeServiceContact && input.servicePhone) {
    page.drawText(`Service: ${safeText(input.servicePhone)}`, { x: 25, y: contactY, size: 8, font: regular, color: BLACK });
    contactY -= 11;
  }
  if (input.includeServiceContact && input.serviceEmail) {
    page.drawText(safeText(input.serviceEmail), { x: 25, y: contactY, size: 8, font: regular, color: BLACK });
  }
  drawLogo(page, logo, 700, 535, 115, 45);

  const leftX = 35;
  const leftWidth = 390;
  const rightX = 451;
  const rightWidth = 356;
  const contentTop = 515;
  const contentBottom = 42;
  page.drawRectangle({ x: leftX, y: contentBottom, width: leftWidth, height: contentTop - contentBottom, borderColor: GREY, borderWidth: 0.8 });
  page.drawRectangle({ x: 433, y: contentBottom, width: 1, height: contentTop - contentBottom, color: GREY });
  page.drawRectangle({ x: rightX, y: contentBottom, width: rightWidth, height: contentTop - contentBottom, borderColor: GREY, borderWidth: 0.8 });

  drawSectionTitle(page, safeText(input.excursion.heading), leftX + 7, 474, leftWidth - 14, bold);
  const labelX = leftX + 14;
  const valueX = leftX + 175;
  const valueWidth = leftWidth - 190;
  let y = 452;
  page.drawText("Purpose of Activity:", { x: labelX, y, size: 7.6, font: bold, color: BLACK });
  y = drawWrapped(page, input.excursion.purpose, valueX, y, valueWidth, regular, 7.4, RESPONSE_BLUE, 6) - 7;

  const row = (label: string, value: string, nextY: number) => {
    page.drawText(label, { x: labelX, y: nextY, size: 7.6, font: bold, color: BLACK });
    page.drawText(safeText(value), { x: valueX, y: nextY, size: 7.6, font: regular, color: RESPONSE_BLUE });
  };
  row("Date:", formatDate(input.excursion.excursionDate), y); y -= 15;
  row("Cost:", input.excursion.cost, y); y -= 19;

  const rightLabelX = leftX + 175;
  const rightValueX = leftX + 305;
  page.drawText("Time of Departure from School:", { x: labelX, y, size: 7.2, font: bold, color: BLACK });
  page.drawText(safeText(input.excursion.departureTime), { x: labelX, y: y - 11, size: 7.4, font: regular, color: RESPONSE_BLUE });
  page.drawText("Time of arrival at Venue:", { x: rightLabelX, y, size: 7.2, font: bold, color: BLACK });
  page.drawText(safeText(input.excursion.arrivalAtVenue), { x: rightValueX, y: y - 11, size: 7.4, font: regular, color: RESPONSE_BLUE });
  y -= 32;
  page.drawText("Time of Departure from Venue:", { x: labelX, y, size: 7.2, font: bold, color: BLACK });
  page.drawText(safeText(input.excursion.departureFromVenue), { x: labelX, y: y - 11, size: 7.4, font: regular, color: RESPONSE_BLUE });
  page.drawText("Time of arrival at School:", { x: rightLabelX, y, size: 7.2, font: bold, color: BLACK });
  page.drawText(safeText(input.excursion.arrivalTime), { x: rightValueX, y: y - 11, size: 7.4, font: regular, color: RESPONSE_BLUE });
  y -= 39;
  row("Method of Transport:", input.excursion.transportMethod, y); y -= 16;
  row("Restraints fitted:", input.excursion.restraintsFitted, y); y -= 16;
  row("Child to staff ratios:", input.excursion.childToStaffRatio, y); y -= 22;
  row("Staff in attendance:", input.excursion.staffAttending, y); y -= 18;
  page.drawText("Other Information:", { x: labelX, y, size: 7.6, font: bold, color: BLACK });
  y = drawWrapped(page, input.excursion.otherInformation || "Risk assessments for this excursion have been completed.", valueX, y, valueWidth, regular, 7.2, RESPONSE_BLUE, 4) - 8;
  page.drawText("Children will need to bring:", { x: labelX, y, size: 7.6, font: bold, color: BLACK });
  drawWrapped(page, input.excursion.itemsToBring, valueX, y, valueWidth, regular, 7.1, RESPONSE_BLUE, 7);
  drawLogo(page, logo, labelX + 5, 55, 75, 75);

  const rx = rightX + 7;
  const rw = rightWidth - 14;
  drawSectionTitle(page, "M e d i c a l   D e c l a r a t i o n   &   A u t h o r i s a t i o n", rx, 485, rw - 14, bold);
  let ry = 464;
  ry = drawWrapped(page, input.excursion.medicalAuthorisationText, rx, ry, rw - 20, regular, 7.1, BLACK, 7) - 3;
  ry = drawWrapped(page, "If your child will require medication during the excursion please complete a medication form prior to the excursion date.", rx, ry, rw - 20, bold, 7.2, BLACK, 3) - 16;
  drawSectionTitle(page, "C h i l d   D e t a i l s", rx, ry, rw - 14, bold);
  ry -= 24;
  drawLineField(page, "Name(s):", rx, ry, 180, bold);
  drawLineField(page, "Age:", rx + 195, ry, 75, bold);
  ry -= 26;
  drawSectionTitle(page, "E m e r g e n c y   C o n t a c t   D e t a i l s", rx, ry, rw - 14, bold);
  ry -= 25;
  drawLineField(page, "Parent/Guardian Name:", rx, ry, 200, bold);
  drawLineField(page, "Relationship:", rx + 205, ry, 65, bold);
  ry -= 28;
  drawLineField(page, "Home Number:", rx, ry, 130, bold);
  drawLineField(page, "Work Number:", rx + 140, ry, 130, bold);
  ry -= 28;
  drawLineField(page, "Mobile Number:", rx, ry, 130, bold);
  ry -= 27;
  drawSectionTitle(page, "C o n s e n t", rx, ry, rw - 14, bold);
  ry -= 27;
  drawLineField(page, "Parent/Guardian Name:", rx, ry, 270, bold);
  ry -= 30;
  drawLineField(page, "Signature:", rx, ry, 190, bold);
  drawLineField(page, "Date:", rx + 200, ry, 70, bold);
  ry -= 35;
  drawWrapped(page, `PLEASE RETURN THE PERMISSION SLIP (THIS SIDE) TO THE MANAGER OF ${safeText(input.organisationName).toUpperCase()}.`, rx, ry, rw - 20, bold, 7.2, BLACK, 3);

  page.drawText("PLEASE     TEAR     OR     CUT     ALONG     THIS     LINE", {
    x: 438,
    y: 158,
    size: 7,
    font: bold,
    color: GREY,
    rotate: degrees(90),
  });

  return document.save();
}