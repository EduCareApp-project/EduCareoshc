/**
 * Tests for the 'Cannot Work' badge behaviour when a network error interrupts
 * the second of two back-to-back archive operations.
 *
 * Scenario:
 *   1. Staff member has two expired CANNOT_WORK_QUALS (WWCC + CPR Renewal).
 *   2. The first archive succeeds — badge must still show "Cannot Work" because
 *      the second expired qual is still active.
 *   3. The second archive returns a 500 / network error — the badge must stay
 *      "Cannot Work" and a destructive error toast must be shown.
 *   4. After the error is cleared and the second archive succeeds, the badge
 *      must disappear (level is no longer "cannot-work").
 *
 * Test strategy
 * -------------
 * Pure-function suite: directly exercises `computeQualLevel` to prove the badge
 * logic for every combination of archived/expired quals.
 *
 * Component suite: drives the real UI path using @testing-library/user-event
 * (Radix UI components require pointer-event simulation, not just fireEvent).
 * Flow: click Qualifications tab → click archive icon → confirm AlertDialog →
 * assert toast / badge state.  The archive mutation mock is controlled via
 * `archiveBehaviour` to simulate immediate success or immediate 500-error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffProfile from "./staff-profile";

// ─── Pure-function tests ──────────────────────────────────────────────────────

import { computeQualLevel, type QualItem } from "@/lib/qual-level";

const expiredWwcc: QualItem  = { name: "WWCC",        status: "expired", expiryDate: null, archivedAt: null };
const expiredCpr: QualItem   = { name: "CPR Renewal", status: "expired", expiryDate: null, archivedAt: null };
const archivedWwcc: QualItem = { ...expiredWwcc, archivedAt: new Date("2026-01-01") };
const archivedCpr: QualItem  = { ...expiredCpr,  archivedAt: new Date("2026-01-01") };

describe("computeQualLevel — partial-archive network-error scenario", () => {
  it("returns 'cannot-work' when both CANNOT_WORK_QUALS are expired", () => {
    expect(computeQualLevel([expiredWwcc, expiredCpr])).toBe("cannot-work");
  });

  it("still returns 'cannot-work' after first qual is archived but second remains expired", () => {
    // DB state after the first archive succeeds but the second is interrupted by
    // a network error — the second qual is NOT archived.
    expect(computeQualLevel([archivedWwcc, expiredCpr])).toBe("cannot-work");
  });

  it("no longer returns 'cannot-work' once both quals are archived", () => {
    expect(computeQualLevel([archivedWwcc, archivedCpr])).not.toBe("cannot-work");
  });

  it("returns 'cannot-work' if only the second qual is archived but the first remains expired", () => {
    // Order independence: archiving the second one alone is not enough.
    expect(computeQualLevel([expiredWwcc, archivedCpr])).toBe("cannot-work");
  });

  it("treats archivedAt: null as still-active — never removes the expired qual from consideration", () => {
    expect(computeQualLevel([{ name: "WWCC", status: "expired", expiryDate: null, archivedAt: null }])).toBe("cannot-work");
  });
});

// ─── Component tests ──────────────────────────────────────────────────────────

/**
 * Controls what the archive mutation mock does when mutate() is called.
 *   "success" → onSuccess fires immediately (happy path).
 *   "error"   → onError fires immediately (simulates 500 / network error).
 *   "pending" → neither fires (simulates in-flight request).
 */
let archiveBehaviour: "success" | "error" | "pending" = "success";

// Shared mutable hook data; updated per-test via beforeEach.
const qualHookState: { data: QualItem[]; isLoading: boolean } = {
  data: [],
  isLoading: false,
};

// Captures every mutate() invocation so tests can inspect the args.
const archiveCalls: { id: number; onSuccess?: () => void; onError?: () => void }[] = [];

// Toast spy shared across tests.
const toastSpy = vi.fn();

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@workspace/api-client-react", () => ({
  useGetStaff: () => ({
    data: {
      id: 1, firstName: "Alex", lastName: "Smith", email: "alex@test.com",
      phone: null, role: "educator", status: "active", qualifications: "",
      wwccNumber: null, siteId: null, bio: null, employmentNotes: null,
      profilePicturePath: null, createdAt: "2026-01-01T00:00:00.000Z",
    },
    isLoading: false,
  }),
  getGetStaffQueryKey:              (id: number) => [`/api/staff/${id}`],
  useUpdateStaff:                   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteStaff:                   () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveStaff:                  () => ({ mutate: vi.fn(), isPending: false }),
  useListSites:                     () => ({ data: [] }),
  useGetStaffProfessionalDevelopment: () => ({ data: [], isLoading: false }),
  getGetStaffProfessionalDevelopmentQueryKey: (id: number) => [`/api/staff/${id}/pd`],
  useCreateProfessionalDevelopment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProfessionalDevelopment: () => ({ mutate: vi.fn(), isPending: false }),
  useGetStaffQualifications:        () => qualHookState,
  getGetStaffQualificationsQueryKey:(id: number) => [`/api/staff/${id}/qualifications`],
  useCreateStaffQualification:      () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateStaffQualification:      () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteQualificationDocument:   () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveStaffQualification: () => ({
    mutate: vi.fn((args: { id: number }, cbs?: { onSuccess?: () => void; onError?: () => void }) => {
      archiveCalls.push({ id: args.id, onSuccess: cbs?.onSuccess, onError: cbs?.onError });
      if (archiveBehaviour === "success") cbs?.onSuccess?.();
      if (archiveBehaviour === "error")   cbs?.onError?.();
    }),
    isPending: false,
  }),
  useGetFeatureSettings:            () => ({ data: null }),
  getGetFeatureSettingsQueryKey:    () => ["/api/feature-settings"],
}));

