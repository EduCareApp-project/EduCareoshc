import { useRoute, useLocation } from "wouter";
import { useGetPost, useDeletePost, getListPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2, User, CalendarDays, GraduationCap, Building2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

function TextSection({ heading, content }: { heading: string; content: string | null | undefined }) {
  if (!content?.trim()) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h2>
      <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
        {content}
      </div>
    </section>
  );
}

export default function PostDetail() {
  const [, params] = useRoute("/posts/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const id = params?.id ? parseInt(params.id) : 0;
  const { data: post, isLoading } = useGetPost(id, { query: { enabled: id > 0 } });
  const deleteMutation = useDeletePost();

  function handleDelete() {
    if (!confirm("Delete this post permanently?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast({ title: "Post deleted" });
        setLocation("/posts");
      },
      onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 text-muted-foreground">
        <p>Post not found.</p>
        <Button variant="link" onClick={() => setLocation("/posts")}>Back to Posts</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/posts")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive gap-1.5"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />Delete
        </Button>
      </div>

      <article className="space-y-6">
        <div className="space-y-3">
          {post.childNames && post.childNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.childNames.map((name) => (
                <Badge key={name} variant="secondary" className="gap-1.5">
                  <User className="h-3 w-3" />{name}
                </Badge>
              ))}
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight leading-tight">{post.title}</h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {post.staffName && (
              <span className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />{post.staffName}
              </span>
            )}
            {post.date && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(new Date(post.date.slice(0, 10) + "T00:00:00"), "d MMMM yyyy")}
              </span>
            )}
            {post.siteName && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />{post.siteName}
              </span>
            )}
          </div>
        </div>

        {post.images && post.images.length > 0 && (
          <div className={`grid gap-3 ${
            post.images.length === 1 ? "grid-cols-1" :
            post.images.length === 2 ? "grid-cols-2" :
            "grid-cols-3"
          }`}>
            {post.images.map((img, idx) => (
              <div key={idx} className={`rounded-xl overflow-hidden bg-muted ${post.images.length === 1 ? "aspect-video" : "aspect-square"}`}>
                <img
                  src={imageUrl(img)}
                  alt={`${post.title} — image ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6 divide-y divide-border">
          <TextSection heading="Description" content={post.description} />
          {post.learning && <div className="pt-6"><TextSection heading="What learning is happening here?" content={post.learning} /></div>}
          {post.opportunities && <div className="pt-6"><TextSection heading="Opportunities and possibilities — What's next?" content={post.opportunities} /></div>}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-4">
          Posted {format(new Date(post.createdAt), "d MMM yyyy 'at' h:mm a")}
        </p>
      </article>
    </div>
  );
}
