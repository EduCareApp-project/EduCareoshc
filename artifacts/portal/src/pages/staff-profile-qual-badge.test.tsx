/**
 * Tests for the qual-level badge on the Qualifications tab header of the
 * Staff Profile page.
 *
 * Covers:
 *   1. Initial render — badge shows the correct level for each of the four
 *      possible states (Cannot Work, Responsible Person, Educator, Incomplete)
 *      when a manager first opens the Qualifications tab.
 *   2. Reactivity after adding a qualification — when a new qual is saved and
 *      the cache is invalidated, the badge updates in-place without a page reload.
 *
 * Test strategy
 * -------------
 * - Pure-function suite first: proves computeQualLevel returns the right
 *   QualLevel string for every scenario, decoupled from UI rendering.
 * - Component suite: mounts StaffProfile, clicks the Qualifications tab, and
 *   asserts the badge <span> text.  The `qualHookState` object is mutated
 *   between steps to simulate a React Query refetch after a cache invalidation.
 *
 * Note: archive-error scenarios (badge persistence across interrupted archives)
 * are covered separately in staff-profile-archive-error.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffProfile from "./staff-profile";
import { computeQualLevel, type QualItem, RP_QUALS, EDUCATOR_QUALS, CANNOT_WORK_QUALS } from "@/lib/qual-level";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A qual that is both current and named for the CANNOT_WORK set. */
const currentWwcc: QualItem = { name: "WWCC", status: "current", expiryDate: null, archivedAt: null };
const expiredWwcc: QualItem = { name: "WWCC", status: "expired", expiryDate: null, archivedAt: null };
const expiredCpr: QualItem  = { name: "CPR Renewal", status: "expired", expiryDate: null, archivedAt: null };
const expiredFirstAid: QualItem = { name: "First Aid", status: "expired", expiryDate: null, archivedAt: null };

/** Full set of RP_QUALS, all current — yields "responsible-person". */
const fullRpSet: QualItem[] = RP_QUALS.map((name) => ({
  name,
  status: "current",
  expiryDate: null,
  archivedAt: null,
}));

/** Full set of EDUCATOR_QUALS only — yields "educator" (RP set incomplete). */
const fullEducatorSet: QualItem[] = EDUCATOR_QUALS.map((name) => ({
  name,
  status: "current",
  expiryDate: null,
  archivedAt: null,
}));

/** A subset of RP_QUALS that does NOT include all EDUCATOR_QUALS — yields "incomplete". */
const incompleteSet: QualItem[] = [
  { name: "Food Safety", status: "current", expiryDate: null, archivedAt: null },
];

// ─── Pure-function tests ───────────────────────────────────────────────────────

describe("computeQualLevel — initial badge level for every possible state", () => {
  it("returns 'cannot-work' when a CANNOT_WORK_QUAL is expired", () => {
    expect(computeQualLevel([expiredWwcc])).toBe("cannot-work");
    expect(computeQualLevel([expiredCpr])).toBe("cannot-work");
    expect(computeQualLevel([expiredFirstAid])).toBe("cannot-work");
  });

  it("returns 'cannot-work' when multiple CANNOT_WORK_QUALS are expired", () => {
    expect(computeQualLevel([expiredWwcc, expiredCpr, expiredFirstAid])).toBe("cannot-work");
  });

  it("returns 'responsible-person' when all RP_QUALS are current and none of the CANNOT_WORK set is expired", () => {
    expect(computeQualLevel(fullRpSet)).toBe("responsible-person");
  });

  it("returns 'educator' when all EDUCATOR_QUALS are current but the RP set is not fully met", () => {
    // fullEducatorSet has all 3 EDUCATOR_QUALS but is missing several RP_QUALS.
    expect(computeQualLevel(fullEducatorSet)).toBe("educator");
  });

  it("returns 'incomplete' when neither the RP set nor the EDUCATOR set is fully met", () => {
    expect(computeQualLevel(incompleteSet)).toBe("incomplete");
  });

  it("returns 'incomplete' when there are no qualifications at all", () => {
    expect(computeQualLevel([])).toBe("incomplete");
  });

  it("does not count archived quals towards any level — archived WWCC does not trigger cannot-work", () => {
    const archivedWwcc: QualItem = { ...expiredWwcc, archivedAt: new Date("2026-01-01") };
    // Archived expired WWCC no longer active → must not trigger cannot-work on its own.
    expect(computeQualLevel([archivedWwcc])).toBe("incomplete");
  });

  it("adding the missing RP_QUALS to an educator-level set raises the level to 'responsible-person'", () => {
    // Start: only EDUCATOR_QUALS present → "educator"
    const before = computeQualLevel(fullEducatorSet);
    expect(before).toBe("educator");

    // After: fill out all RP_QUALS
    const after = computeQualLevel(fullRpSet);
    expect(after).toBe("responsible-person");
  });

  it("a single expired CANNOT_WORK_QUAL overrides even a full RP set — returns 'cannot-work'", () => {
    const rpWithExpiredWwcc = fullRpSet.map((q) =>
      q.name === "WWCC" ? { ...q, status: "expired" } : q
    );
    expect(computeQualLevel(rpWithExpiredWwcc)).toBe("cannot-work");
  });
});

