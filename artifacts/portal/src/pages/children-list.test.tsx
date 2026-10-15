import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChildrenList from "./children-list";

const mocks = vi.hoisted(() => ({ loading: false }));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ isEducatorRole: false, ownSiteId: null }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useListChildren: () => ({
    isLoading: mocks.loading,
    data: mocks.loading ? undefined : [
      { id: 1, firstName: "Alex", lastName: "Example", status: "active", siteId: 7, hasMedicalCondition: true, dateOfBirth: "2018-01-01" },
      { id: 2, firstName: "Casey", lastName: "Example", status: "active", siteId: 7, hasMedications: true, dateOfBirth: "2018-01-01" },
      { id: 3, firstName: "Drew", lastName: "Example", status: "active", siteId: 8, dateOfBirth: "2018-01-01" },
      { id: 4, firstName: "Ellis", lastName: "Example", status: "active", siteId: null, hasMealConsideration: true, dateOfBirth: "2018-01-01" },
      { id: 5, firstName: "Frankie", lastName: "Example", status: "inactive", siteId: 7, hasMealConsideration: true, dateOfBirth: "2018-01-01" },
      { id: 6, firstName: "Georgina", lastName: "Example", status: "inactive", siteId: 8, dateOfBirth: "2018-01-01" },
      { id: 7, firstName: "Harper", lastName: "Example", status: "archived", siteId: 7, dateOfBirth: "2018-01-01" },
    ],
  }),
  useListSites: () => ({ data: [{ id: 7, name: "Service Seven" }, { id: 8, name: "Service Eight" }] }),
  useGetChildSettings: () => ({ data: {} }),
  getGetChildSettingsQueryKey: () => ["child-settings"],
  useGetExpiringMedications: () => ({ data: [] }),
}));
// Exercise the page's real filtering without Radix popup/portal mechanics.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select aria-label="Service filter" value={value} onChange={e => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
}));

beforeEach(() => {
  mocks.loading = false;
  window.history.replaceState(null, "", "/children");
  localStorage.removeItem("children-view");
});
afterEach(cleanup);
function expectCount(count: number) {
  expect(screen.getByTestId("children-display-count")).toHaveTextContent(String(count));
  expect(document.querySelectorAll('a[href^="/children/"]:not([href="/children/new"])')).toHaveLength(count);
}
function selectService(value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: "Service filter" }), { target: { value } });
}
function toggleMedical() {
  fireEvent.click(screen.getByRole("button", { name: /^Medical/ }));
}

describe("Children displayed count beside Medical", () => {
  it("matches the populated children through service, medical and inactive filter changes", () => {
    render(<ChildrenList />);
    expectCount(4);
    selectService("7");
    expectCount(2);
    toggleMedical();
    expectCount(2);
    fireEvent.click(screen.getByRole("button", { name: "Inactive" }));
    expectCount(1);
    selectService("all");
    expectCount(1);
    toggleMedical();
    expectCount(2);
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expectCount(7);
  });

  it("counts medical conditions, medications and meal considerations, and shows zero for no matches", () => {
    render(<ChildrenList />);
    toggleMedical();
    expectCount(3);
    selectService("none");
    expectCount(1);
    selectService("8");
    expectCount(0);
    expect(screen.getByText("No children found")).toBeInTheDocument();
  });

  it("updates for name search and stays accurate in list view", () => {
    render(<ChildrenList />);
    fireEvent.click(screen.getByTitle("List view"));
    expectCount(4);
    fireEvent.change(screen.getByPlaceholderText("Search by name..."), { target: { value: "Alex" } });
    expectCount(1);
    fireEvent.change(screen.getByPlaceholderText("Search by name..."), { target: { value: "missing" } });
    expectCount(0);
  });

  it("uses restored URL filters on initial load", () => {
    window.history.replaceState(null, "", "/children?site=7&status=inactive&medical=1");
    render(<ChildrenList />);
    expectCount(1);
    expect(screen.getByText("Frankie Example")).toBeInTheDocument();
  });

  it("does not show a misleading zero while the children are loading", () => {
    mocks.loading = true;
    render(<ChildrenList />);
    expect(screen.getByTestId("children-display-count")).toHaveTextContent("—");
    expect(screen.getByTestId("children-display-count")).toHaveAttribute("aria-label", "Loading children count");
  });
});
