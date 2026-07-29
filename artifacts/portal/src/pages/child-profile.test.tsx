/**
 * Tests for the Add Medication button in MedicalTab.
 *
 * Verifies that the button is disabled while medications are fetching
 * and re-enables once the fetch completes successfully.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MedicalTab } from "./child-profile";

// ── Mock heavy workspace packages ──────────────────────────────────────────

vi.mock("@workspace/object-storage-web", () => ({
  useUpload: () => ({ upload: vi.fn(), uploading: false }),
}));

// ── Shared mock state for the medications hook ──────────────────────────────

const medicationsHookState = {
  data: [] as { slot: number; name: string }[],
  isFetching: false,
  isSuccess: true,
};

vi.mock("@workspace/api-client-react", () => ({
  useListChildMedications: () => medicationsHookState,
  useUpdateChild: () => ({ mutate: vi.fn(), isPending: false }),
  useUpsertChildMedication: () => ({ mutate: vi.fn(), isPending: false }),
  useListMedicationLogs: () => ({ data: [], isLoading: false }),
  useCreateMedicationLog: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteMedicationLog: () => ({ mutate: vi.fn(), isPending: false }),
  getListChildMedicationsQueryKey: (id: number) => ["/api/medications", id],
  getGetChildQueryKey: (id: number) => ["/api/children", id],
  getListMedicationLogsQueryKey: (childId: number, medId: number) => [
    "/api/medication-logs",
    childId,
    medId,
  ],
  getListChildrenQueryKey: () => ["/api/children"],
}));

vi.mock("@/contexts/auth", () => ({
  useAuth: () => ({
    user: { id: 1, type: "staff", role: "admin", email: "test@test.com", name: "Admin" },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    isEducatorRole: false,
    isFullAccess: true,
    isAdmin: true,
    canDelete: true,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/timezone", () => ({
  melbourneDateTimeStr: () => "2026-07-29T10:00",
  toMelbourneDate: (v: string) => v,
  melbourneLocalToUTCISO: (v: string) => v,
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useParams: () => ({}),
  useLocation: () => ["/", vi.fn()],
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderMedicalTab(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MedicalTab
        childId={42}
        child={{ hasMedicalCondition: false }}
        staffList={[]}
        currentUserId={1}
      />
    </QueryClientProvider>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Add Medication button", () => {
  beforeEach(() => {
    // Reset to a stable baseline before each test
    medicationsHookState.data = [];
    medicationsHookState.isFetching = false;
    medicationsHookState.isSuccess = true;
  });

  it("is disabled while medications are fetching", () => {
    medicationsHookState.isFetching = true;
    medicationsHookState.isSuccess = false;

    renderMedicalTab(makeQueryClient());

    const btn = screen.getByRole("button", { name: /loading/i });
    expect(btn).toBeDisabled();
  });

  it("is enabled once the fetch completes", () => {
    medicationsHookState.isFetching = false;
    medicationsHookState.isSuccess = true;

    renderMedicalTab(makeQueryClient());

    const btn = screen.getByRole("button", { name: /add medication/i });
    expect(btn).toBeEnabled();
  });

  it("transitions from disabled to enabled when the fetch completes", async () => {
    // Start in loading state
    medicationsHookState.isFetching = true;
    medicationsHookState.isSuccess = false;

    const qc = makeQueryClient();
    const { rerender } = renderMedicalTab(qc);

    // Button should be disabled (shows "Loading…" text)
    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();

    // Simulate fetch completing
    await act(async () => {
      medicationsHookState.isFetching = false;
      medicationsHookState.isSuccess = true;

      rerender(
        <QueryClientProvider client={qc}>
          <MedicalTab
            childId={42}
            child={{ hasMedicalCondition: false }}
            staffList={[]}
            currentUserId={1}
          />
        </QueryClientProvider>
      );
    });

    // Button should now be enabled
    expect(screen.getByRole("button", { name: /add medication/i })).toBeEnabled();
  });
});
