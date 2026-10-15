import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getListChildrenQueryKey } from "@workspace/api-client-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Jottings from "./jottings";
import ObservationsList from "./observations-list";
import Planning from "./planning";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ canDelete: true, isEducatorRole: false, ownSiteId: null, isAdminOrEL: true }),
}));
// Expose dropdown options without portal mechanics; actual option filtering stays intact.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectItem: ({ children, value }: any) => <span data-option={value}>{children}</span>,
}));
const children = [
  { id: 101, firstName: "Chopper", lastName: "Example", status: "active", siteId: 7 },
  { id: 102, firstName: "Chopper", lastName: "Example", status: "inactive", siteId: 7 },
  { id: 103, firstName: "Archived", lastName: "Child", status: "archived", siteId: 7 },
];
const dates = { createdAt: "2026-10-15T02:00:00Z", updatedAt: "2026-10-15T02:00:00Z" };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup(node: React.ReactNode, rows: Record<string, unknown>, childFailure = false) {
  vi.stubGlobal("fetch", vi.fn((url: RequestInfo | URL) => {
    const path = new URL(String(url), "http://test").pathname;
    const data = path === "/api/children" ? children : rows[path] ?? [];
    return Promise.resolve(new Response(JSON.stringify(data), {
      status: path === "/api/children" && childFailure ? 500 : 200,
      headers: { "Content-Type": "application/json" },
    }));
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  return { client, ...rendered };
}

describe("learning lists exclude inactive profiles without deleting their records", () => {
  it("shows one Chopper in Quick Capture and excludes inactive-child jottings, keeping general notes", async () => {
    const { container, client } = setup(<Jottings />, {
      "/api/jottings": [
        { id: 1, childId: 101, childName: "Chopper Example", content: "Active jotting", archivedAt: null, ...dates },
        { id: 2, childId: 102, childName: "Chopper Example", content: "Inactive jotting", archivedAt: null, ...dates },
        { id: 3, childId: 103, childName: "Archived Child", content: "Archived child jotting", archivedAt: null, ...dates },
        { id: 4, childId: null, childName: null, content: "General note", archivedAt: null, ...dates },
      ],
    });
    expect(await screen.findByText("Active jotting")).toBeVisible();
    expect(screen.getByText("General note")).toBeVisible();
    expect(screen.queryByText("Inactive jotting")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived child jotting")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-option="101"]')).toHaveLength(1);
    expect(container.querySelector('[data-option="102"]')).toBeNull();
    expect(container.querySelector('[data-option="103"]')).toBeNull();
    // Filtering is local to learning views; the management cache still holds history.
    expect(client.getQueryData(getListChildrenQueryKey())).toHaveLength(3);
  });

  it("excludes inactive/archived observation cards from both published and draft lists", async () => {
    setup(<ObservationsList />, {
      "/api/observations": [
        { id: 1, childId: 101, childName: "Chopper Example", staffName: "Educator", description: "Active observation", observationDate: "2026-10-15", publishedAt: dates.createdAt, outcomeIds: [], ...dates },
        { id: 2, childId: 102, childName: "Chopper Example", staffName: "Educator", description: "Inactive observation", observationDate: "2026-10-15", publishedAt: dates.createdAt, outcomeIds: [], ...dates },
        { id: 3, childId: 103, childName: "Archived Child", staffName: "Educator", description: "Archived draft", observationDate: "2026-10-15", publishedAt: null, outcomeIds: [], ...dates },
      ],
    });
    expect(await screen.findByText("Active observation")).toBeVisible();
    expect(screen.queryByText("Inactive observation")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived Child")).not.toBeInTheDocument();
  });

  it("keeps general and mixed planning cycles, hides inactive-only cycles and removes inactive focus names", async () => {
    setup(<Planning />, {
      "/api/planning": [
        { id: 1, title: "Active cycle", childIds: [101], stage: "planned", siteId: 7, isTemplate: false, ...dates },
        { id: 2, title: "Inactive cycle", childIds: [102], stage: "planned", siteId: 7, isTemplate: false, ...dates },
        { id: 3, title: "Mixed cycle", childIds: [101, 102, 103], stage: "planned", siteId: 7, isTemplate: false, ...dates },
        { id: 4, title: "General cycle", childIds: [], stage: "planned", siteId: 7, isTemplate: false, ...dates },
      ],
    });
    expect(await screen.findByText("Active cycle")).toBeVisible();
    expect(screen.getByText("Mixed cycle")).toBeVisible();
    expect(screen.getByText("General cycle")).toBeVisible();
    expect(screen.queryByText("Inactive cycle")).not.toBeInTheDocument();
    expect(screen.queryByText(/Archived Child|#103|more/)).not.toBeInTheDocument();
    expect(screen.getByText("Mixed cycle").closest("button")).toHaveTextContent("Chopper Example");
    expect(screen.getByText("Mixed cycle").closest("button")).not.toHaveTextContent("Chopper Example, Chopper Example");
  });

  it("shows a retryable child-list error rather than a misleading empty learning list", async () => {
    const { client } = setup(<Jottings />, { "/api/jottings": [] }, true);
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(screen.getByRole("alert")).toHaveTextContent("Active children could not be loaded");
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});
