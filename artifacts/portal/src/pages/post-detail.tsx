import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";
import { useRoute, useLocation } from "wouter";
import {
  useGetPost, getGetPostQueryKey, useDeletePost, getListPostsQueryKey,
  useListPostComments, useCreatePostComment, useDeletePostComment,
  getListPostCommentsQueryKey, useLikePost, useUnlikePost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Pencil, User, CalendarDays, GraduationCap, Building2, MessageCircle, Send, FileText, Heart } from "lucide-react";
import { bubbleClassForSub, dotClassForSub } from "@/components/read-only-plan-view";
import { usePermissions } from "@/hooks/use-permissions";
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

function CommentSection({
  postId,
  likedByMe,
  likeCount,
  onLike,
  likeDisabled,
}: {
  postId: number;
  likedByMe?: boolean;
  likeCount?: number;
  onLike?: () => void;
  likeDisabled?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");

  const { data: comments = [], isLoading } = useListPostComments(postId);
  const createMutation = useCreatePostComment();
  const deleteMutation = useDeletePostComment();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !body.trim()) return;
    createMutation.mutate(
      { id: postId, data: { authorName: authorName.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPostCommentsQueryKey(postId) });
          setAuthorName("");
          setBody("");
          toast({ title: "Comment added" });
        },
        onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
      }
    );
  }

  function handleDelete(commentId: number) {
    deleteMutation.mutate(
      { id: postId, commentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPostCommentsQueryKey(postId) });
          toast({ title: "Comment deleted" });
        },
        onError: () => toast({ title: "Failed to delete comment", variant: "destructive" }),
      }
    );
  }

  return (
    <section className="space-y-5 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          Comments
          {comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
          )}
        </h2>
        {onLike && (
          <button
            onClick={onLike}
            disabled={likeDisabled}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all select-none active:scale-95 disabled:opacity-50 ${
              likedByMe
                ? "bg-rose-50 border-rose-300 text-rose-500 hover:bg-rose-100"
                : "bg-background border-border text-muted-foreground hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50"
            }`}
          >
            <Heart
              className="h-4 w-4 transition-transform active:scale-110"
              fill={likedByMe ? "currentColor" : "none"}
            />
            {likeCount && likeCount > 0 ? <span>{likeCount}</span> : null}
            <span>{likedByMe ? "Liked" : "Like"}</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to leave one.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 group">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                {c.authorName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.authorName}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(c.createdAt), "dd/MM/yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(c.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4 bg-muted/30">
        <p className="text-sm font-medium">Leave a comment</p>
        <Input
          placeholder="Your name"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="bg-background"
        />
        <Textarea
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="bg-background resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!authorName.trim() || !body.trim() || createMutation.isPending}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {createMutation.isPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default function PostDetail() {
  const [, params] = useRoute("/posts/:id");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const id = params?.id ? parseInt(params.id) : 0;
  const backPath = new URLSearchParams(window.location.search).get("back") ?? "/posts";
  const { data: post, isLoading } = useGetPost(id, { query: { queryKey: getGetPostQueryKey(id), enabled: id > 0 } });
  const deleteMutation = useDeletePost();
  const { canDelete, canEditPost, ownId } = usePermissions();

  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();

  function handleLike() {
    if (!post) return;
    const mutation = post.likedByMe ? unlikeMutation : likeMutation;
    mutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      },
      onError: () => toast({ title: "Could not update like", variant: "destructive" }),
    });
  }

  function handleDelete() {
    if (!confirm("Delete this post permanently?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast({ title: "Post deleted" });
        setLocation(backPath);
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
        <Button variant="link" onClick={() => setLocation(backPath)}>Back to Posts</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setLocation(backPath)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>
        <div className="flex items-center gap-1">
          {(canEditPost || (ownId != null && post.staffId === ownId)) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => setLocation(`/posts/${id}/edit`)}
            >
              <Pencil className="h-4 w-4" />Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive gap-1.5"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          )}
        </div>
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
                {format(new Date(post.date.slice(0, 10) + "T00:00:00"), "dd/MM/yyyy")}
              </span>
            )}
            {post.siteName && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />{post.siteName}
              </span>
            )}
          </div>

          {(post.outcomeIds ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(post.outcomeIds ?? []).map((subId) => (
                <span
                  key={subId}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${bubbleClassForSub(String(subId))}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClassForSub(String(subId))}`} />
                  {subId}
                </span>
              ))}
            </div>
          )}
        </div>

        {post.images && post.images.length > 0 && (
          <>
            <div className={`grid gap-3 ${
              post.images.length === 1 ? "grid-cols-1" :
              post.images.length === 2 ? "grid-cols-2" :
              "grid-cols-3"
            }`}>
              {post.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`rounded-xl overflow-hidden bg-muted cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    post.images.length === 1 ? "aspect-video" : "aspect-square"
                  }`}
                  onClick={() => setLightboxIndex(idx)}
                  aria-label={`View image ${idx + 1} full size`}
                >
                  <img
                    src={imageUrl(img)}
                    alt={`${post.title} — image ${idx + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                  />
                </button>
              ))}
            </div>
            {lightboxIndex !== null && (
              <ImageLightbox
                images={post.images.map(imageUrl)}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onNext={() => setLightboxIndex((i) => ((i ?? 0) + 1) % post.images.length)}
                onPrev={() => setLightboxIndex((i) => ((i ?? 0) - 1 + post.images.length) % post.images.length)}
              />
            )}
          </>
        )}

        {post.documentPaths && post.documentPaths.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Attachments</h2>
            <div className="space-y-1.5">
              {post.documentPaths.map((path, idx) => {
                const name = post.documentNames?.[idx] ?? path.split("/").pop() ?? `Document ${idx + 1}`;
                const stripped = path.replace(/^\/objects\//, "");
                const url = `/api/storage/objects/${stripped}`;
                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-muted/40 hover:bg-muted transition-colors text-sm"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-6 divide-y divide-border">
          <TextSection heading="Description" content={post.description} />
          {post.learning && <div className="pt-6"><TextSection heading="What learning is happening here?" content={post.learning} /></div>}
          {post.opportunities && <div className="pt-6"><TextSection heading="Opportunities and possibilities — What's next?" content={post.opportunities} /></div>}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-4">
          Posted {format(new Date(post.createdAt), "dd/MM/yyyy 'at' h:mm a")}
        </p>

        <CommentSection
          postId={id}
          likedByMe={post.likedByMe}
          likeCount={post.likeCount}
          onLike={handleLike}
          likeDisabled={likeMutation.isPending || unlikeMutation.isPending}
        />
      </article>
    </div>
  );
}
