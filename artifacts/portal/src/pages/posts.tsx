import { useListPosts, useListChildren, useDeletePost, getListPostsQueryKey, useListSites, useLikePost, useUnlikePost } from "@workspace/api-client-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, Plus, Trash2, User, ArrowLeft, Heart } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { useAuth } from "@/contexts/auth";

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

  const { data: posts, isLoading } = useListPosts();
  const { data: children } = useListChildren();
  const { data: sites } = useListSites();
  const { canDelete, canEditPost, isEducatorRole, ownSiteId } = usePermissions();
  const deleteMutation = useDeletePost();
  const [siteFilter, setSiteFilter] = useState<string>("all");

  const showSiteFilter = !isEducatorRole && (sites ?? []).length > 1;

  const filteredChild = filterChildId
    ? (children ?? []).find((c) => c.id === filterChildId)
    : null;

  const filteredChildName = filteredChild
    ? `${filteredChild.firstName} ${filteredChild.lastName}`
    : null;

  const displayedPosts = (filterChildId
    ? (posts ?? []).filter((p) => (p.childIds ?? []).includes(filterChildId))
    : (posts ?? [])
  ).filter((p) => {
    if (isEducatorRole && ownSiteId) return p.siteId === ownSiteId;
    if (!isEducatorRole && siteFilter !== "all") return p.siteId === parseInt(siteFilter);
    return true;
  });

  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();

  function handleLike(e: React.MouseEvent, postId: number, likedByMe: boolean) {
    e.stopPropagation();
    const mutation = likedByMe ? unlikeMutation : likeMutation;
    mutation.mutate({ id: postId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() }),
      onError: () => toast({ title: "Could not update like", variant: "destructive" }),
    });
  }

  function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    if (!confirm("Delete this post?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast({ title: "Post deleted" });
      },
      onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
    });
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
            <Select value={siteFilter} onValueChange={setSiteFilter}>
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : displayedPosts.length === 0 ? (
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
          {[...displayedPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((post) => {
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
                  {post.childNames && post.childNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.childNames.map((name) => (
                        <Badge key={name} variant="secondary" className="text-xs gap-1">
                          <User className="h-2.5 w-2.5" />{name}
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PostDetailDialog
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
