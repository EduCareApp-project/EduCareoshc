import { useState } from "react";
import { useListJottings, useCreateJotting, useDeleteJotting, useListChildren } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, StickyNote } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Jottings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: jottings, isLoading } = useListJottings();
  const { data: children } = useListChildren();
  const createMutation = useCreateJotting();
  const deleteMutation = useDeleteJotting();

  const [content, setContent] = useState("");
  const [childId, setChildId] = useState<string>("none");

  const sorted = [...(jottings ?? [])].reverse();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    const data: Record<string, unknown> = { content };
    if (childId !== "none") data.childId = parseInt(childId);
    createMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setContent("");
        setChildId("none");
        queryClient.invalidateQueries({ queryKey: ["/api/jottings"] });
      },
      onError: () => toast({ title: "Failed to save jotting", variant: "destructive" }),
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/jottings"] }),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jottings</h1>
        <p className="text-muted-foreground mt-1">Quick notes and observations captured on the go.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Quick Capture</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              placeholder="Write a jotting..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Link to a child (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No child linked</SelectItem>
                  {(children ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!content.trim() || createMutation.isPending}>
                Save Jotting
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : sorted.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <StickyNote className="h-8 w-8 mb-2" />
            <p>No jottings yet. Write your first one above.</p>
          </CardContent></Card>
        ) : sorted.map((j) => (
          <Card key={j.id}>
            <CardContent className="py-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{j.content}</p>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span>{format(new Date(j.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                  {j.childName && <><span>•</span><span className="font-medium text-foreground/70">{j.childName}</span></>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(j.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
