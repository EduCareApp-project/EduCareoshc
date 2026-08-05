/**
 * Cross-page cache-invalidation test — uses real React Query cache mechanics.
 *
 * Problem being guarded against:
 *   When a manager archives a qual on the Staff Profile page, handleArchiveQual calls:
 *     queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] })
 *
 *   The Staff List page renders QualLevelBadge, which subscribes to:
 *     queryKey: getGetStaffQualificationsQueryKey(staffId)
 *              = [`/api/staff/${staffId}/qualifications`]
 *
 *   If these keys ever diverge, the badge stays stale after an archive — the original bug.
 *   This test proves they match by driving the full invalidate → refetch → re-render cycle
 *   through the *real* React Query cache (not a mocked hook).
 *
 * Test strategy:
 *   - Do NOT mock useGetStaffQualifications — use the real hook so React Query's
 *     cache state and query lifecycle are exercised.
 *   - Mock global.fetch to control what the "server" returns after each action.
 *   - staleTime: Infinity on the QueryClient so pre-seeded data does not trigger
 *     an automatic background refetch on mount; only explicit invalidation fires fetch.
 *   - Pre-seed the cache with stale "Cannot Work" data via setQueryData.
 *   - Call invalidateQueries with the exact key that handleArchiveQual uses.
 *   - Assert the badge transitions from "Cannot Work" → "Incomplete" via the refetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QualLevelBadge } from "./staff-list";
import { getGetStaffQualificationsQueryKey } from "@workspace/api-client-react";
import type { QualItem } from "@/lib/qual-level";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STAFF_ID = 42;

/** Expired WWCC — a CANNOT_WORK_QUAL — drives the "Cannot Work" badge level. */
const expiredWwcc: QualItem = {
  name: "WWCC",
  status: "expired",
  expiryDate: null,
  archivedAt: null,
};

