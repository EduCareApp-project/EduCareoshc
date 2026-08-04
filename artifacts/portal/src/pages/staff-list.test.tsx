/**
 * Tests for QualLevelBadge in the staff list.
 *
 * Verifies that the badge reflects the correct qualification level computed
 * from the latest hook data, and that the refetchInterval is set so the badge
 * will self-update within 30 seconds without a page reload — covering the
 * "Cannot Work" → "Can Work" transition after a qualification is archived.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QualLevelBadge } from "./staff-list";
import type { QualItem } from "@/lib/qual-level";

// ── Mock workspace packages ──────────────────────────────────────────────────

// Shared, mutable state that tests can change to simulate refetch responses.
const qualHookState: { data: QualItem[]; isLoading: boolean } = {
  data: [],
  isLoading: false,
};

// Capture the query options passed to the hook so we can assert refetchInterval.
let capturedQueryOptions: Record<string, unknown> = {};

vi.mock("@workspace/api-client-react", () => ({
  useGetStaffQualifications: (_staffId: number, options?: { query?: Record<string, unknown> }) => {
    capturedQueryOptions = options?.query ?? {};
    return qualHookState;
  },
  getGetStaffQualificationsQueryKey: (staffId: number) => [
    "/api/staff/qualifications",
    staffId,
  ],
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderBadge(qc: QueryClient, staffId = 1, config = undefined) {
  return render(
    <QueryClientProvider client={qc}>
      <QualLevelBadge staffId={staffId} config={config} />
    </QueryClientProvider>
  );
}

// A WWCC qualification that is expired (triggers "Cannot Work").
const expiredWwcc: QualItem = {
  name: "WWCC",
  status: "expired",
  expiryDate: null,
  archivedAt: null,
};

// The same WWCC record after it has been archived — no longer affects the level.
const archivedWwcc: QualItem = {
  name: "WWCC",
  status: "expired",
  expiryDate: null,
  archivedAt: new Date("2026-01-01"),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("QualLevelBadge — refetch interval", () => {
  beforeEach(() => {
    capturedQueryOptions = {};
    qualHookState.data = [];
    qualHookState.isLoading = false;
  });

  it("configures refetchInterval to 30 seconds", () => {
    renderBadge(makeQueryClient());
    expect(capturedQueryOptions.refetchInterval).toBe(30 * 1000);
  });
});

describe("QualLevelBadge — Cannot Work badge", () => {
  beforeEach(() => {
    qualHookState.isLoading = false;
  });

  it("shows 'Cannot Work' when a critical qualification is expired", () => {
    qualHookState.data = [expiredWwcc];

    renderBadge(makeQueryClient());

    expect(screen.getByText("Cannot Work")).toBeInTheDocument();
  });

  it("shows a loading placeholder while qualifications are fetching", () => {
    qualHookState.isLoading = true;
    qualHookState.data = [];

    renderBadge(makeQueryClient());

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
  });
});

describe("QualLevelBadge — Cannot Work → Can Work transition", () => {
  beforeEach(() => {
    qualHookState.isLoading = false;
  });

  it("clears 'Cannot Work' badge when the expired qual is archived (simulating a refetch)", async () => {
    // Initial state: WWCC is expired → "Cannot Work"
    qualHookState.data = [expiredWwcc];

    const qc = makeQueryClient();
    const { rerender } = renderBadge(qc);

    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    // Simulate the 30-second refetch returning data where WWCC is now archived.
    await act(async () => {
      qualHookState.data = [archivedWwcc];

      rerender(
        <QueryClientProvider client={qc}>
          <QualLevelBadge staffId={1} />
        </QueryClientProvider>
      );
    });

    expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
  });

  it("shows 'Incomplete' after archive when no other quals are present", async () => {
    qualHookState.data = [expiredWwcc];

    const qc = makeQueryClient();
    const { rerender } = renderBadge(qc);

    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    await act(async () => {
      // After archiving the expired WWCC, no active quals remain.
      qualHookState.data = [archivedWwcc];

      rerender(
        <QueryClientProvider client={qc}>
          <QualLevelBadge staffId={1} />
        </QueryClientProvider>
      );
    });

    // With no active quals the level falls through to "Incomplete".
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });

  it("does not require a page reload — badge updates from hook data alone", async () => {
    // Start: two expired Cannot Work quals.
    qualHookState.data = [
      expiredWwcc,
      { name: "CPR Renewal", status: "expired", expiryDate: null, archivedAt: null },
    ];

    const qc = makeQueryClient();
    const { rerender } = renderBadge(qc);
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    await act(async () => {
      // Refetch returns both archived — no page reload simulated.
      qualHookState.data = [
        archivedWwcc,
        { name: "CPR Renewal", status: "expired", expiryDate: null, archivedAt: new Date("2026-01-01") },
      ];

      rerender(
        <QueryClientProvider client={qc}>
          <QualLevelBadge staffId={1} />
        </QueryClientProvider>
      );
    });

    expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
  });
});
