import { useListPosts, useDeletePost, getListPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Newspaper, Plus, Trash2, User } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

export default function Posts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: posts, isLoading } = useListPosts();
  const deleteMutation = useDeletePost();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground mt-1">Learning stories and observations shared with families.</p>
        </div>
        <Button onClick={() => setLocation("/posts/new")}>
          <Plus className="h-4 w-4 mr-2" />New Post
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : (posts ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Newspaper className="h-10 w-10 mb-2 opacity-40" />
            <p className="font-medium">No posts yet</p>
            <p className="text-sm">Create your first learning story to share with families.</p>
            <Button className="mt-3" onClick={() => setLocation("/posts/new")}>
              <Plus className="h-4 w-4 mr-2" />New Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...(posts ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((post) => {
            const coverImage = post.images?.[0];
            return (
              <Card
                key={post.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => setLocation(`/posts/${post.id}`)}
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
                  <button
                    onClick={(e) => handleDelete(e, post.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-white/80 hover:bg-white text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug line-clamp-2">{post.title}</h3>
                  </div>
                  {post.childName && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <User className="h-2.5 w-2.5" />{post.childName}
                    </Badge>
                  )}
                  {post.aiSummary ? (
                    <p className="text-sm text-muted-foreground line-clamp-3">{post.aiSummary}</p>
                  ) : post.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-3">{post.description.replace(/<[^>]*>/g, "")}</p>
                  ) : null}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    {post.staffName && <span>{post.staffName}</span>}
                    {post.staffName && post.date && <span>·</span>}
                    {post.date && <span>{format(new Date(post.date + "T00:00:00"), "d MMM yyyy")}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
