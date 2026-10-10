import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { UtilisationSection, validateRange } from "./utilisation-section";

const { hook, refetch } = vi.hoisted(() => ({ hook: vi.fn(), refetch: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({ useGetDashboardUtilisation: hook }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: unknown }) => <pre data-testid="booking-chart">{JSON.stringify(data)}</pre>,
  Bar: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null, CartesianGrid: () => null,
}));
const initial = { startDate: "2026-09-28", endDate: "2026-10-04" };
const report = {
  ...initial,
  totals: { bsc: 100, asc: 50, pupilFree: 20, vac: 0 },
  sites: [
    { siteId: 1, siteName: "Mahogany", identifier: "MAH", status: "active",
      totals: { bsc: 100, asc: 50, pupilFree: 20, vac: 0 }, recordedSessions: { bsc: 2, asc: 2, pupilFree: 1, vac: 1 } },
    { siteId: 2, siteName: "Another site", identifier: null, status: "inactive",
      totals: { bsc: 0, asc: 0, pupilFree: 0, vac: 0 }, recordedSessions: { bsc: 0, asc: 0, pupilFree: 0, vac: 0 } },
  ],
};
function state(overrides = {}) {
  return { data: report, isFetching: false, isError: false, refetch, ...overrides };
}
function submit() {
  fireEvent.submit(screen.getByRole("button", { name: "Apply" }).closest("form")!);
}

