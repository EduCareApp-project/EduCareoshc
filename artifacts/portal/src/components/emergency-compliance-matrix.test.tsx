import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import type { Site, ServiceComplianceReport } from "@workspace/api-client-react";
import { EmergencyComplianceMatrix } from "./emergency-compliance-matrix";

const site = (id: number, name: string, identifier: string | null, status: Site["status"] = "active"): Site =>
  ({ id, name, identifier, status, createdAt: "2024-01-01" });
const sites = [site(1, "Alpha", "ALP"), site(2, "Beta", null), site(3, "Gamma", "GAM", "closed")];
const report = {
  emergencyStatuses: [
    { siteId: 1, siteName: "Alpha", drillType: "evacuation", status: "current", lastConducted: "2025-01-01T00:00:00Z", nextDue: "2025-07-01T00:00:00Z" },
    { siteId: 2, siteName: "Beta", drillType: "evacuation", status: "expiring", lastConducted: null, nextDue: "2025-07-01T00:00:00Z" },
    { siteId: 1, siteName: "Alpha", drillType: "lockdown", status: "expired", lastConducted: null, nextDue: "2025-01-01T00:00:00Z" },
  ],
} as unknown as ServiceComplianceReport;

describe("EmergencyComplianceMatrix", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it("renders four rows with active sites only", () => {
    render(<EmergencyComplianceMatrix sites={sites} report={report} />);
    for (const t of ["evacuation", "lockdown", "shelter_in_place", "other"]) {
      expect(within(screen.getByTestId(`emergency-row-${t}`)).getAllByRole("img")).toHaveLength(2);
    }
    expect(screen.queryByText("GAM")).toBeNull();
  });
  it("shows ticks, cross, missing and blank code", () => {
    render(<EmergencyComplianceMatrix sites={sites} report={report} />);
    const evac = screen.getByTestId("emergency-row-evacuation");
    expect(within(evac).getAllByTestId("icon-tick")).toHaveLength(2);
    const lock = screen.getByTestId("emergency-row-lockdown");
    expect(within(lock).getByTestId("icon-cross")).toBeTruthy();
    expect(within(lock).getByTestId("icon-none")).toBeTruthy();
    const beta = screen.getByTestId("emergency-tile-evacuation-2");
    expect(beta.textContent).toContain("—");
    expect(beta.getAttribute("aria-label")).toMatch(/Beta.*Safety Evacuation Drill.*Expiring soon.*Code not assigned/);
    expect(screen.getByTestId("emergency-tile-other-1").getAttribute("aria-label")).toMatch(/No record/);
  });
  it("scopes to selected site", () => {
    render(<EmergencyComplianceMatrix sites={sites} report={report} selectedSiteId={1} />);
    expect(within(screen.getByTestId("emergency-row-other")).getAllByRole("img")).toHaveLength(1);
  });
  it("handles loading and errors", () => {
    const { rerender } = render(<EmergencyComplianceMatrix sites={undefined} report={undefined} sitesLoading />);
    expect(screen.getByTestId("emergency-matrix-loading")).toBeTruthy();
    expect(screen.queryByTestId("emergency-matrix-empty")).toBeNull();
    rerender(<EmergencyComplianceMatrix sites={sites} report={undefined} reportError />);
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(<EmergencyComplianceMatrix sites={undefined} report={report} sitesError />);
    expect(screen.getByRole("alert").textContent).toMatch(/Services/);
  });

  it("collapses each heading independently and restores its state after remount", () => {
    const preferenceKey = "emergency-test-user";
    const { unmount } = render(<EmergencyComplianceMatrix sites={sites} report={report} preferenceKey={preferenceKey} />);
    const evacuation = screen.getByRole("button", { name: "Safety Evacuation Drill" });
    fireEvent.click(evacuation);
    fireEvent.click(screen.getByRole("button", { name: "Lockdown Drill" }));
    expect(evacuation).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("emergency-tile-evacuation-1")).not.toBeVisible();
    expect(screen.getByTestId("emergency-tile-lockdown-1")).not.toBeVisible();
    expect(screen.getByTestId("emergency-tile-other-1")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(preferenceKey)!)).toEqual({ evacuation: true, lockdown: true });

    unmount();
    render(<EmergencyComplianceMatrix sites={sites} report={report} preferenceKey={preferenceKey} />);
    expect(screen.getByRole("button", { name: "Safety Evacuation Drill" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Lockdown Drill" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Other Emergency Record" })).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Safety Evacuation Drill" }));
    expect(screen.getByTestId("emergency-tile-evacuation-1")).toBeVisible();
    expect(JSON.parse(localStorage.getItem(preferenceKey)!)).toEqual({ evacuation: false, lockdown: true });
  });

  it("keeps the saved state when changing the site filter", () => {
    const { rerender } = render(<EmergencyComplianceMatrix sites={sites} report={report} preferenceKey="emergency-filter-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Other Emergency Record" }));
    rerender(<EmergencyComplianceMatrix sites={sites} report={report} preferenceKey="emergency-filter-test" selectedSiteId={1} />);
    expect(screen.getByRole("button", { name: "Other Emergency Record" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("emergency-tile-other-1")).not.toBeVisible();
  });

  it("keeps different accounts' preferences separate", () => {
    localStorage.setItem("emergency-account-a", JSON.stringify({ evacuation: true }));
    const { rerender } = render(<EmergencyComplianceMatrix key="a" sites={sites} report={report} preferenceKey="emergency-account-a" />);
    expect(screen.getByRole("button", { name: "Safety Evacuation Drill" })).toHaveAttribute("aria-expanded", "false");
    rerender(<EmergencyComplianceMatrix key="b" sites={sites} report={report} preferenceKey="emergency-account-b" />);
    expect(screen.getByRole("button", { name: "Safety Evacuation Drill" })).toHaveAttribute("aria-expanded", "true");
    rerender(<EmergencyComplianceMatrix key="a" sites={sites} report={report} preferenceKey="emergency-account-a" />);
    expect(screen.getByRole("button", { name: "Safety Evacuation Drill" })).toHaveAttribute("aria-expanded", "false");
  });

  it("ignores invalid saved states without preventing the report from loading", () => {
    localStorage.setItem("emergency-invalid", JSON.stringify({ evacuation: "false", lockdown: true, other: 1 }));
    render(<EmergencyComplianceMatrix sites={sites} report={report} preferenceKey="emergency-invalid" />);
    expect(screen.getByRole("button", { name: "Safety Evacuation Drill" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Lockdown Drill" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Other Emergency Record" })).toHaveAttribute("aria-expanded", "true");
  });

  it("still toggles headings and warns if the browser cannot save preferences", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<EmergencyComplianceMatrix sites={sites} report={report} preferenceKey="emergency-unavailable" />);
    fireEvent.click(screen.getByRole("button", { name: "Lockdown Drill" }));
    expect(screen.getByRole("button", { name: "Lockdown Drill" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("status")).toHaveTextContent("couldn’t save");
  });
});
