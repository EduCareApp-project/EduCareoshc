import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StaffNotificationsTile } from "./staff-notifications-tile";
import { DashboardNotificationsWidget } from "@/pages/dashboard";

let user: { id: number; type: string; role: string; siteId: number | null } =
  { id: 101, type: "staff", role: "educator", siteId: 7 };
vi.mock("@/contexts/auth", () => ({ useAuth: () => ({ user }) }));
// These unrelated dashboard widgets are not rendered by these focused tests.
vi.mock("@workspace/object-storage-web", () => ({ useUpload: vi.fn() }));
vi.mock("@/components/rich-text-editor", () => ({
  RichTextEditor: () => null, RichTextView: () => null,
}));

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});
const notification = (id: number, title: string, type = "qualification_expiry") => ({
  id, staffId: user.id, type, title, read: false, createdAt: "2026-10-14T00:00:00Z",
});
function setup(node = <StaffNotificationsTile />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...render(node, { wrapper }) };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  user = { id: 101, type: "staff", role: "educator", siteId: 7 };
});

describe("staff Notifications tile", () => {
  it("keeps an empty tile, without an empty-state message", async () => {
    const fetcher = vi.fn().mockResolvedValue(response([]));
    vi.stubGlobal("fetch", fetcher);
    const { client } = setup();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.getByTestId("staff-notifications-tile")).toBeVisible();
    expect(screen.getByTestId("staff-notifications-tile")).toHaveClass("min-h-[13rem]");
    expect(screen.getByText("Notifications")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/no notifications/i)).not.toBeInTheDocument();
  });

  it("includes every inbox category and uses live medical alerts instead of stale duplicates", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([
      notification(1, "Qualification needs attention"),
      notification(2, "A newly supported notification", "new_category"),
      notification(3, "Old medical expiry record", "medication_expiry"),
    ])));
    setup(<StaffNotificationsTile medicalAlerts={<div>Current medication alert</div>} />);
    expect(await screen.findByText("Qualification needs attention")).toBeVisible();
    expect(screen.getByText("A newly supported notification")).toBeVisible();
    expect(screen.getByText("Current medication alert")).toBeVisible();
    expect(screen.queryByText("Old medical expiry record")).not.toBeInTheDocument();
  });

  it("never displays the previous staff member's cached inbox on account changes", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response([notification(1, "First staff private notification")]))
      .mockResolvedValueOnce(response([{ ...notification(2, "Second staff notification"), staffId: 202 }]));
    vi.stubGlobal("fetch", fetcher);
    const { rerender } = setup();
    await screen.findByText("First staff private notification");
    user = { ...user, id: 202 };
    rerender(<StaffNotificationsTile />);
    expect(screen.queryByText("First staff private notification")).not.toBeInTheDocument();
    expect(await screen.findByText("Second staff notification")).toBeVisible();
  });

  it("marks notifications read and refreshes the inbox", async () => {
    let read = false;
    const fetcher = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === "PUT") {
        read = true;
        return Promise.resolve(response({ ok: true }));
      }
      return Promise.resolve(response([{ ...notification(1, "Staff alert"), read }]));
    });
    vi.stubGlobal("fetch", fetcher);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument());
    expect(read).toBe(true);
    expect(screen.getByTestId("staff-notifications-tile")).toBeVisible();
  });

  it("shows a retryable failure rather than presenting a failed request as an empty inbox", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "Failed" }, 500)));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("Notifications could not be loaded");
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("scopes educator medication alerts to their own site", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response([])));
    vi.stubGlobal("fetch", fetcher);
    const { client } = setup(<DashboardNotificationsWidget />);
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/medications/expiring?siteId=7"))).toBe(true);
    expect(screen.getByTestId("staff-notifications-tile")).toBeVisible();
  });

  it("does not fetch all-site medical information for a site-less educator", async () => {
    user = { ...user, siteId: null };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response([])));
    vi.stubGlobal("fetch", fetcher);
    const { client } = setup(<DashboardNotificationsWidget />);
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/medications/expiring"))).toBe(false);
    expect(screen.getByTestId("staff-notifications-tile")).toBeVisible();
  });
});