// ─── Component test setup ──────────────────────────────────────────────────────

/**
 * Mutable hook state shared across component tests.
 * Tests update `.data` directly to simulate a React Query refetch.
 */
const qualHookState: { data: QualItem[]; isLoading: boolean } = {
  data: [],
  isLoading: false,
};

const createQualCalls: { data: unknown; onSuccess?: () => void; onError?: () => void }[] = [];

vi.mock("@workspace/api-client-react", () => ({
  useGetStaff: () => ({
    data: {
      id: 1, firstName: "Jordan", lastName: "Lee", email: "jordan@test.com",
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
  useGetStaffQualifications: () => qualHookState,
  getGetStaffQualificationsQueryKey: (id: number) => [`/api/staff/${id}/qualifications`],
  useCreateStaffQualification: () => ({
    mutate: vi.fn((args: { id: number; data: unknown }, cbs?: { onSuccess?: () => void; onError?: () => void }) => {
      createQualCalls.push({ data: args.data, onSuccess: cbs?.onSuccess, onError: cbs?.onError });
      cbs?.onSuccess?.();
    }),
    isPending: false,
  }),
  useUpdateStaffQualification:      () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteQualificationDocument:   () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveStaffQualification:     () => ({ mutate: vi.fn(), isPending: false }),
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
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("wouter", () => ({
  useParams:   () => ({ id: "1" }),
  useLocation: () => ["/staff/1", vi.fn()],
  Link:     ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Redirect: () => null,
}));

vi.mock("./appraisals-tab", () => ({ default: () => <div>Appraisals</div> }));

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

/** Renders the profile and clicks the Qualifications tab. */
async function renderAndOpenQualificationsTab(qc: QueryClient) {
  const user = userEvent.setup();
  const utils = render(makeJsx(qc));
  const qualTab = screen.getByRole("tab", { name: /qualifications/i });
  await user.click(qualTab);
  return { ...utils, user };
}

// ─── Component tests ───────────────────────────────────────────────────────────

describe("StaffProfile — Qualifications tab badge on initial open", () => {
  beforeEach(() => {
    qualHookState.isLoading = false;
    createQualCalls.length = 0;
  });

  it("shows 'Cannot Work' badge when a CANNOT_WORK_QUAL is expired on first tab open", async () => {
    qualHookState.data = [expiredWwcc];
    await renderAndOpenQualificationsTab(makeQueryClient());
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("shows 'Responsible Person' badge when all RP_QUALS are current on first tab open", async () => {
    qualHookState.data = fullRpSet;
    await renderAndOpenQualificationsTab(makeQueryClient());
    expect(screen.getByText("Responsible Person", { selector: "span" })).toBeInTheDocument();
  });

  it("shows 'Educator' badge when only EDUCATOR_QUALS are satisfied on first tab open", async () => {
    qualHookState.data = fullEducatorSet;
    await renderAndOpenQualificationsTab(makeQueryClient());
    expect(screen.getByText("Educator", { selector: "span" })).toBeInTheDocument();
  });

  it("shows 'Incomplete' badge when no qualifications are present on first tab open", async () => {
    qualHookState.data = [];
    await renderAndOpenQualificationsTab(makeQueryClient());
    expect(screen.getByText("Incomplete", { selector: "span" })).toBeInTheDocument();
  });

  it("shows 'Incomplete' badge when quals are present but neither level set is fully satisfied", async () => {
    qualHookState.data = incompleteSet;
    await renderAndOpenQualificationsTab(makeQueryClient());
    expect(screen.getByText("Incomplete", { selector: "span" })).toBeInTheDocument();
  });

  it("does not show any badge while qualifications are still loading", async () => {
    qualHookState.data = [];
    qualHookState.isLoading = true;
    await renderAndOpenQualificationsTab(makeQueryClient());
    // When isLoading is true the badge is suppressed; none of the level labels appear as a <span>.
    expect(screen.queryByText("Cannot Work",         { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Responsible Person",  { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Educator",            { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Incomplete",          { selector: "span" })).not.toBeInTheDocument();
    // Reset for subsequent tests.
    qualHookState.isLoading = false;
  });
});

describe("StaffProfile — Qualifications tab badge updates after adding a qualification", () => {
  beforeEach(() => {
    qualHookState.isLoading = false;
    createQualCalls.length = 0;
  });

  it("badge updates from 'Educator' to 'Responsible Person' after the missing RP quals are added", async () => {
    // Start: only EDUCATOR_QUALS are present → badge reads "Educator".
    qualHookState.data = fullEducatorSet;
    const qc = makeQueryClient();
    const { rerender } = await renderAndOpenQualificationsTab(qc);

    expect(screen.getByText("Educator", { selector: "span" })).toBeInTheDocument();

    // Simulate the cache update after createQualMutation succeeds and
    // invalidateQueries triggers a refetch that returns the full RP set.
    await act(async () => {
      qualHookState.data = fullRpSet;
      rerender(makeJsx(qc));
    });

    expect(screen.queryByText("Educator",           { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getByText("Responsible Person",   { selector: "span" })).toBeInTheDocument();
  });

  it("badge updates from 'Incomplete' to 'Educator' after all EDUCATOR_QUALS are added", async () => {
    // Start: no qualifications → "Incomplete".
    qualHookState.data = [];
    const qc = makeQueryClient();
    const { rerender } = await renderAndOpenQualificationsTab(qc);

    expect(screen.getByText("Incomplete", { selector: "span" })).toBeInTheDocument();

    // Simulate refetch returning the full educator set.
    await act(async () => {
      qualHookState.data = fullEducatorSet;
      rerender(makeJsx(qc));
    });

    expect(screen.queryByText("Incomplete",  { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getByText("Educator",      { selector: "span" })).toBeInTheDocument();
  });

  it("badge updates from 'Incomplete' to 'Cannot Work' when an expired CANNOT_WORK_QUAL is added", async () => {
    // Start: no qualifications → "Incomplete".
    qualHookState.data = [];
    const qc = makeQueryClient();
    const { rerender } = await renderAndOpenQualificationsTab(qc);

    expect(screen.getByText("Incomplete", { selector: "span" })).toBeInTheDocument();

    // Simulate adding an expired WWCC — should immediately surface the risk.
    await act(async () => {
      qualHookState.data = [expiredWwcc];
      rerender(makeJsx(qc));
    });

    expect(screen.queryByText("Incomplete",          { selector: "span" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Cannot Work", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("badge remains 'Incomplete' after adding one qual when the level set is not yet complete", async () => {
    // Start: no qualifications → "Incomplete".
    qualHookState.data = [];
    const qc = makeQueryClient();
    const { rerender } = await renderAndOpenQualificationsTab(qc);

    expect(screen.getByText("Incomplete", { selector: "span" })).toBeInTheDocument();

    // Add only a single current WWCC — not enough to reach "educator" or "responsible-person".
    await act(async () => {
      qualHookState.data = [currentWwcc];
      rerender(makeJsx(qc));
    });

    // Still incomplete — one qual does not satisfy either level set.
    expect(screen.getByText("Incomplete", { selector: "span" })).toBeInTheDocument();
  });
});
