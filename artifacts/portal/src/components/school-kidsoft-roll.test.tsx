import { act, cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SchoolKidsoftRoll } from "./school-kidsoft-roll";

const mocks = vi.hoisted(() => ({ read: vi.fn(), user: { type: "school" } }));
vi.mock("@/contexts/auth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@workspace/api-client-react", () => ({
  getGetSchoolKidsoftRollQueryKey: (siteId: number, params: object) => ["daily-bookings", siteId, params],
  useGetSchoolKidsoftRoll: mocks.read,
  useRefreshSchoolKidsoftRoll: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const base = { childId: "1", childName: "Alex Test", startTime: "07:00", endTime: "09:00", absent: false };
const response = {
  date: "2026-10-15", mapped: true, serviceName: "Test Service", refreshedAt: "2026-10-15T00:00:00Z", totalBookings: 4, totalChildren: 2,
  bookings: [
    { ...base, bookingId: "1", sessionName: "BeforeSchoolCare" },
    { ...base, bookingId: "2", childName: "Casey Test", childId: "2", absent: true, sessionName: "Casual BSC" },
    { ...base, bookingId: "3", sessionName: "AfterSchoolCare" },
    { ...base, bookingId: "4", childName: "Casey Test", childId: "2", sessionName: "Casual ASC" },
  ],
};
function setup() {
  return render(<QueryClientProvider client={new QueryClient()}><SchoolKidsoftRoll siteId={7} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T01:00:00Z"));
  mocks.user.type = "school";
  mocks.read.mockReset().mockReturnValue({ data: response, isLoading: false, isError: false, refetch: vi.fn() });
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });
describe("Daily Bookings school view", () => {
  it("shows today without a date picker and combines four source sessions under two green/white headings", () => {
    setup();
    expect(screen.queryByTestId("input-roll-date")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-roll-today")).toHaveTextContent("15 October 2026");
    const before = screen.getByTestId("group-session-Before School Care");
    const after = screen.getByTestId("group-session-After School Care");
    expect(within(before).getByText("Alex Test")).toBeInTheDocument();
    expect(within(before).getByText("Casey Test")).toBeInTheDocument();
    expect(within(after).getByText("Alex Test")).toBeInTheDocument();
    expect(within(after).getByText("Casey Test")).toBeInTheDocument();
    expect(within(before).getByText("Marked absent")).toBeInTheDocument();
    expect(screen.queryByTestId("text-total-bookings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-total-children")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ booked/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(2);
    expect(within(before).getByRole("heading").parentElement).toHaveClass("bg-[#1b5e20]", "text-white");
  });
  it("also hides all counts in the staff preview while keeping staff date selection available", () => {
    mocks.user.type = "staff";
    setup();
    expect(screen.getByTestId("input-roll-date")).toHaveValue("2026-10-15");
    expect(screen.queryByTestId("text-total-bookings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-total-children")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ booked/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Alex Test")).toHaveLength(2);
    expect(screen.getByText("Marked absent")).toBeInTheDocument();
  });
  it("changes the requested date at Melbourne midnight and hides the old day's cached names", () => {
    vi.setSystemTime(new Date("2026-10-15T12:59:59.900Z"));
    setup();
    expect(screen.getAllByText("Alex Test")).toHaveLength(2);
    act(() => vi.advanceTimersByTime(200));
    expect(mocks.read.mock.lastCall?.[1]).toEqual({ date: "2026-10-16" });
    expect(screen.queryByText("Alex Test")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-roll-today")).toHaveTextContent("16 October 2026");
  });
});
