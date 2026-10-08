import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ isEducatorRole: true, ownSiteId: 1 }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useListSites: () => ({ data: [{ id: 1, name: "Own site" }, { id: 2, name: "Other site" }] }),
  useListChildren: () => ({ data: [], isLoading: false }),
  useListJottings: () => ({ data: [], isLoading: false }),
  useListObservations: () => ({ data: [], isLoading: false }),
  useGetLearningStoriesReport: () => ({ data: {}, isLoading: false }),
  useListPosts: () => ({ data: [{ id: 1, siteId: 1, date: "2026-10-05", outcomeIds: ["4.1"] }], isLoading: false }),
  useListPlanningExperiences: () => ({
    data: [
      { id: 1, siteId: 1, startDate: "2026-10-05", stage: "planned", outcomeIds: [1] },
      { id: 2, siteId: 1, startDate: "2026-09-10", stage: "closed", outcomeIds: [1] },
      { id: 3, siteId: 1, startDate: "2026-10-12T00:00:00.000Z", stage: "planned", outcomeIds: [], frameworkLinks: "1.2 – Resilience\n2.1 – Relationships\n3.2 – Physical skills\n4.1 – Creativity\n4.2 – Problem solving\n5.1 – Communication" },
      { id: 4, siteId: 1, startDate: "2030-01-01", stage: "published", outcomeIds: [2] },
      { id: 5, siteId: 1, startDate: "2026-10-12", stage: "closed", outcomeIds: [3] },
      { id: 6, siteId: 2, startDate: "2026-10-10", stage: "planned", outcomeIds: [4] },
      { id: 7, siteId: 1, startDate: "2026-10-10", stage: "planned", outcomeIds: [5], isTemplate: true },
    ],
    isLoading: false,
  }),
}));
vi.mock("recharts", () => {
  const container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const none = () => null;
  return {
    ResponsiveContainer: container, PieChart: container, BarChart: container,
    Pie: ({ data }: { data: Array<{ count: number }> }) => <div data-testid="coverage-data">{JSON.stringify(data.map((d) => d.count))}</div>,
    Cell: none, Tooltip: none, Legend: none, Bar: none, XAxis: none, YAxis: none, CartesianGrid: none,
  };
});
import ReportsLearning from "./reports-learning";

describe("Learning compliance future planning checkbox", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T02:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to past plans and updates only the Planning graph when checked and unchecked", () => {
    render(<ReportsLearning />);
    const checkbox = screen.getByRole("checkbox", { name: "Include future plans" });
    expect(checkbox).not.toBeChecked();
    expect(screen.getAllByTestId("coverage-data")[1]).toHaveTextContent("[1,0,0,0,0]");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getAllByTestId("coverage-data")[1]).toHaveTextContent("[2,2,1,1,1]");
    expect(screen.getAllByTestId("coverage-data")[0]).toHaveTextContent("[0,0,0,1,0]");
    expect(screen.getByText(/last 7 days \+ all future open plans/)).toBeTruthy();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getAllByTestId("coverage-data")[1]).toHaveTextContent("[1,0,0,0,0]");
    expect(screen.getAllByTestId("coverage-data")[0]).toHaveTextContent("[0,0,0,1,0]");
  });
});
