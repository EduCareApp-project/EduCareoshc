/**
 * Tests for Posts page server-side pagination.
 *
 * Covers:
 *   1. First page (10 posts at offset=0): renders 10 cards + "Load more" button.
 *   2. Clicking "Load more" (offset=10, fewer than 10 posts): appends new cards
 *      and hides the "Load more" button because hasMore becomes false.
 *   3. Fewer-than-PAGE_SIZE first page: no "Load more" button from the start.
 *   4. "Load more" with an active site filter: second-page request carries siteId.
 *   5. Changing the site filter: accumulated posts reset and new siteId is sent.
 *
 * Test strategy
 * -------------
 * The `useListPosts` mock captures the full params object on every call so tests
 * can assert that siteId is forwarded on both first and subsequent pages.
 * Data is keyed by a composite "siteId:offset" string (falling back to
 * offset-only for tests that do not set a site filter).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Posts from "./posts";
import type { Post } from "@workspace/api-client-react";

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------

// Primary map: keyed by offset alone (backward-compatible for existing tests).
const pageDataByOffset = new Map<
  number,
  { data: Post[] | undefined; isLoading: boolean; isFetching: boolean }
>();

// Secondary map: keyed by "siteId:offset" — checked first when siteId is present.
const pageDataBySiteOffset = new Map<
  string,
  { data: Post[] | undefined; isLoading: boolean; isFetching: boolean }
>();

function setPageData(
  offset: number,
  posts: Post[],
  opts: { isLoading?: boolean; isFetching?: boolean } = {},
) {
  pageDataByOffset.set(offset, {
    data: posts,
    isLoading: opts.isLoading ?? false,
    isFetching: opts.isFetching ?? false,
  });
}

/** Prime data for a specific (siteId, offset) combination. */
function setPageDataForSite(
  siteId: number,
  offset: number,
  posts: Post[],
  opts: { isLoading?: boolean; isFetching?: boolean } = {},
) {
  pageDataBySiteOffset.set(`${siteId}:${offset}`, {
    data: posts,
    isLoading: opts.isLoading ?? false,
    isFetching: opts.isFetching ?? false,
  });
}

/**
 * Simulate the case where a query has previously-cached data but is currently
 * refetching: isLoading=false (no spinner from TanStack Query) yet data is
 * undefined (the component won't receive it until the fetch completes).
 * This is exactly the gap that caused the empty-grid flash before the
 * isSwitchingFilter fix.
 */
function setPendingForSite(siteId: number, offset: number) {
  pageDataBySiteOffset.set(`${siteId}:${offset}`, {
    data: undefined,
    isLoading: false,
    isFetching: true,
  });
}

// Full params log — each call to useListPosts appends an entry here.
const listPostsParamsSeen: Array<{ offset: number; siteId?: number; childId?: number; activeChildrenOnly?: string; publicationStatus?: string }> = [];

// Track which offsets were requested so tests can assert on the call log.
const listPostsOffsetsSeen: number[] = [];