vi.mock("@workspace/object-storage-web", () => ({
  useUpload: () => ({ uploadFile: vi.fn(), isUploading: false }),
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    isEducatorRole: false,
    canManageQualifications: true,
    isAdminOrEL: true,
    ownId: null,
  }),
}));

vi.mock("@/hooks/use-staff-roles", () => ({
  useStaffRoles: () => [
    { value: "admin",    label: "Admin" },
    { value: "educator", label: "Educator" },
  ],
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock("wouter", () => ({
  useParams:   () => ({ id: "1" }),
  useLocation: () => ["/staff/1", vi.fn()],
  Link:     ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Redirect: () => null,
}));

vi.mock("./appraisals-tab", () => ({ default: () => <div>Appraisals</div> }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeJsx(qc: QueryClient) {
  return (
    <QueryClientProvider client={qc}>
      <StaffProfile />
    </QueryClientProvider>
  );
}

/**
 * Renders the profile and activates the Qualifications tab.
 * Uses userEvent (not fireEvent) because Radix Tabs triggers on pointer events.
 */
async function renderAndOpenQualificationsTab(qc: QueryClient) {
  const user = userEvent.setup();
  const utils = render(makeJsx(qc));
  const qualTab = screen.getByRole("tab", { name: /qualifications/i });
  await user.click(qualTab);
  return { ...utils, user };
}

/**
 * Clicks the Nth archive icon button (title="Archive record") and confirms
 * the AlertDialog.  Returns after the dialog confirm button is clicked.
 */
async function archiveQualByIndex(user: ReturnType<typeof userEvent.setup>, index: number) {
  const archiveBtns = screen.getAllByTitle("Archive record");
  await user.click(archiveBtns[index]);
  // The AlertDialog opens; click the confirm "Archive" action button.
  const confirmBtn = await screen.findByRole("button", { name: /^Archive$/ });
  await user.click(confirmBtn);
}

// ── Component tests ───────────────────────────────────────────────────────────

describe("StaffProfile — 'Cannot Work' badge during interrupted archive", () => {
  beforeEach(() => {
    qualHookState.data = [expiredWwcc, expiredCpr];
    qualHookState.isLoading = false;
    archiveBehaviour = "success";
    archiveCalls.length = 0;
    toastSpy.mockClear();
  });

  it("shows 'Cannot Work' badge on the Profile tab when both CANNOT_WORK_QUALS are expired", () => {
    // The Profile tab is active by default; badge is shown in the Details card.
    // The qual-level badge renders as a <span>; the Qualifications tab also has a
    // static legend <Badge> (div) that always shows "Cannot Work" — we use the
    // `selector` option throughout to target only the dynamic qual-level <span>.
    render(makeJsx(makeQueryClient()));
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("badge stays 'Cannot Work' after first qual is archived successfully (second still expired)", async () => {
    const qc = makeQueryClient();
    const { rerender, user } = await renderAndOpenQualificationsTab(qc);

    // Both quals are expired → qual-level "Cannot Work" span is present.
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);

    // Click the first archive icon and confirm the dialog.
    await archiveQualByIndex(user, 0);

    // mutate() was called once with onSuccess; check archiveCalls.
    expect(archiveCalls).toHaveLength(1);

    // Simulate the query invalidation/refetch: WWCC archived, CPR still expired.
    await act(async () => {
      qualHookState.data = [archivedWwcc, expiredCpr];
      rerender(makeJsx(qc));
    });

    // One CANNOT_WORK_QUAL is still active and expired → badge must remain.
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("shows a destructive error toast and badge stays 'Cannot Work' when the second archive returns 500", async () => {
    // State: first qual already archived, second (CPR Renewal) still expired.
    qualHookState.data = [archivedWwcc, expiredCpr];
    // Configure the mock to immediately call onError (simulates a 500 response).
    archiveBehaviour = "error";

    const qc = makeQueryClient();
    const { user } = await renderAndOpenQualificationsTab(qc);

    // CPR Renewal is still expired → qual-level "Cannot Work" span is present.
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);

    // Click the archive icon for CPR Renewal and confirm the dialog.
    await archiveQualByIndex(user, 0);

    // mutate() was called; archiveBehaviour = "error" so onError fired → toast.
    expect(archiveCalls).toHaveLength(1);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    );

    // Badge must STILL show "Cannot Work" span — CPR Renewal was NOT archived.
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("badge clears after the second archive succeeds following an error-then-retry", async () => {
    // State: first qual (WWCC) already archived, second (CPR Renewal) still expired.
    qualHookState.data = [archivedWwcc, expiredCpr];

    const qc = makeQueryClient();
    const { rerender, user } = await renderAndOpenQualificationsTab(qc);

    // ── Attempt 1: second archive fails (500) ─────────────────────────────────
    archiveBehaviour = "error";
    await archiveQualByIndex(user, 0);

    // Captured the mutate call; onError fired.
    expect(archiveCalls).toHaveLength(1);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    );
    // The qual-level span badge remains — CPR not archived.
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);

    // ── Attempt 2: retry succeeds ─────────────────────────────────────────────
    archiveBehaviour = "success";
    toastSpy.mockClear();

    await archiveQualByIndex(user, 0);
    expect(archiveCalls).toHaveLength(2);

    // Simulate the successful refetch: both quals are now archived.
    await act(async () => {
      qualHookState.data = [archivedWwcc, archivedCpr];
      rerender(makeJsx(qc));
    });

    // Both CANNOT_WORK_QUALS are archived → the qual-level <span> must be gone.
    // (The static legend <div> badge still says "Cannot Work" — selector: "span"
    //  filters it out so we only check the dynamic qual-level badge.)
    expect(screen.queryByText("Cannot Work", { selector: "span" })).not.toBeInTheDocument();
  });
});
