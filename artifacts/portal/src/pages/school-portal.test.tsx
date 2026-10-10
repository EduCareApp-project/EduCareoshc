import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Staff } from "@/hooks/use-schools";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SchoolPortal from "./school-portal";

const { state } = vi.hoisted(() => ({
  state: {
    user: { type: "school", siteId: 4, role: "school" },
    staff: [] as Staff[],
    visibleTabs: ["vital", "vecra", "staff", "reports", "qip", "statistics"],
  },
}));
vi.mock("@/contexts/auth", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("wouter", () => ({
  useParams: () => ({ siteId: "99" }),
  Link: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/hooks/use-permissions", () => ({ usePermissions: () => ({ isAdminOrEL: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@workspace/object-storage-web", () => ({ useUpload: () => ({ uploadFile: vi.fn(), isUploading: false }) }));
vi.mock("@/components/service-documentation-panel", () => ({ ServiceDocumentationPanel: () => <div>Service documents</div> }));
vi.mock("@/pages/qip-public", () => ({ default: () => <div>QIP content</div> }));
vi.mock("@/components/school-reports-panel", () => ({
  SchoolReportsPanel: () => <div>Manage reports</div>,
  SchoolCurrentReportsPanel: ({ siteId }: { siteId: number }) => <div>School report content for site {siteId}</div>,
}));
vi.mock("@/hooks/use-schools", () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useGetSchoolPortal: () => ({
      isLoading: false,
      data: {
        site: { id: 4, name: "Test School", address: "Test address", status: "active", isDoscel: false, createdAt: "2026-01-01T00:00:00Z" },
        staff: state.staff, vitalRecords: [], vecraVisits: [],
        portalSettings: { visibleTabs: state.visibleTabs },
      },
    }),
    useGetSchoolStaff: () => ({ data: null, isLoading: false }),
    useCreateVitalRecord: mutation, useDeleteVitalRecord: mutation,
    useCreateVecraVisit: mutation, useDeleteVecraVisit: mutation,
  };
});

describe("school portal landing tab", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    state.user = { type: "school", siteId: 4, role: "school" };
    state.staff = [];
    state.visibleTabs = ["vital", "vecra", "staff", "reports", "qip", "statistics"];
  });
  it("shows Reports first and selects it on the login landing page regardless of the saved tab order", () => {
    render(<SchoolPortal />);
    expect(screen.getAllByRole("tab")[0]).toHaveTextContent("Reports");
    expect(screen.getByRole("tab", { name: /^Reports$/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("School report content for site 4")).toBeVisible();
    expect(screen.queryByText("School report content for site 99")).not.toBeInTheDocument();
  });
  it("still allows navigation to the other visible school tabs", () => {
    render(<SchoolPortal />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "QIP" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("tab", { name: "QIP" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("QIP content")).toBeVisible();
  });
  it("returns to Reports when the school portal is loaded again", () => {
    const view = render(<SchoolPortal />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "QIP" }), { button: 0, ctrlKey: false });
    view.unmount();
    render(<SchoolPortal />);
    expect(screen.getByRole("tab", { name: "Reports" })).toHaveAttribute("aria-selected", "true");
  });
  it("respects organisation visibility settings when Reports has been disabled", () => {
    state.visibleTabs = ["staff", "qip"];
    render(<SchoolPortal />);
    expect(screen.queryByRole("tab", { name: "Reports" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Service Staff" })).toHaveAttribute("aria-selected", "true");
  });
  it("preserves the empty state when all tabs are disabled", () => {
    state.visibleTabs = [];
    render(<SchoolPortal />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.getByText("No School Portal areas are currently available.")).toBeVisible();
  });
  it("hides associated service locations from school staff cards even if older cached data contains them", () => {
    state.staff = [{
      id: 101, firstName: "Sample", lastName: "Educator", role: "educator",
      qualifications: null, status: "active", associatedSites: [{ id: 77, name: "Another Service Location" }],
    }];
    render(<SchoolPortal />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Service Staff" }), { button: 0, ctrlKey: false });
    expect(screen.getByText("Sample Educator")).toBeVisible();
    expect(screen.queryByText("Another Service Location")).not.toBeInTheDocument();
  });
  it("retains associated service locations in the internal staff view", () => {
    state.user = { type: "staff", siteId: 4, role: "admin" };
    state.staff = [{
      id: 101, firstName: "Sample", lastName: "Educator", role: "educator",
      qualifications: null, status: "active", associatedSites: [{ id: 77, name: "Another Service Location" }],
    }];
    render(<SchoolPortal />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Service Staff" }), { button: 0, ctrlKey: false });
    expect(screen.getByText("Another Service Location")).toBeVisible();
  });
  function staffTile(hasProfilePicture: boolean) {
    state.staff = [{
      id: 101, firstName: "Sample", lastName: "Educator", role: "educator",
      qualifications: null, status: "active", hasProfilePicture,
    }];
    render(<SchoolPortal />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Service Staff" }), { button: 0, ctrlKey: false });
  }
  function capturePhotoPreload() {
    const images: HTMLImageElement[] = [];
    vi.spyOn(window, "Image").mockImplementation(function () {
      const image = document.createElement("img");
      images.push(image);
      return image;
    } as unknown as typeof Image);
    return images;
  }
  it("uses the protected school-scoped profile photo on the staff tile", async () => {
    const images = capturePhotoPreload();
    staffTile(true);
    expect(images[0].src).toContain("/api/schools/4/staff/101/photo");
    fireEvent.load(images[0]);
    const photo = await screen.findByRole("img", { name: "Sample Educator" });
    expect(photo).toHaveAttribute("src", "/api/schools/4/staff/101/photo");
    expect(screen.queryByText("SE")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open profile for Sample Educator" })).toBeEnabled();
  });
  it("keeps initials without requesting a photo when a staff member has none", () => {
    const images = capturePhotoPreload();
    staffTile(false);
    expect(screen.getByText("SE")).toBeVisible();
    expect(screen.queryByRole("img", { name: "Sample Educator" })).not.toBeInTheDocument();
    expect(images).toHaveLength(0);
  });
  it("falls back to initials when the profile photo cannot load", async () => {
    const images = capturePhotoPreload();
    staffTile(true);
    fireEvent.error(images[0]);
    await waitFor(() => expect(screen.getByText("SE")).toBeVisible());
    expect(screen.queryByRole("img", { name: "Sample Educator" })).not.toBeInTheDocument();
  });
});
