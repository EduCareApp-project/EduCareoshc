import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Trash2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { usePermissions } from "@/hooks/use-permissions";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Comment = {
  id: number;
  staffId?: number | null;
  authorName: string;
  body: string;
  createdAt: string;
};

type Props = {
  comments: Comment[];
  queryKey: readonly unknown[];
  onAdd: (body: string) => Promise<void>;
  onDelete: (commentId: number) => Promise<void>;
  isAdding?: boolean;
};

export function StaffCommentSection({ comments, queryKey, onAdd, onDelete, isAdding }: Props) {
  const { user } = useAuth();
  const { canDelete } = usePermissions();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentStaffId = user?.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(body.trim());
      setBody("");
      toast({ title: "Comment added" });
    } catch {
      toast({ title: "Failed to add comment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await onDelete(commentId);
      toast({ title: "Comment deleted" });
    } catch {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Staff Comments
          {comments.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">({comments.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No comments yet. Be the first to add one.</p>
        ) : (
          <div className="space-y-3">
            {comments.map((c, i) => {
              const isOwn = currentStaffId != null && c.staffId === currentStaffId;
              const canRemove = isOwn || canDelete;
              return (
                <div key={c.id}>
                  {i > 0 && <Separator className="mb-3" />}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(c.createdAt), "dd/MM/yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.body}</p>
                    </div>
                    {canRemove && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this comment. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(c.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Separator />

        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="flex-1 resize-none text-sm"
          />
          <Button type="submit" size="sm" disabled={!body.trim() || submitting} className="shrink-0">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {submitting ? "Posting…" : "Post"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