describe("Leadership utilisation section", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T02:00:00Z"));
    hook.mockReset();
    refetch.mockReset();
    hook.mockImplementation((params) => state({ data: { ...report, ...params } }));
  });
  afterEach(() => vi.useRealTimers());
  it.each([
    ["2026-10-09T02:00:00Z", "2026-09-28", "2026-10-04"],
    ["2026-10-11T02:00:00Z", "2026-09-28", "2026-10-04"],
    ["2026-10-12T02:00:00Z", "2026-10-05", "2026-10-11"],
    ["2026-10-11T12:59:00Z", "2026-09-28", "2026-10-04"],
    ["2026-10-11T13:00:00Z", "2026-10-05", "2026-10-11"],
    ["2026-10-04T15:00:00Z", "2026-09-28", "2026-10-04"],
    ["2027-01-01T02:00:00Z", "2026-12-21", "2026-12-27"],
    ["2027-01-04T02:00:00Z", "2026-12-28", "2027-01-03"],
  ])("defaults to the previous completed Melbourne week at %s", (now, startDate, endDate) => {
    vi.setSystemTime(new Date(now));
    render(<UtilisationSection />);
    expect(screen.getByLabelText("Start date")).toHaveValue(startDate);
    expect(screen.getByLabelText("End date (inclusive)")).toHaveValue(endDate);
    expect(hook.mock.lastCall?.[0]).toEqual({ startDate, endDate });
  });
  it("renders three columns, three graphs, and exact totals for every site and session", () => {
    render(<UtilisationSection />);
    expect(screen.getByText("Utilisation Data")).toBeTruthy();
    expect(screen.getAllByTestId("booking-chart")).toHaveLength(3);
    expect(screen.getByTestId("text-utilisation-total-bsc")).toHaveTextContent("100");
    expect(screen.getByTestId("text-utilisation-total-asc")).toHaveTextContent("70");
    const table = screen.getByRole("table");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Site", "Before School Care", "After School Care", "Pupil-free days", "Vacation Care", "Total",
    ]);
    expect(screen.getByTestId("row-utilisation-1")).toHaveTextContent("Mahogany (MAH)");
    const row = within(screen.getByTestId("row-utilisation-1"));
    expect(row.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["100", "50", "20", "0", "170"]);
    expect(screen.getByTestId("row-utilisation-2")).toHaveTextContent("inactive");
    const overall = within(table).getByRole("row", { name: /Overall total/ });
    expect(within(overall).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["100", "50", "20", "0", "170"]);
    const data = JSON.parse(screen.getAllByTestId("booking-chart")[1].textContent!);
    expect(data[0]).toMatchObject({ asc: 50, pupilFree: 20 });
    expect(hook.mock.lastCall?.[0]).toEqual(initial);
    expect(hook.mock.lastCall?.[1].query).toMatchObject({ refetchInterval: 60_000, refetchOnWindowFocus: true });
  });
  it("shows recorded zero as 0 and missing records as a dash, including the combined row total", () => {
    render(<UtilisationSection />);
    expect(within(screen.getByTestId("row-utilisation-1")).getByText("0")).toBeTruthy();
    expect(within(screen.getByTestId("row-utilisation-2")).getAllByText("No records")).toHaveLength(5);
  });
  it("adds all four categories once for mixed and zero-only sites", () => {
    hook.mockReturnValue(state({ data: {
      ...report,
      totals: { bsc: 100, asc: 50, pupilFree: 20, vac: 30 },
      sites: [
        { ...report.sites[0], totals: { bsc: 100, asc: 50, pupilFree: 20, vac: 30 } },
        { ...report.sites[1], recordedSessions: { bsc: 1, asc: 0, pupilFree: 0, vac: 0 } },
      ],
    } }));
    render(<UtilisationSection />);
    expect(within(screen.getByTestId("row-utilisation-1")).getAllByRole("cell").map((cell) => cell.textContent))
      .toEqual(["100", "50", "20", "30", "200"]);
    const zeroRow = within(screen.getByTestId("row-utilisation-2"));
    expect(zeroRow.getAllByText("0")).toHaveLength(2);
    expect(zeroRow.getAllByText("No records")).toHaveLength(3);
    expect(within(screen.getByRole("row", { name: /Overall total/ })).getAllByRole("cell").at(-1))
      .toHaveTextContent("200");
  });
  it("applies changed dates only on submit and supports inclusive single-day ranges", () => {
    render(<UtilisationSection />);
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("End date (inclusive)"), { target: { value: "2026-10-01" } });
    expect(hook.mock.lastCall?.[0]).toEqual(initial);
    submit();
    expect(hook.mock.lastCall?.[0]).toEqual({ startDate: "2026-10-01", endDate: "2026-10-01" });
    expect(screen.getByTestId("text-utilisation-range")).toHaveTextContent("Showing 1 Oct 2026 to 1 Oct 2026");
  });
  it("rejects reversed dates without replacing the applied range or its results", () => {
    render(<UtilisationSection />);
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-11" } });
    submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Start date must be on or before");
    expect(hook.mock.lastCall?.[0]).toEqual(initial);
    expect(screen.getAllByTestId("booking-chart")).toHaveLength(3);
    expect(validateRange("2026-02-30", "2026-03-01")).not.toBeNull();
  });
  it("refreshes when applying the same dates", () => {
    render(<UtilisationSection />);
    submit();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
  it("hides mismatched old data while the new range loads", () => {
    hook.mockReturnValue(state({ isFetching: true }));
    render(<UtilisationSection />);
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-10-01" } });
    submit();
    expect(screen.queryAllByTestId("booking-chart")).toHaveLength(0);
    expect(screen.getByTestId("state-utilisation-loading")).toHaveAttribute("aria-busy", "true");
  });
  it("shows an explicit loading/error state and lets the user retry", () => {
    hook.mockReturnValue(state({ data: undefined, isError: true }));
    render(<UtilisationSection />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryAllByTestId("booking-chart")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
  it("warns when refreshing fails rather than silently presenting cached totals as current", () => {
    hook.mockReturnValue(state({ isError: true }));
    render(<UtilisationSection />);
    expect(screen.getByRole("alert")).toHaveTextContent("last retrieved totals");
    expect(screen.getAllByTestId("booking-chart")).toHaveLength(3);
  });
  it("handles an empty site list", () => {
    hook.mockReturnValue(state({ data: { ...report, sites: [] } }));
    render(<UtilisationSection />);
    expect(screen.getByTestId("state-utilisation-empty")).toHaveTextContent("No sites");
  });
});
