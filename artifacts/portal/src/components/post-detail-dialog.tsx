import { useState } from "react";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  useGetPost, useDeletePost, getListPostsQueryKey,
  getGetPostQueryKey,
  useListPostComments, useCreatePostComment, useDeletePostComment,
  getListPostCommentsQueryKey, useLikePost, useUnlikePost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, User, CalendarDays, GraduationCap, Building2, MessageCircle, Send, Heart } from "lucide-react";
import { bubbleClassForSub, dotClassForSub } from "@/components/read-only-plan-view";
import { useLocation } from "wouter";
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h3>
      <div
        className="text-sm text-foreground prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </section>
  );
}

interface PostDetailDialogProps {
  postId: number | null;
  open: boolean;
  onClose: () => void;
  canDelete?: boolean;
  canEditPost?: boolean;
  onDeleted?: () => void;
  defaultCommentName?: string;
}

export function PostDetailDialog({
  postId,
  open,
  onClose,
  canDelete,
  canEditPost,
  onDeleted,
  defaultCommentName,
}: PostDetailDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authorName, setAuthorName] = useState(defaultCommentName ?? "");
  const [body, setBody] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { data: post, isLoading } = useGetPost(postId ?? 0, {
    query: { queryKey: getGetPostQueryKey(postId ?? 0), enabled: open && (postId ?? 0) > 0 },
  });

  const { data: comments = [], isLoading: commentsLoading } = useListPostComments(postId ?? 0, {
    query: { queryKey: getListPostCommentsQueryKey(postId ?? 0), enabled: open && (postId ?? 0) > 0 },
  });

  const deleteMutation = useDeletePost();
  const createComment = useCreatePostComment();
  const deleteComment = useDeletePostComment();
  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();

  function handleLike() {
    if (!postId || !post) return;
    const mutation = post.likedByMe ? unlikeMutation : likeMutation;
    mutation.mutate({ id: postId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      },
      onError: () => toast({ title: "Could not update like", variant: "destructive" }),
    });
  }

  function handleDelete() {
    if (!postId || !confirm("Delete this post permanently?")) return;
    deleteMutation.mutate({ id: postId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        toast({ title: "Post deleted" });
        onDeleted?.();
        onClose();
      },
      onError: () => toast({ title: "Failed to delete post", variant: "destructive" }),
    });
  }

  function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!postId || !authorName.trim() || !body.trim()) return;
    createComment.mutate(
      { id: postId, data: { authorName: authorName.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPostCommentsQueryKey(postId) });
          setBody("");
          if (!defaultCommentName) setAuthorName("");
          toast({ title: "Comment added" });
        },
        onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
      }
    );
  }

  function handleDeleteComment(commentId: number) {
    if (!postId) return;
    deleteComment.mutate(
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
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col"
      >
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !post ? null : (
          <article className="flex flex-col flex-1">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-6 py-4 flex items-start justify-between gap-3">
              <SheetHeader className="flex-1 text-left space-y-0">
                {post.childNames && post.childNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {post.childNames.map((name) => (
                      <Badge key={name} variant="secondary" className="gap-1 text-xs">
                        <User className="h-2.5 w-2.5" />{name}
                      </Badge>
                    ))}
                  </div>
                )}
                <SheetTitle className="text-xl font-bold leading-snug">{post.title}</SheetTitle>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                  {post.staffName && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />{post.staffName}
                    </span>
                  )}
                  {post.date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(post.date.slice(0, 10) + "T00:00:00"), "dd/MM/yyyy")}
                    </span>
                  )}
                  {post.siteName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />{post.siteName}
                    </span>
                  )}
                </div>
              </SheetHeader>
              <div className="flex items-center gap-1 shrink-0">
                {canEditPost && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => { onClose(); setLocation(`/posts/${postId}/edit`); }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive gap-1.5 -mr-1"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-5 space-y-6">
              {/* Images */}
              {post.images && post.images.length > 0 && (
                <>
                  <div className={`grid gap-2 ${
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

              {/* MTOP Outcomes */}
              {(post.outcomeIds ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MTOP Outcomes</p>
                  <div className="flex flex-wrap gap-1.5">
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
                </div>
              )}

              {/* Content sections */}
              <div className="space-y-5">
                <TextSection heading="Description" content={post.description} />
                <TextSection heading="What learning is happening here?" content={post.learning} />
                <TextSection heading="Opportunities and possibilities — What's next?" content={post.opportunities} />
              </div>

              <p className="text-xs text-muted-foreground border-t pt-4">
                Posted {format(new Date(post.createdAt), "dd/MM/yyyy 'at' h:mm a")}
              </p>

              {/* Comments */}
              <section className="space-y-4 border-t pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    Comments
                    {comments.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
                    )}
                  </h3>
                  <button
                    onClick={handleLike}
                    disabled={likeMutation.isPending || unlikeMutation.isPending}
                    className={`flex items-center gap-1.5 text-sm transition-colors select-none ${
                      post.likedByMe
                        ? "text-rose-500 hover:text-rose-600"
                        : "text-muted-foreground hover:text-rose-500"
                    }`}
                  >
                    <Heart
                      className="h-4 w-4 transition-transform active:scale-110"
                      fill={post.likedByMe ? "currentColor" : "none"}
                    />
                    <span>{post.likeCount && post.likeCount > 0 ? post.likeCount : ""}</span>
                    <span>{post.likedByMe ? "Liked" : "Like"}</span>
                  </button>
                </div>

                {commentsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet. Be the first to leave one.</p>
                ) : (
                  <div className="space-y-3">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-3 group">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {c.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{c.authorName}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(c.createdAt), "dd/MM/yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteComment(c.id)}
                                disabled={deleteComment.isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSubmitComment} className="space-y-2 rounded-lg border p-3 bg-muted/30">
                  <p className="text-xs font-medium">Leave a comment</p>
                  {!defaultCommentName && (
                    <Input
                      placeholder="Your name"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="bg-background text-sm h-8"
                    />
                  )}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Write a comment…"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={2}
                      className="bg-background resize-none text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitComment(e as any); }
                      }}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!authorName.trim() || !body.trim() || createComment.isPending}
                      className="self-end gap-1"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          </article>
        )}
      </SheetContent>
    </Sheet>
  );
}