// Configurable sites list returned by useListSites.
let mockSites: Array<{ id: number; name: string }> = [];
let mockChildren: Array<{ id: number; firstName: string; lastName: string; status: string; siteId: number }> = [];

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
  useListPosts: ({ params }: { params: { limit: number; offset: number; siteId?: number; childId?: number; activeChildrenOnly?: string; publicationStatus?: string } }) => {
    listPostsOffsetsSeen.push(params.offset);
    listPostsParamsSeen.push({ offset: params.offset, siteId: params.siteId, childId: params.childId, activeChildrenOnly: params.activeChildrenOnly, publicationStatus: params.publicationStatus });

    // Site-keyed lookup has priority when siteId is present.
    if (params.siteId !== undefined) {
      const key = `${params.siteId}:${params.offset}`;
      const siteEntry = pageDataBySiteOffset.get(key);
      if (siteEntry) return siteEntry;
    }

    return (
      pageDataByOffset.get(params.offset) ?? {
        data: undefined,
        isLoading: true,
        isFetching: false,
      }
    );
  },
  useListChildren:     () => ({ data: mockChildren, isLoading: false, isError: false }),
  getListChildrenQueryKey: () => ["/api/children"],
  useListSites:        () => ({ data: mockSites }),
  useDeletePost:       () => ({ mutate: vi.fn(), isPending: false }),
  useLikePost:         () => ({ mutate: vi.fn(), isPending: false }),
  useUnlikePost:       () => ({ mutate: vi.fn(), isPending: false }),
  getListPostsQueryKey: () => ["/api/posts"],
}));

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    canDelete:     false,
    canEditPost:   false,
    isEducatorRole: false,
    ownSiteId:     null,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/contexts/auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/posts", vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/post-detail-dialog", () => ({
  PostDetailDialog: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10; // must match the constant in posts.tsx

/** Build a minimal Post object that satisfies the component's rendering. */
function makePost(id: number): Post {
  return {
    id,
    title:       `Test Post ${id}`,
    siteId:      null,
    siteName:    null,
    staffId:     null,
    staffName:   null,
    childIds:    [],
    childNames:  [],
    date:        null,
    images:      [],
    documentPaths: [],
    documentNames: [],
    outcomeIds:  [],
    description: null,
    learning:    null,
    opportunities: null,
    aiSummary:   null,
    publishedAt: null,
    createdAt:   new Date(Date.now() - id * 1000).toISOString(), // distinct timestamps
    likeCount:   0,
    likedByMe:   false,
  } as unknown as Post;
}

/** Generate `n` posts starting at ID `startId`. */
function makePosts(n: number, startId = 1): Post[] {
  return Array.from({ length: n }, (_, i) => makePost(startId + i));
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPosts(qc = makeQueryClient()) {
  return render(
    <QueryClientProvider client={qc}>
      <Posts />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  pageDataByOffset.clear();
  pageDataBySiteOffset.clear();
  listPostsOffsetsSeen.length = 0;
  listPostsParamsSeen.length = 0;
  mockSites = [];
  mockChildren = [];
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Posts page — first page rendering", () => {
  it("shows 10 post cards and a 'Load more' button when the first page is full", async () => {
    setPageData(0, makePosts(PAGE_SIZE));
    renderPosts();

    // All 10 titles appear.
    await waitFor(() => {
      expect(screen.getByText("Test Post 1")).toBeInTheDocument();
      expect(screen.getByText("Test Post 10")).toBeInTheDocument();
    });

    // "Load more" is visible because the page was exactly PAGE_SIZE long.
    expect(
      screen.getByRole("button", { name: /load more/i }),
    ).toBeInTheDocument();
  });

  it("hides 'Load more' when the first page has fewer than PAGE_SIZE posts", async () => {
    setPageData(0, makePosts(5));
    renderPosts();

    await waitFor(() => {
      expect(screen.getByText("Test Post 1")).toBeInTheDocument();
    });

    // Only 5 posts → hasMore = false → no Load more button.
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty-state card when zero posts are returned", async () => {
    setPageData(0, []);
    renderPosts();

    await waitFor(() => {
      expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Posts page — 'Load more' fetches the next page", () => {
  it("appends second-page posts and hides 'Load more' when that page is short", async () => {
    // Page 1: 10 posts (full page → hasMore = true).
    // Page 2: 3 posts  (short  → hasMore = false after loading).
    setPageData(0,  makePosts(PAGE_SIZE, 1));
    setPageData(PAGE_SIZE, makePosts(3, PAGE_SIZE + 1));

    renderPosts();
    const user = userEvent.setup();

    // Wait for the first page to render.
    await waitFor(() => {
      expect(screen.getByText("Test Post 1")).toBeInTheDocument();
      expect(screen.getByText(`Test Post ${PAGE_SIZE}`)).toBeInTheDocument();
    });

    // "Load more" button must be present before clicking.
    const loadMoreBtn = screen.getByRole("button", { name: /load more/i });
    expect(loadMoreBtn).toBeInTheDocument();

    // Click "Load more" — this sets offset to PAGE_SIZE.
    await user.click(loadMoreBtn);

    // Wait for the second page's posts to appear.
    await waitFor(() => {
      expect(
        screen.getByText(`Test Post ${PAGE_SIZE + 1}`),
      ).toBeInTheDocument();
    });

    // Both pages are accumulated — first post of page 1 still visible.
    expect(screen.getByText("Test Post 1")).toBeInTheDocument();

    // "Load more" has disappeared because the second page was shorter than PAGE_SIZE.
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });

  it("requests offset=0 initially and then offset=PAGE_SIZE after 'Load more' is clicked", async () => {
    setPageData(0,         makePosts(PAGE_SIZE, 1));
    setPageData(PAGE_SIZE, makePosts(1, PAGE_SIZE + 1));

    renderPosts();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument(),
    );

    // Initial render must have requested offset=0.
    expect(listPostsOffsetsSeen).toContain(0);

    await user.click(screen.getByRole("button", { name: /load more/i }));

    // After clicking, a request for offset=PAGE_SIZE must have been made.
    await waitFor(() =>
      expect(listPostsOffsetsSeen).toContain(PAGE_SIZE),
    );
  });

  it("keeps 'Load more' visible when the second page is also full", async () => {
    // Both pages are full → hasMore stays true after page 2.
    setPageData(0,          makePosts(PAGE_SIZE, 1));
    setPageData(PAGE_SIZE,  makePosts(PAGE_SIZE, PAGE_SIZE + 1));

    renderPosts();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument(),
    );

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /load more/i }));
    });

    // Both pages were full → "Load more" should still be visible.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /load more/i }),
      ).toBeInTheDocument(),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — 'Load more' preserves the active site filter
//
// Confirms that when a site is selected in the dropdown, clicking "Load more"
// still passes the same siteId to useListPosts (not just a bare offset bump),
// and that only that site's posts accumulate in the list.
// ---------------------------------------------------------------------------

describe("Posts page — 'Load more' preserves the active site filter", () => {
  it("passes siteId on the first-page request when a site is selected", async () => {
    // Two sites available so the dropdown renders.
    mockSites = [
      { id: 7, name: "Sunrise Centre" },
      { id: 9, name: "Harbour View" },
    ];

    // Prime page 1 for site 7.
    setPageDataForSite(7, 0, makePosts(PAGE_SIZE, 1));

    renderPosts();
    const user = userEvent.setup();

    // Select site 7.
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Sunrise Centre"));

    // The component should request page 1 with siteId=7 and offset=0.
    await waitFor(() =>
      expect(listPostsParamsSeen).toContainEqual(
        expect.objectContaining({ siteId: 7, offset: 0 }),
      ),
    );
  });

  it("passes the same siteId on the second page after 'Load more' is clicked", async () => {
    mockSites = [
      { id: 7, name: "Sunrise Centre" },
      { id: 9, name: "Harbour View" },
    ];

    // Prime both pages for site 7.
    setPageDataForSite(7, 0,         makePosts(PAGE_SIZE, 1));
    setPageDataForSite(7, PAGE_SIZE,  makePosts(3, PAGE_SIZE + 1));

    renderPosts();
    const user = userEvent.setup();

    // Select site 7.
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Sunrise Centre"));

    // Wait for first page of site-7 posts to appear.
    await waitFor(() =>
      expect(screen.getByText("Test Post 1")).toBeInTheDocument(),
    );

    // Click "Load more".
    const loadMoreBtn = screen.getByRole("button", { name: /load more/i });
    await user.click(loadMoreBtn);

    // The second request must carry siteId=7 AND offset=PAGE_SIZE.
    await waitFor(() =>
      expect(listPostsParamsSeen).toContainEqual(
        expect.objectContaining({ siteId: 7, offset: PAGE_SIZE }),
      ),
    );

    // Second-page posts are appended — both pages visible.
    await waitFor(() =>
      expect(screen.getByText(`Test Post ${PAGE_SIZE + 1}`)).toBeInTheDocument(),
    );
    expect(screen.getByText("Test Post 1")).toBeInTheDocument();
  });

  it("second-page posts from the filtered site are appended to first-page posts", async () => {
    mockSites = [
      { id: 7, name: "Sunrise Centre" },
      { id: 9, name: "Harbour View" },
    ];

    setPageDataForSite(7, 0,         makePosts(PAGE_SIZE, 1));
    setPageDataForSite(7, PAGE_SIZE,  makePosts(5, PAGE_SIZE + 1));

    renderPosts();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Sunrise Centre"));

    await waitFor(() =>
      expect(screen.getByText("Test Post 1")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /load more/i }));

    // 10 + 5 = 15 posts accumulated; "Load more" gone because page 2 was short.
    await waitFor(() =>
      expect(screen.getByText(`Test Post ${PAGE_SIZE + 5}`)).toBeInTheDocument(),
    );
    expect(screen.getByText("Test Post 1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });
});

describe("Posts active-child feed", () => {
  it("requests active-only published and draft pages before pagination and filters cached inactive-only cards by ID", async () => {
    mockChildren = [
      { id: 101, firstName: "Chopper", lastName: "Example", status: "active", siteId: 7 },
      { id: 102, firstName: "Chopper", lastName: "Example", status: "inactive", siteId: 7 },
      { id: 103, firstName: "Archived", lastName: "Child", status: "archived", siteId: 7 },
    ];
    const active = { ...makePost(1), title: "Active story", childIds: [101] };
    const inactive = { ...makePost(2), title: "Inactive story", childIds: [102] };
    const archived = { ...makePost(3), title: "Archived story", childIds: [103] };
    const mixed = { ...makePost(4), title: "Mixed story", childIds: [101, 102, 103] };
    const general = { ...makePost(5), title: "Organisation-wide story", childIds: [] };
    setPageData(0, [active, inactive, archived, mixed, general]);

    renderPosts();
    expect(await screen.findByText("Active story")).toBeVisible();
    expect(screen.getByText("Mixed story")).toBeVisible();
    expect(screen.getByText("Organisation-wide story")).toBeVisible();
    expect(screen.queryByText("Inactive story")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived story")).not.toBeInTheDocument();
    expect(screen.getByText("Mixed story").closest(".group")).toHaveTextContent("Chopper Example");
    expect(screen.getByText("Mixed story").closest(".group")?.textContent?.match(/Chopper Example/g)).toHaveLength(1);
    expect(listPostsParamsSeen).toContainEqual(expect.objectContaining({
      activeChildrenOnly: "true", publicationStatus: "published", offset: 0,
    }));
    expect(listPostsParamsSeen).toContainEqual(expect.objectContaining({
      activeChildrenOnly: "true", publicationStatus: "draft",
    }));
  });
});

// ---------------------------------------------------------------------------
// Tests — changing the site filter resets the accumulated post list
//
// Confirms that selecting a different site in the dropdown clears the
// accumulated posts (no bleed-over from the previous site) and requests
// offset=0 with the new siteId.
// ---------------------------------------------------------------------------

describe("Posts page — changing the site filter resets accumulated posts", () => {
  it("requests offset=0 with the new siteId after switching sites", async () => {
    mockSites = [
      { id: 7, name: "Sunrise Centre" },
      { id: 9, name: "Harbour View" },
    ];

    setPageDataForSite(7, 0, makePosts(PAGE_SIZE, 1));
    setPageDataForSite(9, 0, makePosts(PAGE_SIZE, 101));

    renderPosts();
    const user = userEvent.setup();

    // Select site 7 first.
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Sunrise Centre"));

    await waitFor(() =>
      expect(screen.getByText("Test Post 1")).toBeInTheDocument(),
    );

    // Switch to site 9.
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Harbour View"));

    // Must request the new site at offset=0 (reset to page 1).
    await waitFor(() =>
      expect(listPostsParamsSeen).toContainEqual(
        expect.objectContaining({ siteId: 9, offset: 0 }),
      ),
    );
  });

  it("shows only the new site's posts after switching — no posts from the previous site", async () => {
    mockSites = [
      { id: 7, name: "Sunrise Centre" },
      { id: 9, name: "Harbour View" },
    ];

    // Site 7 has posts 1–10; site 9 has posts 101–110 (completely different IDs).
    setPageDataForSite(7, 0, makePosts(PAGE_SIZE, 1));
    setPageDataForSite(9, 0, makePosts(PAGE_SIZE, 101));

    renderPosts();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument(),
    );

    // Select site 7.
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Sunrise Centre"));

    await waitFor(() =>
      expect(screen.getByText("Test Post 1")).toBeInTheDocument(),
    );

    // Switch to site 9.
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Harbour View"));

    // Site 9's posts appear.
    await waitFor(() =>
      expect(screen.getByText("Test Post 101")).toBeInTheDocument(),
    );

    // Site 7's posts must no longer be in the DOM (accumulator was reset).
    expect(screen.queryByText("Test Post 1")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton (not old posts, not empty state) while the new filter result is pending", async () => {
    mockSites = [
      { id: 7, name: "Sunrise Centre" },
      { id: 9, name: "Harbour View" },
    ];

    setPageDataForSite(7, 0, makePosts(PAGE_SIZE, 1));
    // Site 9: simulate cached-but-refetching (isLoading=false, data not yet
    // available). This is the gap that caused the empty-grid flash.
    setPendingForSite(9, 0);

    renderPosts();
    const user = userEvent.setup();

    // Select site 7 and wait for its posts to render.
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Sunrise Centre"));
    await waitFor(() => expect(screen.getByText("Test Post 1")).toBeInTheDocument());

    // Switch to site 9 (pending fetch — isLoading=false, no data yet).
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Harbour View"));

    // Site 7 posts must not be visible while loading site 9.
    expect(screen.queryByText("Test Post 1")).not.toBeInTheDocument();

    // The "No posts yet" empty-state must NOT appear — skeleton should show instead.
    expect(screen.queryByText(/no posts yet/i)).not.toBeInTheDocument();

    // Skeleton placeholder cards should be visible.
    const skeletons = document.querySelectorAll(".h-72.rounded-xl");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("load-more after a site switch carries the new siteId — not the old one", async () => {
    mockSites = [
      { id: 7, name: "Sunrise Centre" },
      { id: 9, name: "Harbour View" },
    ];

    setPageDataForSite(7, 0,         makePosts(PAGE_SIZE, 1));
    setPageDataForSite(9, 0,         makePosts(PAGE_SIZE, 101));
    setPageDataForSite(9, PAGE_SIZE,  makePosts(3, 201));

    renderPosts();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument(),
    );

    // Select site 7, then switch to site 9.
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Sunrise Centre"));
    await waitFor(() => expect(screen.getByText("Test Post 1")).toBeInTheDocument());

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Harbour View"));
    await waitFor(() => expect(screen.getByText("Test Post 101")).toBeInTheDocument());

    // Click "Load more" while on site 9.
    await user.click(screen.getByRole("button", { name: /load more/i }));

    // The load-more request must use siteId=9 (not the old siteId=7) and offset=PAGE_SIZE.
    await waitFor(() =>
      expect(listPostsParamsSeen).toContainEqual(
        expect.objectContaining({ siteId: 9, offset: PAGE_SIZE }),
      ),
    );

    // Posts from both pages of site 9 are in the DOM.
    await waitFor(() =>
      expect(screen.getByText("Test Post 201")).toBeInTheDocument(),
    );
    // Site 7's posts are gone.
    expect(screen.queryByText("Test Post 1")).not.toBeInTheDocument();
  });
});
