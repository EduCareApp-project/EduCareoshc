import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateExcursionFormPdf } from "./excursionFormPdf";

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

describe("generateExcursionFormPdf", () => {
  it("creates a branded one-page landscape permission form", async () => {
    const bytes = await generateExcursionFormPdf({
      organisationName: "Example OSHC",
      servicePhone: "03 9000 0000",
      serviceEmail: "service@example.com",
      managerName: "Alex Manager",
      managerPhone: "0400 000 000",
      managerEmail: "alex@example.com",
      includeManager: true,
      includeManagerContact: true,
      includeServiceContact: true,
      companyLogoBytes: ONE_PIXEL_PNG,
      excursion: {
        heading: "Museum Visit",
        purpose: "Explore local history",
        excursionDate: "2026-11-18",
        cost: "$12.75",
        departureTime: "8:10am",
        arrivalAtVenue: "9:05am",
        departureFromVenue: "1:35pm",
        arrivalTime: "2:30pm",
        transportMethod: "Chartered coach",
        restraintsFitted: "Lap-sash belts",
        childToStaffRatio: "1:7",
        staffAttending: "Alex, Blair and Casey",
        otherInformation: "Risk assessment completed",
        itemsToBring: "Hat, lunch and water",
        medicalAuthorisationText: "Emergency medical authorisation text",
      },
    });

    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    const page = document.getPage(0);
    expect(page.getWidth()).toBeGreaterThan(page.getHeight());
    expect(bytes.byteLength).toBeGreaterThan(2_000);
  });
});