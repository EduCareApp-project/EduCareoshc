import { describe, expect, it } from "vitest";
import type { OrganisationCalendarEvent } from "@workspace/api-client-react";
import { eventsOnDay, gridDays, isValidYmd, parseYmd, timeLabel } from "./organisation-calendar-utils";

const event: OrganisationCalendarEvent = {
  id: 1, organisationId: 1, siteId: null, title: "Team meeting", description: "", location: "",
  startDate: "2026-09-30", endDate: "2026-10-02", startTime: null, endTime: null,
  createdBy: 1, createdAt: "", updatedAt: "", canEdit: true,
};
describe("organisation month calendar", () => {
  it.each(Array.from({ length: 12 }, (_, month) => month))("covers every day with complete Monday–Sunday weeks for month %i", (month) => {
    const days = gridDays(new Date(2026, month, 1));
    expect(days.length % 7).toBe(0);
    expect(parseYmd(days[0]).getDay()).toBe(1);
    expect(parseYmd(days.at(-1)!).getDay()).toBe(0);
    const count = new Date(2026, month + 1, 0).getDate();
    expect(days.filter((day) => parseYmd(day).getMonth() === month)).toHaveLength(count);
    expect(new Set(days).size).toBe(days.length);
  });
  it("validates actual dates and leap years", () => {
    expect(isValidYmd("2026-02-30")).toBe(false);
    expect(isValidYmd("2026-02-29")).toBe(false);
    expect(isValidYmd("2028-02-29")).toBe(true);
    expect(isValidYmd("14/10/2026")).toBe(false);
  });
  it("includes multi-day events across month boundaries and excludes other days", () => {
    expect(eventsOnDay([event], "2026-10-01")).toEqual([event]);
    expect(eventsOnDay([event], "2026-10-02")).toEqual([event]);
    expect(eventsOnDay([event], "2026-10-03")).toEqual([]);
  });
  it("lists all-day events before timed events, then in time order", () => {
    const later = { ...event, id: 2, startTime: "15:00" };
    const earlier = { ...event, id: 3, startTime: "09:00" };
    expect(eventsOnDay([later, earlier, event], "2026-10-01").map((e) => e.id)).toEqual([1, 3, 2]);
    expect(timeLabel(event)).toBe("All day");
    expect(timeLabel(earlier)).toBe("9:00 AM");
  });
});
