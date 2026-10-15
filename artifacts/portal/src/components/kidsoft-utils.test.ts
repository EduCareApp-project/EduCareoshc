import { describe, expect, it } from "vitest";
import { groupSchoolCareBookings, melbourneToday, millisecondsUntilMelbourneTomorrow, schoolCareSession } from "./kidsoft-utils";

describe("Daily Bookings calendar and sessions", () => {
  it("uses the Melbourne date rather than the UTC date", () => {
    expect(melbourneToday(new Date("2026-10-14T13:30:00Z"))).toBe("2026-10-15");
  });
  it.each([
    ["2026-10-15T01:00:00Z", 12],
    ["2026-10-03T14:00:00Z", 23],
    ["2026-04-04T13:00:00Z", 25],
  ])("schedules the next midnight correctly from %s, including DST", (date, hours) => {
    expect(millisecondsUntilMelbourneTomorrow(new Date(date))).toBe(Number(hours) * 60 * 60 * 1000);
  });
  it.each(["BeforeSchoolCare", "Before School Care", "Casual BSC", "BSC - Casual", "Casual Before School Care", "Early Morning"])("groups %s as Before School Care", (name) => {
    expect(schoolCareSession(name)).toBe("Before School Care");
  });
  it.each(["AfterSchoolCare", "After School Care", "Casual ASC", "ASC - Casual", "Casual After School Care", "Late Pick Up"])("groups %s as After School Care", (name) => {
    expect(schoolCareSession(name)).toBe("After School Care");
  });
  it("does not mislabel full-day or unrecognised session types", () => {
    expect(schoolCareSession("VacationCare")).toBeNull();
    expect(schoolCareSession("Curriculum Day")).toBeNull();
  });
  it("combines casual and regular bookings without removing absence flags", () => {
    const base = { bookingId: "1", childId: "1", childName: "Zed Test", startTime: "07:00", endTime: "09:00", absent: true };
    const [before, after] = groupSchoolCareBookings([
      { ...base, sessionName: "BeforeSchoolCare" },
      { ...base, bookingId: "2", childId: "2", childName: "Alex Test", absent: false, sessionName: "Casual BSC" },
      { ...base, bookingId: "3", sessionName: "Casual ASC" },
    ]);
    expect(before.bookings.map((booking) => booking.childName)).toEqual(["Alex Test", "Zed Test"]);
    expect(before.bookings[1].absent).toBe(true);
    expect(after.bookings).toHaveLength(1);
  });
});
