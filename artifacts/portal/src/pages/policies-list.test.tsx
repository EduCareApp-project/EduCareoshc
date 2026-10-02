import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PoliciesList from "./policies-list";

const mocks = vi.hoisted(() => ({
  policies: [] as unknown[],
  acks: [] as unknown[],
  addDist: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useListPolicies: () => ({ data: mocks.policies, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreatePolicy: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePolicy: () => ({ mutate: mocks.update, isPending: false }),
  useDeletePolicy: () => ({ mutate: vi.fn(), isPending: false }),
  useAcknowledgePolicy: () => ({ mutate: vi.fn(), isPending: false }),
  useAddPolicyDistribution: () => ({ mutate: mocks.addDist, isPending: false }),
  useGetPolicyAcknowledgments: () => ({ data: mocks.acks, isLoading: false, isError: false }),
  getListPoliciesQueryKey: () => ["/api/policies"],
  getGetPolicyAcknowledgmentsQueryKey: (id: number) => [`/api/policies/${id}/acknowledgments`],
}));
vi.mock("@/hooks/use-active-staff", () => ({
  useActiveStaff: () => ({ data: [{ id: 5, firstName: "Mia", lastName: "Tran", role: "educator", status: "active" }] }),
}));
vi.mock("@/hooks/use-permissions", () => ({ usePermissions: () => ({ isAdminOrEL: true, ownId: 1 }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@workspace/object-storage-web", () => ({ useUpload: () => ({ uploadFile: vi.fn(), isUploading: false }) }));

function pol(id: number, o: Record<string, unknown> = {}) {
  return { id, title: `Policy ${id}`, category: "Safety", versionNumber: 2, requiresAcknowledgment: "yes",
    isActive: true, distributedStaffIds: [], acknowledgedStaffIds: [], createdAt: "2024-01-01", ...o };
}
function renderPage() {
  const qc = new QueryClient();
  const spy = vi.spyOn(qc, "invalidateQueries");
  render(<QueryClientProvider client={qc}><PoliciesList /></QueryClientProvider>);
  return spy;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("edu_selected_staff_id", "5");
  mocks.addDist.mockReset(); mocks.update.mockReset();
  mocks.acks = [];
  mocks.policies = [
    pol(1), pol(2, { distributedStaffIds: [5] }),
    pol(3, { isActive: false, acknowledgedStaffIds: [5] }),
    pol(4, { isActive: false }),
  ];
});

describe("PoliciesList", () => {
  it("shows all active policies and add button only where staff not distributed", () => {
    renderPage();
    expect(screen.getByTestId("row-policy-1")).toBeTruthy();
    expect(screen.getByTestId("row-policy-2")).toBeTruthy();
    expect(screen.getByTestId("button-add-distribution-1")).toBeTruthy();
    expect(screen.queryByTestId("button-add-distribution-2")).toBeNull();
  });

  it("collapses only signed inactive policies for selected staff", () => {
    mocks.acks = [{ id: 1, policyId: 3, staffId: 5, policyVersion: 1, acknowledgedAt: "2024-02-01T00:00:00Z" }];
    renderPage();
    expect(screen.queryByTestId("row-policy-3")).toBeNull();
    fireEvent.click(screen.getByTestId("button-toggle-inactive"));
    expect(screen.getByTestId("row-policy-3")).toBeTruthy();
    expect(screen.queryByTestId("row-policy-4")).toBeNull();
    expect(screen.getByTestId("badge-signed-3").textContent).toContain("v1");
  });

  it("adds to distribution and invalidates the list", async () => {
    mocks.addDist.mockImplementation((_v, o) => o.onSuccess());
    const spy = renderPage();
    fireEvent.click(screen.getByTestId("button-add-distribution-1"));
    expect(mocks.addDist.mock.calls[0][0]).toEqual({ id: 1, data: { staffId: 5 } });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["/api/policies"] });
  });

  it("deactivates with status-only payload after confirmation", async () => {
    localStorage.removeItem("edu_selected_staff_id");
    renderPage();
    fireEvent.click(screen.getByTestId("button-status-1"));
    expect(await screen.findByText(/history are preserved|acknowledgement history are preserved/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("button-confirm-status-1"));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][0]).toEqual({ id: 1, data: { isActive: false } });
  });
});
