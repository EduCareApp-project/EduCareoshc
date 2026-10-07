import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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
});
