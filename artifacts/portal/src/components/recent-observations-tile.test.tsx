import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecentObservationsTile } from "./recent-observations-tile";
import { useDashboardPreferences } from "@/hooks/use-dashboard-preferences";

const account = vi.hoisted(() => ({ id: 42 }));
vi.mock("@/contexts/auth", () => ({ useAuth: () => ({ user: { id: account.id, type: "staff" } }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
const saved = new Map<number, boolean>();
let saveFails = false;
let preferenceLoadFails = false;
const observations = [{
  id: 1, childName: "Alex Example", siteName: "Child Service", siteIdentifier: "C7",
  staffName: "Test Educator", observationDate: "2026-10-15", description: "Test observation",
}];
function Harness() {
  const preferences = useDashboardPreferences();
  return <RecentObservationsTile preferences={preferences} />;
}
function setup(client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return { client, ...render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>) };
}
beforeEach(() => {
  saved.clear();
  account.id = 42;
  saveFails = false;
  preferenceLoadFails = false;
  mocks.toast.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url), "http://test").pathname;
    let status = 200;
    let body: unknown;
    if (path === "/api/auth/dashboard-preferences") {
      if (init?.method === "PATCH") {
        if (saveFails) { status = 500; body = { error: "Save failed" }; }
        else {
          const value = JSON.parse(init.body as string).recentObservationsCollapsed;
          saved.set(account.id, value);
          body = { recentObservationsCollapsed: value };
        }
      } else if (preferenceLoadFails) { status = 500; body = { error: "Load failed" }; }
      else body = { recentObservationsCollapsed: saved.get(account.id) ?? false };
    } else body = observations;
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Leadership Recent Observations", () => {
  it("shows the child's site code with its service name as a tooltip", async () => {
    setup();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("C7")).toHaveAttribute("title", "Child Service");
    expect(within(table).queryByText("Child Service")).not.toBeInTheDocument();
  });
  it("saves collapse and restores it after a fresh login/page load, then saves expansion", async () => {
    const first = setup();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Collapse Recent Observations" }));
    await waitFor(() => expect(screen.queryByRole("table")).not.toBeInTheDocument());
    expect(saved.get(42)).toBe(true);
    first.unmount();
    setup(); // Fresh query cache: must read the account setting, not browser state.
    const expand = await screen.findByRole("button", { name: "Expand Recent Observations" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(expand);
    await screen.findByRole("table");
    expect(saved.get(42)).toBe(false);
  });
  it("keeps different staff accounts' choices separate in the same query cache", async () => {
    saved.set(42, true);
    const first = setup();
    await screen.findByRole("button", { name: "Expand Recent Observations" });
    first.unmount();
    account.id = 43;
    setup(first.client);
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "Collapse Recent Observations" })).toHaveAttribute("aria-expanded", "true");
  });
  it("keeps the previous state and reports an error if saving fails", async () => {
    saveFails = true;
    setup();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Collapse Recent Observations" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(screen.getByRole("table")).toBeVisible();
    expect(saved.has(42)).toBe(false);
  });
  it("provides a retry if the saved account setting cannot load", async () => {
    preferenceLoadFails = true;
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.getByRole("button", { name: "Collapse Recent Observations" })).toBeDisabled();
    preferenceLoadFails = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry settings" }));
    await screen.findByRole("table");
  });
});
