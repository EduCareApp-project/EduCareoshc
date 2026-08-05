/**
 * Polling / multi-manager scenario — uses real React Query with fake timers.
 *
 * Background
 * ----------
 * QualLevelBadge sets `refetchInterval: 30 * 1000` on its qualifications query.
 * This is the ONLY self-healing mechanism when a second manager, working in a
 * different browser session, archives a qualification that previously triggered
 * the "Cannot Work" badge:
 *
 *   Manager B (different session)     Manager A (viewing staff list)
 *   ─────────────────────────────     ──────────────────────────────
 *   Archives expired WWCC qual        Badge still shows "Cannot Work"
 *                                     ... up to 30 s pass ...
 *                                     refetchInterval fires → fetch
 *                                     Badge updates to "Incomplete" ✓
 *
 * No explicit cache invalidation reaches Manager A's client; recovery depends
 * entirely on the polling interval. These tests verify that cycle end-to-end
 * using React Query's real cache (no mocked hook) + vi.useFakeTimers().
 *
 * Decision note: 30 s interval
 * ─────────────────────────────
 * 30 s is an intentional tradeoff. Cross-session updates in a childcare centre
 * happen infrequently (minutes apart, not seconds), and the same-session path
 * (archive/edit on staff profile) already gets immediate badge updates via
 * `queryClient.invalidateQueries`. A 30-second lag on cross-session updates is
 * acceptable for current workflows.
 *
 * If the centre's needs change (e.g. real-time staffing dashboards), the
 * upgrade path is server-sent events (SSE) pushing an invalidation signal to
 * all connected clients — the query-key design already supports that.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QualLevelBadge } from "./staff-list";
import type { QualItem } from "@/lib/qual-level";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STAFF_ID = 55;

/** Expired WWCC — triggers "Cannot Work" badge. */
const expiredWwcc: QualItem = {
  name: "WWCC",
  status: "expired",
  expiryDate: null,
  archivedAt: null,
};

/**
 * Same WWCC after Manager B archives it on their own session.
 * Manager A has not navigated or taken any action.
 */
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
 * QueryClient with no default staleTime override so that React Query's own
 * refetchInterval (set on the badge's query options) controls polling.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
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

describe("QualLevelBadge — 30-second polling (fake timers, multi-manager scenario)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("badge self-heals from 'Cannot Work' to 'Incomplete' once the 30-second refetchInterval fires", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;

    // First fetch (on mount): another manager has not yet archived the qual.
    fetchMock.mockResolvedValueOnce(makeJsonResponse([expiredWwcc]));
    // Second fetch (after 30 s): Manager B has now archived the qual on their session.
    fetchMock.mockResolvedValueOnce(makeJsonResponse([archivedWwcc]));

    const qc = makeQueryClient();
    renderBadge(qc);

    // Advance a short amount to flush the initial fetch and React Query's
    // internal microtasks without triggering the 30-second refetch timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    // Manager A does nothing — the 30-second polling interval fires autonomously.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    // Badge must now reflect the post-archive state without any page reload or
    // explicit user action. "Cannot Work" is gone; level falls to "Incomplete"
    // because archiving the only qual leaves the set empty.
    expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });

  it("badge stays 'Cannot Work' before the 30-second interval fires", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(makeJsonResponse([expiredWwcc]));
    // A second call is registered but should not fire within 29 s.
    fetchMock.mockResolvedValueOnce(makeJsonResponse([archivedWwcc]));

    const qc = makeQueryClient();
    renderBadge(qc);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Advance only 29 s — the refetch has not fired yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });

    // Badge must still show "Cannot Work" — the stale data has not been replaced.
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();
  });

  it("badge updates correctly when multiple CANNOT_WORK_QUALs are all archived by another manager", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;

    const bothExpired: QualItem[] = [
      expiredWwcc,
      { name: "CPR Renewal", status: "expired", expiryDate: null, archivedAt: null },
    ];
    const bothArchived: QualItem[] = [
      archivedWwcc,
      {
        name: "CPR Renewal",
        status: "expired",
        expiryDate: null,
        archivedAt: new Date("2026-01-01"),
      },
    ];

    fetchMock.mockResolvedValueOnce(makeJsonResponse(bothExpired));
    fetchMock.mockResolvedValueOnce(makeJsonResponse(bothArchived));

    const qc = makeQueryClient();
    renderBadge(qc);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("Cannot Work")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });
});
