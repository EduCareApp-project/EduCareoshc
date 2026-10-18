import { z } from "@workspace/api-zod";
import type { KidsoftRollBooking } from "@workspace/db";
import { tenantIntegrationSecret } from "./tenantIntegration";

export class KidsoftError extends Error {
  constructor(message = "Kidsoft could not supply the roll. The saved roll has not been changed.") {
    super(message);
  }
}

const serviceSchema = z.object({ ServiceID: z.string().uuid(), Name: z.string(), Status: z.string() });
const bookingSchema = z.object({
  BookingID: z.string(), ChildID: z.string(), BookingTypeID: z.string(),
  Date: z.string(), StartTime: z.string(), EndTime: z.string(), Absence: z.boolean(),
});
const childSchema = z.object({ ChildID: z.string(), FirstName: z.string(), LastName: z.string() });
const typeSchema = z.object({ BookingTypeID: z.string(), Name: z.string() });

export async function kidsoftConfigured(): Promise<boolean> {
  return Boolean(await tenantIntegrationSecret("kidsoft"));
}

export function kidsoftToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function request(path: string, parameters: Record<string, string | string[]> = {}): Promise<Record<string, unknown>> {
  const key = await tenantIntegrationSecret("kidsoft");
  if (!key) throw new KidsoftError("Kidsoft has not been connected. Ask your administrator to complete setup.");
  const url = new URL(`https://app.kidsoft.com.au/api/v1/Kidsoft/${path}`);
  url.searchParams.set("ServiceKey", key);
  for (const [name, value] of Object.entries(parameters)) {
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(`${name}[]`, item));
    else url.searchParams.set(name, value);
  }
  // Never log the URL, response body, child details or the underlying fetch error:
  // this API authenticates in the query string and returns sensitive child fields.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "error" });
    if (!response.ok) throw new Error("HTTP error");
    const body = await response.json() as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || body.Status !== "OK") throw new Error("API error");
    return body;
  } catch {
    throw new KidsoftError();
  }
}

function rowsForService(container: unknown, serviceId: string): unknown[] {
  if (!container || typeof container !== "object" || Array.isArray(container)) {
    // Kidsoft can return an empty array when no rows exist.
    if (Array.isArray(container) && container.length === 0) return [];
    throw new KidsoftError();
  }
  const data = (container as Record<string, unknown>)[serviceId];
  if (data === undefined && Object.keys(container).length === 0) return [];
  if (!Array.isArray(data)) throw new KidsoftError();
  return data;
}

export async function getKidsoftServices() {
  const body = await request("Service/getServices");
  const parsed = z.array(serviceSchema).safeParse(body.Services);
  if (!parsed.success) throw new KidsoftError();
  return parsed.data.filter((service) => service.Status === "Active").map((service) => ({
    id: service.ServiceID, name: service.Name,
  }));
}

/** Bookings, not attendance, define the roll; only minimal display fields survive. */
export async function getKidsoftRoll(serviceId: string, day: string): Promise<KidsoftRollBooking[]> {
  const raw = await request("Bookings/getBookings", { ServiceID: serviceId, DateFrom: day, DateTo: day });
  const parsed = z.array(bookingSchema).safeParse(rowsForService(raw.Bookings, serviceId));
  if (!parsed.success || parsed.data.some((booking) => booking.Date !== day)) throw new KidsoftError();
  const bookings = parsed.data;
  if (!bookings.length) return [];
  const ids = [...new Set(bookings.map((booking) => booking.ChildID))];
  const [childrenBody, typesBody] = await Promise.all([
    request("Children/getChildren", { ServiceID: serviceId, ChildIDs: ids }),
    request("Service/getBookingTypes", { ServiceID: serviceId }),
  ]);
  const children = z.array(childSchema).safeParse(rowsForService(childrenBody.Children, serviceId));
  const types = z.array(typeSchema).safeParse(rowsForService(typesBody.BookingTypes, serviceId));
  if (!children.success || !types.success) throw new KidsoftError();
  const byChild = new Map(children.data.map((child) => [child.ChildID, `${child.FirstName} ${child.LastName}`.trim()]));
  const byType = new Map(types.data.map((type) => [type.BookingTypeID, type.Name]));
  const seen = new Set<string>();
  return bookings.filter((booking) => {
    if (seen.has(booking.BookingID)) return false;
    seen.add(booking.BookingID);
    return true;
  }).map((booking) => {
    const childName = byChild.get(booking.ChildID);
    const sessionName = byType.get(booking.BookingTypeID);
    if (!childName || !sessionName) throw new KidsoftError();
    return {
      bookingId: booking.BookingID, childId: booking.ChildID, childName, sessionName,
      startTime: booking.StartTime, endTime: booking.EndTime, absent: booking.Absence,
    };
  }).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.childName.localeCompare(b.childName));
}
