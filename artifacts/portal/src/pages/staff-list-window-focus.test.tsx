/**
 * Window-focus refetch — overnight tab scenario.
 *
 * Background
 * ----------
 * The global QueryClient in App.tsx sets `refetchOnWindowFocus: false` to
 * avoid spurious refetches across the whole app.  QualLevelBadge overrides
 * this to `true` so that a manager returning to a staff-list tab left open
 * overnight gets a fresh fetch immediately — rather than waiting up to 30 s
 * for the next polling cycle.
 *
 * What these tests verify
 * -----------------------
 * 1. When the window regains focus, the badge query refetches and the rendered
 *    badge updates to reflect the new server data.
 * 2. While the tab is hidden (focus lost), no extra refetch fires.
 * 3. The badge updates from "Incomplete" to "Cannot Work" on focus if an
 *    expired qual appeared in another session while the tab was in the background.
 *
 * Test strategy
 * -------------
 * - We use a real React Query QueryClient (no mocked hook) with
 *   `refetchOnWindowFocus: true` and `staleTime: 0` so the query is stale
 *   the moment the initial fetch resolves.
 * - We use vi.useFakeTimers() (same as the polling suite) to flush async
 *   React Query internals predictably with vi.advanceTimersByTimeAsync().
 * - We drive focus transitions via React Query's `focusManager.setFocused()`
 *   rather than raw DOM events — this is the same internal hook that the
 *   visibilitychange / window-focus event listeners call, and it works
 *   reliably in jsdom test environments.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { QualLevelBadge } from "./staff-list";
import type { QualItem } from "@/lib/qual-level";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STAFF_ID = 42;

/** Expired WWCC — triggers "Cannot Work" badge. */
const expiredWwcc: QualItem = {
  name: "WWCC",
  status: "expired",
  expiryDate: null,
  archivedAt: null,
};

/**
 * Same WWCC after another manager archives it while this tab was in the
 * background overnight.
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
 * QueryClient mirroring the per-query options that QualLevelBadge opts into:
 *   - refetchOnWindowFocus: true  (overrides the app-wide false)
 *   - staleTime: 0               (query is immediately stale → focus always refetches)
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: true,
        staleTime: 0,
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

describe("QualLevelBadge — refetchOnWindowFocus (overnight tab scenario)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    // Start each test with the window focused — mirrors real browser state.
    focusManager.setFocused(true);
  });

  afterEach(() => {
    // Restore focusManager to automatic (browser-event) mode.
    focusManager.setFocused(undefined);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("refetches and updates the badge when the tab regains focus after being left open overnight", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;

    // First fetch (on mount): badge shows "Cannot Work".
    fetchMock.mockResolvedValueOnce(makeJsonResponse([expiredWwcc]));
    // Second fetch (on window focus): the qual was archived overnight by another session.
    fetchMock.mockResolvedValueOnce(makeJsonResponse([archivedWwcc]));

    const qc = makeQueryClient();
    renderBadge(qc);

    // Flush the initial fetch and React Query internals.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("Cannot Work")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Manager minimises the tab or switches to another window.
    await act(async () => {
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(50);
    });

    // Manager returns to the tab — React Query fires a refetch for stale queries
    // that opted into refetchOnWindowFocus.
    await act(async () => {
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(100);
    });

    // The badge must reflect the updated data without any page reload.
    expect(screen.queryByText("Cannot Work")).not.toBeInTheDocument();
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    // Exactly two network requests: initial mount + window-focus refetch.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fire an extra refetch when the tab loses focus — only on return", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(makeJsonResponse([expiredWwcc]));
    // Register a second response — must NOT be consumed while focus is away.
    fetchMock.mockResolvedValueOnce(makeJsonResponse([archivedWwcc]));

    const qc = makeQueryClient();
    renderBadge(qc);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("Cannot Work")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Tab loses focus — this alone must not trigger a second fetch.
    await act(async () => {
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(200);
    });

    // Still only one fetch; the second response remains queued.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();
  });

  it("updates the badge from 'Incomplete' to 'Cannot Work' on focus if an expired qual appeared while hidden", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;

    // Mount: no quals — "Incomplete".
    fetchMock.mockResolvedValueOnce(makeJsonResponse([]));
    // On focus: an expired WWCC was added by another session while tab was hidden.
    fetchMock.mockResolvedValueOnce(makeJsonResponse([expiredWwcc]));

    const qc = makeQueryClient();
    renderBadge(qc);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("Incomplete")).toBeInTheDocument();

    await act(async () => {
      focusManager.setFocused(false);
      await vi.advanceTimersByTimeAsync(50);
    });

    await act(async () => {
      focusManager.setFocused(true);
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.queryByText("Incomplete")).not.toBeInTheDocument();
    expect(screen.getByText("Cannot Work")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
