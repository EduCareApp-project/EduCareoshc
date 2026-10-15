import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewPost from "./new-post";
import EditPost from "./edit-post";

const { create, update } = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
const children = [
  { id: 101, firstName: "Chopper", lastName: "Example", status: "active", siteId: 7 },
  { id: 102, firstName: "Chopper", lastName: "Example", status: "inactive", siteId: 7 },
  { id: 103, firstName: "Archived", lastName: "Child", status: "archived", siteId: 7 },
];
vi.mock("@workspace/api-client-react", () => ({
  useListChildren: () => ({ data: children, isLoading: false, isError: false }),
  getListChildrenQueryKey: () => ["/api/children"],
  useListSites: () => ({ data: [{ id: 7, name: "Centre" }] }),
  useGetPost: () => ({
    data: {
      id: 9, title: "History", siteId: 7, date: "2026-10-15", staffId: null,
      childIds: [101, 102, 103], images: [], documentPaths: [], documentNames: [],
      outcomeIds: [], publishedAt: null,
    },
    isLoading: false,
  }),
  useCreatePost: () => ({ mutate: create, isPending: false }),
  useUpdatePost: () => ({ mutate: update, isPending: false }),
  getListPostsQueryKey: () => ["/api/posts"],
  getGetPostQueryKey: (id: number) => ["/api/posts", id],
}));
vi.mock("@/hooks/use-active-staff", () => ({ useActiveStaff: () => ({ data: [] }) }));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ isAdmin: false, ownSiteId: 7 }),
}));
vi.mock("@workspace/object-storage-web", () => ({ useUpload: () => ({ uploadFile: vi.fn() }) }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));
vi.mock("@/components/mtop-outcome-picker", () => ({ MtopOutcomePicker: () => null }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("wouter", () => ({
  useLocation: () => ["/posts", vi.fn()],
  useRoute: () => [true, { id: "9" }],
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderForm(node: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  create.mockReset();
  update.mockReset();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

describe("Posts child selectors", () => {
  it("new posts offer only the active profile even when an inactive child has the same name", async () => {
    renderForm(<NewPost />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Chopper Example" })).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Archived Child" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("e.g. Exploring the garden"), "New story");
    await userEvent.click(screen.getByRole("button", { name: "Chopper Example" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ childIds: [101] }),
    }), expect.anything());
  });

  it("editing hides inactive/archived choices yet retains their historical IDs when saving", async () => {
    renderForm(<EditPost />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Chopper Example" })).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Archived Child" })).not.toBeInTheDocument();
    expect(screen.getByText(/Existing links to inactive or archived children/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      id: 9, data: expect.objectContaining({ childIds: [101, 102, 103] }),
    }), expect.anything());
  });
});
