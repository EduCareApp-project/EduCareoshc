import { writeFile } from "node:fs/promises";
import { generateExcursionFormPdf } from "../../artifacts/api-server/src/lib/excursionFormPdf";

const logo = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
const pdf = await generateExcursionFormPdf({
  organisationName: "Elysium OSHC",
  managerName: "Matthew Hine",
  managerPhone: "0406 877 787",
  managerEmail: "matt@elysiumoshc.com.au",
  servicePhone: "(03) 8595 3022",
  serviceEmail: "admin@elysiumoshc.com.au",
  includeManager: true,
  includeManagerContact: true,
  includeServiceContact: true,
  companyLogoBytes: logo,
  excursion: {
    heading: "Forgotten Island Movie",
    purpose: "As part of the Holiday Program, Elysium has arranged an excursion to cinemas in Cowes to see the Forgotten Island Movie (PG).",
    excursionDate: "2026-09-23",
    cost: "$120.00",
    departureTime: "10:00 AM",
    arrivalAtVenue: "10:15 AM",
    departureFromVenue: "1:15 PM",
    arrivalTime: "1:30 PM",
    transportMethod: "Private Vehicles - Staff Vehicles",
    restraintsFitted: "Yes",
    childToStaffRatio: "1:4 (Maximum of 8 Children)",
    staffAttending: "Matthew Hine & Anishia Williams",
    otherInformation: "Risk assessments for today's excursion have been completed. Please view them in the section above the form.",
    itemsToBring: "A packed lunch and snack for morning tea. Children will also need to bring a water bottle and jacket for cold weather.",
    medicalAuthorisationText: "In the event of an emergency, illness, or accident concerning my child, and if the nominated contact people cannot be reached, I authorise the educator/person in charge to consent to my child receiving medical, dental, or surgical treatment as deemed necessary by a medical practitioner or hospital.",
  },
});
await writeFile(".agents/outputs/revised-excursion-form.pdf", pdf);
