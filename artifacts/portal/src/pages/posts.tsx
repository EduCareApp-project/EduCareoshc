import { useListPosts, useDeletePost, getListPostsQueryKey, useListSites, useLikePost, useUnlikePost } from "@workspace/api-client-react";
import { useActiveChildren } from "@/hooks/use-active-children";
import { hasActiveChildLink } from "@/lib/active-children";
import { usePermissions } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, Plus, Trash2, User, ArrowLeft, Heart, MessageCircle, FileEdit } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { useAuth } from "@/contexts/auth";
import type { Post } from "@workspace/api-client-react";

const PAGE_SIZE = 10;

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

export default function Posts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedPostStaffId, setSelectedPostStaffId] = useState<number | null>(null);

  const childIdParam = new URLSearchParams(window.location.search).get("childId");
  const filterChildId = childIdParam ? parseInt(childIdParam) : null;

  const childrenQuery = useActiveChildren();
  const { data: children } = childrenQuery;
  const { data: sites } = useListSites();
  const { canDelete, canEditPost, isEducatorRole, ownSiteId } = usePermissions();
  const deleteMutation = useDeletePost();
  const [siteFilter, setSiteFilter] = useState<string>("all");

  // Server-side pagination state
  const [offset, setOffset] = useState(0);
  const [accumulatedPosts, setAccumulatedPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  // True from the moment the site filter changes until the first offset-0
  // response for the new filter arrives. Prevents an empty-grid flash when
  // the query has cached data (isLoading=false) but accumulatedPosts has
  // already been cleared.
  const [isSwitchingFilter, setIsSwitchingFilter] = useState(false);

  // Compute server-side filter params
  const serverSiteId = isEducatorRole && ownSiteId
    ? ownSiteId
    : siteFilter !== "all"
      ? parseInt(siteFilter)
      : undefined;

  // Server-side pagination fetch
  const { data: pageData, isLoading, isFetching } = useListPosts({
    params: {
      activeChildrenOnly: "true",
      limit: PAGE_SIZE,
      offset,
      ...(filterChildId ? { childId: filterChildId } : {}),
      ...(serverSiteId !== undefined ? { siteId: serverSiteId } : {}),
      publicationStatus: "published",
    },
  });
  const { data: draftPosts, isLoading: draftsLoading } = useListPosts({
    params: {
      activeChildrenOnly: "true",
      ...(filterChildId ? { childId: filterChildId } : {}),
      ...(serverSiteId !== undefined ? { siteId: serverSiteId } : {}),
      publicationStatus: "draft",
    },
  });

  // A reactivated child can make previously excluded posts eligible again.
  // Refresh the server-paginated feed when membership of the active set changes.
  const activeChildKey = children?.map((child) => child.id).sort((a, b) => a - b).join(",");
  const previousActiveChildKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (activeChildKey === undefined) return;
    if (previousActiveChildKey.current !== undefined && previousActiveChildKey.current !== activeChildKey) {
      setOffset(0);
      setAccumulatedPosts([]);
      setHasMore(true);
      setIsSwitchingFilter(true);
      void queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    }
    previousActiveChildKey.current = activeChildKey;
  }, [activeChildKey, queryClient]);

  // Accumulate pages as they arrive
  const lastPageDataRef = useRef<Post[] | undefined>(undefined);
  useEffect(() => {
    if (pageData === undefined || pageData === lastPageDataRef.current) return;
    lastPageDataRef.current = pageData;
    if (offset === 0) {
      setAccumulatedPosts(pageData);
      // New filter's first page has arrived — skeleton can be dismissed.
      setIsSwitchingFilter(false);
    } else {
      setAccumulatedPosts((prev) => {
        // Deduplicate by id in case of invalidations
        const existingIds = new Set(prev.map((p) => p.id));
        const newPosts = pageData.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
    }
    setHasMore(pageData.length === PAGE_SIZE);
  }, [pageData, offset]);

  function setSiteFilterAndReset(v: string) {
    setSiteFilter(v);
    setOffset(0);
    setAccumulatedPosts([]);
    setHasMore(true);
    // Show skeleton immediately so the cleared list never appears as an
    // empty grid — even when the new query has cached data (isLoading=false).
    setIsSwitchingFilter(true);
  }

  const showSiteFilter = !isEducatorRole && (sites ?? []).length > 1;

  const filteredChild = filterChildId
    ? (children ?? []).find((c) => c.id === filterChildId)
    : null;

  const filteredChildName = filteredChild
    ? `${filteredChild.firstName} ${filteredChild.lastName}`
    : null;

  // Recheck cached pages when a child's status changes. Never match by name.
  const activeIds = new Set((children ?? []).map((child) => child.id));
  const isVisiblePost = (post: Post) => children !== undefined
    && (!filterChildId || activeIds.has(filterChildId))
    && hasActiveChildLink(post.childIds ?? [], activeIds);
  const displayedPosts = accumulatedPosts.filter(isVisiblePost);
  const displayedDrafts = (draftPosts ?? []).filter(isVisiblePost);

  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();

  function handleLike(e: React.MouseEvent, postId: number, likedByMe: boolean) {
    e.stopPropagation();
    const mutation = likedByMe ? unlikeMutation : likeMutation;
    mutation.mutate({ id: postId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        setOffset(0);
        setAccumulatedPosts([]);
        setHasMore(true);
      },
      onError: () => toast({ title: "Could not update like", variant: "destructive" }),
    });
  }

  function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm("Delete this post?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        setOffset(0);
        setAccumulatedPosts([]);
        setHasMore(true);
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast({ title: "Post deleted" });
      },
      onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
    });
  }

  function handleLoadMore() {
    setOffset((prev) => prev + PAGE_SIZE);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          {filterChildId && (
            <Link href="/posts">
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-1">
                <ArrowLeft className="h-3.5 w-3.5" />All posts
              </button>
            </Link>
          )}
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground">
            {filteredChildName
              ? `Showing all posts for ${filteredChildName}.`
              : "Learning stories and observations shared with families."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showSiteFilter && (
            <Select value={siteFilter} onValueChange={setSiteFilterAndReset}>
              <SelectTrigger className="w-48 bg-card">
                <SelectValue placeholder="All sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setLocation("/posts/new")}>
            <Plus className="h-4 w-4 mr-2" />New Post
          </Button>
        </div>
      </div>

      {childrenQuery.isError && (
        <div role="alert" className="text-destructive">
          Active children could not be loaded.
          <Button variant="link" onClick={() => void childrenQuery.refetch()}>Retry</Button>
        </div>
      )}
      {!childrenQuery.isError && !draftsLoading && displayedDrafts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 space-y-3">
            <div>
              <h2 className="font-semibold">Saved drafts</h2>
              <p className="text-sm text-muted-foreground">Continue working on these posts before publishing.</p>
            </div>
            <div className="divide-y rounded-md border bg-card">
              {displayedDrafts.map((post) => (
                <div key={post.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileEdit className="h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{post.title || "Untitled post"}</span>
                    <span className="text-muted-foreground">
                      {post.staffName ? ` · ${post.staffName}` : ""}
                      {post.date ? ` · ${format(new Date(post.date.slice(0, 10) + "T00:00:00"), "dd/MM/yyyy")}` : ""}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setLocation(`/posts/${post.id}/edit`)}>
                    Continue
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {childrenQuery.isError ? null : (isLoading && accumulatedPosts.length === 0) || childrenQuery.isLoading || isSwitchingFilter ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : (
        <>
          {displayedPosts.length === 0 && !hasMore ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Newspaper className="h-10 w-10 mb-2 opacity-40" />
                <p className="font-medium">
                  {filteredChildName ? `No posts for ${filteredChildName}` : "No posts yet"}
                </p>
                {!filteredChildName && (
                  <p className="text-sm">Create your first learning story to share with families.</p>
                )}
                <Button className="mt-3" onClick={() => setLocation("/posts/new")}>
                  <Plus className="h-4 w-4 mr-2" />New Post
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedPosts.map((post) => {
                const coverImage = post.images?.[0];
                return (
                  <Card
                    key={post.id}
                    className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => { setSelectedPostId(post.id); setSelectedPostStaffId(post.staffId ?? null); }}
                  >
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      {coverImage ? (
                        <img
                          src={imageUrl(coverImage)}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Newspaper className="h-10 w-10 text-muted-foreground opacity-30" />
                        </div>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => handleDelete(e, post.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-md bg-white/80 hover:bg-white text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-snug line-clamp-2">{post.title}</h3>
                      </div>
                      {(post.childIds ?? []).some((id) => activeIds.has(id)) && (
                        <div className="flex flex-wrap gap-1">
                          {(children ?? []).filter((child) => post.childIds?.includes(child.id)).map((child) => (
                            <Badge key={child.id} variant="secondary" className="text-xs gap-1">
                              <User className="h-2.5 w-2.5" />{child.firstName} {child.lastName}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {post.aiSummary ? (
                        <p className="text-sm text-muted-foreground line-clamp-3">{post.aiSummary}</p>
                      ) : post.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-3">{post.description.replace(/<[^>]*>/g, "")}</p>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {post.staffName && <span>{post.staffName}</span>}
                          {post.staffName && post.date && <span>·</span>}
                          {post.date && <span>{format(new Date(post.date.slice(0, 10) + "T00:00:00"), "dd/MM/yyyy")}</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Comment count badge — red dot when there are unviewed comments on home-site posts */}
                          {(post.commentCount ?? 0) > 0 && (
                            <div className="relative flex items-center gap-1 text-xs text-muted-foreground">
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span>{post.commentCount}</span>
                              {(post.unviewedCommentCount ?? 0) > 0 && (
                                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 leading-none">
                                  {post.unviewedCommentCount}
                                </span>
                              )}
                            </div>
                          )}
                          <button
                            onClick={(e) => handleLike(e, post.id, post.likedByMe)}
                            className={`flex items-center gap-1 text-xs transition-colors select-none ${
                              post.likedByMe
                                ? "text-rose-500 hover:text-rose-600"
                                : "text-muted-foreground hover:text-rose-500"
                            }`}
                          >
                            <Heart
                              className="h-3.5 w-3.5"
                              fill={post.likedByMe ? "currentColor" : "none"}
                            />
                            {post.likeCount > 0 && <span>{post.likeCount}</span>}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleLoadMore} disabled={isFetching}>
                {isFetching ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <PostDetailDialog
        activeChildren={children}
        postId={selectedPostId}
        open={selectedPostId !== null}
        onClose={() => setSelectedPostId(null)}
        canDelete={canDelete}
        canEditPost={canEditPost || (user?.id != null && selectedPostStaffId === user.id)}
        onDeleted={() => setSelectedPostId(null)}
        defaultCommentName={user?.name}
      />
    </div>
  );
}
