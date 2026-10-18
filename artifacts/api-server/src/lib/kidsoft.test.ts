import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getKidsoftRoll, getKidsoftServices, KidsoftError } from "./kidsoft";
vi.mock("./tenantIntegration", () => ({
  tenantIntegrationSecret: async () => "unit-test-key-not-a-credential",
}));

const serviceId = "10000000-0000-4000-8000-000000000001";
const child = { ChildID: "child-1", FirstName: "Test", LastName: "Child", DOB: "2018-01-01", CRN: "private" };
const booking = {
  BookingID: "booking-1", ChildID: child.ChildID, BookingTypeID: "bsc",
  Date: "2026-10-15", StartTime: "07:00", EndTime: "09:00", Absence: true, Fee: 999,
};
const fetchMock = vi.fn();
function response(body: object, ok = true) { return { ok, json: async () => body }; }
function mockRoll(overrides: { children?: unknown; bookings?: unknown; types?: unknown } = {}) {
  fetchMock.mockImplementation(async (url: URL) => {
    if (url.pathname.endsWith("Bookings/getBookings")) return response({ Status: "OK", Bookings: { [serviceId]: overrides.bookings ?? [booking] } });
    if (url.pathname.endsWith("Children/getChildren")) return response({ Status: "OK", Children: { [serviceId]: overrides.children ?? [child] } });
    return response({ Status: "OK", BookingTypes: { [serviceId]: overrides.types ?? [{ BookingTypeID: "bsc", Name: "BeforeSchoolCare" }] } });
  });
}

beforeEach(() => {
  vi.stubEnv("KIDSOFT_SERVICE_KEY", "unit-test-key-not-a-credential");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Kidsoft read-only adapter", () => {
  it("lists active services only", async () => {
    fetchMock.mockResolvedValue(response({ Status: "OK", Services: [
      { ServiceID: serviceId, Name: "Active service", Status: "Active" },
      { ServiceID: "20000000-0000-4000-8000-000000000002", Name: "Archived", Status: "Archived" },
    ] }));
    expect(await getKidsoftServices()).toEqual([{ id: serviceId, name: "Active service" }]);
  });
  it("reads exactly one day and only booked children; strips sensitive fields and preserves absence", async () => {
    mockRoll();
    expect(await getKidsoftRoll(serviceId, booking.Date)).toEqual([{
      bookingId: "booking-1", childId: "child-1", childName: "Test Child",
      sessionName: "BeforeSchoolCare", startTime: "07:00", endTime: "09:00", absent: true,
    }]);
    const bookingUrl: URL = fetchMock.mock.calls[0][0];
    expect(bookingUrl.searchParams.get("DateFrom")).toBe(booking.Date);
    expect(bookingUrl.searchParams.get("DateTo")).toBe(booking.Date);
    const childUrl = fetchMock.mock.calls.map(([url]) => url as URL).find((url) => url.pathname.includes("Children"))!;
    expect(childUrl.searchParams.getAll("ChildIDs[]")).toEqual(["child-1"]);
    expect(childUrl.searchParams.get("ServiceID")).toBe(serviceId);
    expect(childUrl.searchParams.has("Options")).toBe(false);
    expect(fetchMock.mock.calls.every(([, options]) => options.method === undefined)).toBe(true);
  });
  it("treats HTTP 200 Status Error as failure without exposing provider messages", async () => {
    fetchMock.mockResolvedValue(response({ Status: "Error", Message: "sensitive provider message" }));
    await expect(getKidsoftRoll(serviceId, booking.Date)).rejects.toThrow(KidsoftError);
    await expect(getKidsoftServices()).rejects.not.toThrow("sensitive provider message");
  });
  it("does not request children when the day has zero bookings", async () => {
    mockRoll({ bookings: [] });
    expect(await getKidsoftRoll(serviceId, booking.Date)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("fails rather than silently saving an incomplete roll with a missing child", async () => {
    mockRoll({ children: [] });
    await expect(getKidsoftRoll(serviceId, booking.Date)).rejects.toThrow(KidsoftError);
  });
  it("fails rather than silently saving a roll from another day", async () => {
    mockRoll({ bookings: [{ ...booking, Date: "2026-10-14" }] });
    await expect(getKidsoftRoll(serviceId, booking.Date)).rejects.toThrow(KidsoftError);
  });
  it("fails if session labels are missing", async () => {
    mockRoll({ types: [] });
    await expect(getKidsoftRoll(serviceId, booking.Date)).rejects.toThrow(KidsoftError);
  });
  it("deduplicates repeated BookingIDs but retains separate session bookings for one child", async () => {
    mockRoll({ bookings: [booking, booking, { ...booking, BookingID: "booking-2" }] });
    expect(await getKidsoftRoll(serviceId, booking.Date)).toHaveLength(2);
  });
  it("never substitutes a different service's child records", async () => {
    fetchMock.mockImplementation(async (url: URL) => url.pathname.includes("Children")
      ? response({ Status: "OK", Children: { otherService: [child] } })
      : url.pathname.includes("Bookings/getBookings")
        ? response({ Status: "OK", Bookings: { [serviceId]: [booking] } })
        : response({ Status: "OK", BookingTypes: { [serviceId]: [] } }));
    await expect(getKidsoftRoll(serviceId, booking.Date)).rejects.toThrow(KidsoftError);
  });
});
