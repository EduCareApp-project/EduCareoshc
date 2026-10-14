import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYOUTS } from "@/lib/dashboard-layout";
import { useLayoutEditor } from "./use-layout-editor";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });
const items = DEFAULT_LAYOUTS.educator;
const state = { dashboard: "educator", canEdit: true, published: null, draft: null };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});
function setup(fetcher: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return renderHook(({ userId }) => useLayoutEditor("educator", userId), {
    initialProps: { userId: 23 },
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}
describe("private layout editing", () => {
  it("retains geometry after failed save and retries with the real revision contract", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(state))
      .mockResolvedValueOnce(response({ error: "Save unavailable" }, 500))
      .mockResolvedValueOnce(response({ items, revision: 1, baseRevision: 0 }));
    const { result } = setup(fetcher);
    await waitFor(() => expect(result.current.data?.canEdit).toBe(true));
    act(() => result.current.enter());
    act(() => result.current.resetDefault());
    let saved: unknown;
    await act(async () => { saved = await result.current.save(); });
    expect(saved).toBeNull();
    expect(result.current.session?.dirty).toBe(true);
    expect(result.current.session?.items).toEqual(items);
    expect(result.current.error).toContain("could not be saved");
    await act(async () => { saved = await result.current.save(); });
    expect(saved).toEqual({ rev: 1, base: 0 });
    expect(result.current.session?.dirty).toBe(false);
    expect(result.current.session?.rev).toBe(1);
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ items, baseRevision: 0, expectedDraftRevision: 0 });
  });
  it("saves before applying and uses the saved draft's revision", async () => {
    const applied = { ...state, published: { items, revision: 1, baseRevision: 1 },
      draft: { items, revision: 2, baseRevision: 1 } };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(state))
      .mockResolvedValueOnce(response({ items, revision: 1, baseRevision: 0 }))
      .mockResolvedValueOnce(response(applied));
    const { result } = setup(fetcher);
    await waitFor(() => expect(result.current.data?.canEdit).toBe(true));
    act(() => result.current.enter());
    let appliedOk = false;
    await act(async () => { appliedOk = await result.current.apply(); });
    expect(appliedOk).toBe(true);
    expect(fetcher.mock.calls.map((call) => call[1].method)).toEqual(["GET", "PUT", "POST"]);
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ expectedRevision: 0, expectedDraftRevision: 1 });
    expect(result.current.editing).toBe(false);
    expect(result.current.data?.published?.revision).toBe(1);
  });
  it("clears private editor state when identity changes and denies viewer editing", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ ...state, draft: { items, revision: 4, baseRevision: 2 } }))
      .mockResolvedValueOnce(response({ ...state, canEdit: false }));
    const { result, rerender } = setup(fetcher);
    await waitFor(() => expect(result.current.data?.draft?.revision).toBe(4));
    act(() => result.current.enter());
    expect(result.current.session?.rev).toBe(4);
    expect(result.current.session?.base).toBe(2);
    rerender({ userId: 24 });
    await waitFor(() => expect(result.current.data?.canEdit).toBe(false));
    expect(result.current.editing).toBe(false);
    expect(result.current.session).toBeNull();
    act(() => result.current.enter());
    expect(result.current.editing).toBe(false);
  });
});