/** The same WWCC after the manager archives it on the staff profile page. */
const archivedWwcc: QualItem = {
  name: "WWCC",
  status: "expired",
  expiryDate: null,
  archivedAt: new Date("2026-01-01"),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * QueryClient with staleTime: Infinity so pre-seeded data is never considered
 * stale on mount. This means the ONLY thing that can trigger a refetch is an
 * explicit invalidateQueries call — which is exactly what handleArchiveQual does.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function renderBadge(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <QualLevelBadge staffId={STAFF_ID} />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Staff List — cross-page cache invalidation (real React Query)", () => {
  beforeEach(() => {
    // Intercept the real customFetch → fetch calls so no network requests escape.
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("badge transitions from 'Cannot Work' to 'Incomplete' after handleArchiveQual's invalidation fires a refetch", async () => {
    const qc = makeQueryClient();

    // Step 1 — pre-seed cache with stale "Cannot Work" data.
    // Simulates the staff list having been loaded before the archive action.
    qc.setQueryData(getGetStaffQualificationsQueryKey(STAFF_ID), [expiredWwcc]);

    // Step 2 — mount the badge (simulating the manager arriving at the staff list).
    // With staleTime: Infinity, no fetch fires here — data comes from cache only.
    renderBadge(qc);
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    // Step 3 — simulate the post-archive server response.
    // After handleArchiveQual succeeds, the server returns the updated qual list.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeJsonResponse([archivedWwcc])
    );

    // Step 4 — call invalidateQueries exactly as handleArchiveQual does in
    //   artifacts/portal/src/pages/staff-profile.tsx (line 389):
    //   queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] })
    //
    // This marks the cache entry stale and schedules a refetch against the
    // mocked fetch above. If the key here does NOT match the key the badge
    // subscribed to, no refetch fires and the assertion below will fail.
    await act(async () => {
      await qc.invalidateQueries({
        queryKey: [`/api/staff/${STAFF_ID}/qualifications`],
      });
    });

    // Step 5 — badge must now reflect the post-archive qual level.
    await waitFor(() => {
      expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
      expect(screen.getByText("Incomplete")).toBeInTheDocument();
    });
  });

  it("key invariant: getGetStaffQualificationsQueryKey matches the path invalidated by handleArchiveQual", () => {
    // Regression guard: if either side changes its key format, this assertion
    // catches the divergence before the stale-badge bug can reappear.
    const key = getGetStaffQualificationsQueryKey(STAFF_ID);
    expect(key).toEqual([`/api/staff/${STAFF_ID}/qualifications`]);
  });

  it("invalidating a different staff member's key does NOT trigger a refetch for the rendered badge", async () => {
    const OTHER_STAFF = 99;
    const qc = makeQueryClient();

    qc.setQueryData(getGetStaffQualificationsQueryKey(STAFF_ID), [expiredWwcc]);

    renderBadge(qc);
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    // Archive fires for a DIFFERENT staff member (id=99) — different query key.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeJsonResponse([]));

    await act(async () => {
      await qc.invalidateQueries({
        queryKey: [`/api/staff/${OTHER_STAFF}/qualifications`],
      });
    });

    // Wait briefly to give React Query time to process any spurious refetches.
    await new Promise((r) => setTimeout(r, 50));

    // staffId=42's cache entry was not invalidated — badge must still show "Cannot Work".
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    // The fetch function must NOT have been called for staffId=42's URL.
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls as [string][];
    const calledFor42 = calls.some(([url]) =>
      url?.includes(`/api/staff/${STAFF_ID}/qualifications`)
    );
    expect(calledFor42).toBe(false);
  });

  it("clears 'Cannot Work' badge when TWO expired CANNOT_WORK_QUALs are both archived", async () => {
    const qc = makeQueryClient();

    const bothExpired: QualItem[] = [
      expiredWwcc,
      { name: "CPR Renewal", status: "expired", expiryDate: null, archivedAt: null },
    ];
    const bothArchived: QualItem[] = [
      archivedWwcc,
      { name: "CPR Renewal", status: "expired", expiryDate: null, archivedAt: new Date("2026-01-01") },
    ];

    qc.setQueryData(getGetStaffQualificationsQueryKey(STAFF_ID), bothExpired);
    renderBadge(qc);
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeJsonResponse(bothArchived));

    await act(async () => {
      await qc.invalidateQueries({
        queryKey: [`/api/staff/${STAFF_ID}/qualifications`],
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
      expect(screen.getByText("Incomplete")).toBeInTheDocument();
    });
  });
});

// ── Add & Edit path tests ──────────────────────────────────────────────────────
//
// These mirror the archive tests above but exercise the add-qual and edit-qual
// paths. Both paths in staff-profile.tsx call the same invalidate helper:
//
//   const invalidate = () =>
//     queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] });
//
// A regression on either path would leave the staff list badge stale.

describe("Staff List — cross-page cache invalidation after add / edit (real React Query)", () => {
  /** All three EDUCATOR_QUALS as current — enough to reach the "Educator" level. */
  const educatorQuals: QualItem[] = [
    { name: "Staff Details (DET)", status: "current", expiryDate: null, archivedAt: null },
    { name: "WWCC", status: "current", expiryDate: null, archivedAt: null },
    {
      name: "Child Safety - Mandatory Reporting and Other Obligations",
      status: "current",
      expiryDate: null,
      archivedAt: null,
    },
  ];

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("badge transitions from 'Incomplete' to 'Educator' after handleQualSubmit (add) fires invalidation", async () => {
    const qc = makeQueryClient();

    // Step 1 — pre-seed cache with no qualifications → "Incomplete" badge.
    // Simulates the staff list loaded before the manager adds any qualification.
    qc.setQueryData(getGetStaffQualificationsQueryKey(STAFF_ID), []);

    // Step 2 — mount the badge; data comes from cache only (staleTime: Infinity).
    renderBadge(qc);
    expect(screen.getByText("Incomplete")).toBeInTheDocument();

    // Step 3 — simulate the server response after the add succeeds.
    // The server now returns all three educator-level quals.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeJsonResponse(educatorQuals)
    );

    // Step 4 — call invalidateQueries exactly as handleQualSubmit (add path) does in
    //   artifacts/portal/src/pages/staff-profile.tsx:
    //   const invalidate = () =>
    //     queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] });
    //   createQualMutation.mutate(..., { onSuccess: () => { closeQualDialog(); invalidate(); ... } })
    await act(async () => {
      await qc.invalidateQueries({
        queryKey: [`/api/staff/${STAFF_ID}/qualifications`],
      });
    });

    // Step 5 — badge must now reflect the educator level.
    await waitFor(() => {
      expect(screen.queryByText("Incomplete")).not.toBeInTheDocument();
      expect(screen.getByText("Educator")).toBeInTheDocument();
    });
  });

  it("badge transitions from 'Cannot Work' to 'Incomplete' after handleQualSubmit (edit: expired → current) fires invalidation", async () => {
    const qc = makeQueryClient();

    // Step 1 — pre-seed cache with an expired WWCC → "Cannot Work" badge.
    // The manager is about to edit the qualification and mark it as current.
    const expiredWwcc: QualItem = {
      name: "WWCC",
      status: "expired",
      expiryDate: null,
      archivedAt: null,
    };
    qc.setQueryData(getGetStaffQualificationsQueryKey(STAFF_ID), [expiredWwcc]);

    // Step 2 — mount the badge; data comes from cache only (staleTime: Infinity).
    renderBadge(qc);
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    // Step 3 — simulate the server response after the edit succeeds.
    // The WWCC is now "current" — no longer triggers the Cannot Work rule.
    // Only one qual is present so the level stays at "Incomplete" (not full Educator set).
    const currentWwcc: QualItem = {
      name: "WWCC",
      status: "current",
      expiryDate: null,
      archivedAt: null,
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeJsonResponse([currentWwcc])
    );

    // Step 4 — call invalidateQueries exactly as handleQualSubmit (edit path) does in
    //   artifacts/portal/src/pages/staff-profile.tsx:
    //   const invalidate = () =>
    //     queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] });
    //   updateQualMutation.mutate(..., { onSuccess: () => { closeQualDialog(); invalidate(); ... } })
    await act(async () => {
      await qc.invalidateQueries({
        queryKey: [`/api/staff/${STAFF_ID}/qualifications`],
      });
    });

    // Step 5 — "Cannot Work" must be gone; badge now reads "Incomplete".
    await waitFor(() => {
      expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
      expect(screen.getByText("Incomplete")).toBeInTheDocument();
    });
  });
});
