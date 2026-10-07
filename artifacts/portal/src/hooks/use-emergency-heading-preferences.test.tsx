import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { persist, load } = vi.hoisted(() => ({ persist: vi.fn(), load: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({
  getGetEmergencyRecordHeadingPreferencesQueryKey: () => ["/prefs"],
  useGetEmergencyRecordHeadingPreferences: load,
  useUpdateEmergencyRecordHeadingPreferences: () => ({ mutateAsync: persist }),
}));
import { useEmergencyHeadingPreferences } from "./use-emergency-heading-preferences";

function setup(key = "staff:1") {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, ...renderHook(({ account }) => useEmergencyHeadingPreferences(account), { wrapper, initialProps: { account: key } }) };
}

describe("Emergency heading account persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    load.mockReturnValue({ data: { collapsedHeadings: null }, isPending: false, isFetching: false, isError: false });
  });
  it("saves rapid toggles in order, so the last click wins", async () => {
    let finishFirst!: (value: unknown) => void;
    persist.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce({ collapsedHeadings: { lockdown: false } });
    const { result, queryClient } = setup();
    const first = result.current.saveHeadings({ lockdown: true });
    const second = result.current.saveHeadings({ lockdown: false });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    finishFirst({ collapsedHeadings: { lockdown: true } });
    await Promise.all([first, second]);
    expect(persist.mock.calls.map(([input]) => input)).toEqual([
      { data: { lockdown: true } }, { data: { lockdown: false } },
    ]);
    expect(queryClient.getQueryData(["/prefs", "staff:1"])).toEqual({ collapsedHeadings: { lockdown: false } });
  });
  it("allows the next save after a failed request", async () => {
    persist.mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce({ collapsedHeadings: { other: true } });
    const { result } = setup();
    await expect(result.current.saveHeadings({ lockdown: true })).rejects.toThrow("Offline");
    await expect(result.current.saveHeadings({ other: true })).resolves.toEqual({ collapsedHeadings: { other: true } });
    expect(persist).toHaveBeenLastCalledWith({ data: { lockdown: true, other: true } });
  });
  it("does not send queued changes after the account changes", async () => {
    let finishFirst!: (value: unknown) => void;
    persist.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
    const { result, rerender } = setup();
    const first = result.current.saveHeadings({ lockdown: true });
    const pending = result.current.saveHeadings({ other: true });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    rerender({ account: "staff:2" });
    finishFirst({ collapsedHeadings: { lockdown: true } });
    await Promise.all([first, pending]);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({
      query: expect.objectContaining({ queryKey: ["/prefs", "staff:2"] }),
    }));
  });
});
