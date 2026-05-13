import { useState } from "react";
import { useListPosts, useCreatePost, useUpdatePost, useDeletePost, useListChildren, useListStaff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Send, Newspaper } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Posts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: posts, isLoading } = useListPosts();
  const { data: children } = useListChildren();
  const { data: staff } = useListStaff();
  const createMutation = useCreatePost();
  const updateMutation = useUpdatePost();
  const deleteMutation = useDeletePost();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", postType: "group", childId: "none", staffId: "none" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { title: form.title, content: form.content, postType: form.postType };
    if (form.childId !== "none") data.childId = parseInt(form.childId);
    if (form.staffId !== "none") data.staffId = parseInt(form.staffId);
    createMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ title: "", content: "", postType: "group", childId: "none", staffId: "none" });
        queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
        toast({ title: "Post created" });
      },
      onError: () => toast({ title: "Failed to create post", variant: "destructive" }),
    });
  }

  function handlePublish(id: number) {
    updateMutation.mutate({ id, data: { status: "published" } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/posts"] }),
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/posts"] }),
    });
  }

  const statusBadge = (s: string) => s === "published"
    ? <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
    : <Badge variant="secondary">Draft</Badge>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
          <p className="text-muted-foreground mt-1">Learning posts for individual children or the whole group.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Post</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Post</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Post Type</Label>
                <Select value={form.postType} onValueChange={(v) => setForm({ ...form, postType: v, childId: "none" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="individual">Individual Child</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.postType === "individual" && (
                <div className="space-y-1">
                  <Label>Child</Label>
                  <Select value={form.childId} onValueChange={(v) => setForm({ ...form, childId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a child</SelectItem>
                      {(children ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Author (optional)</Label>
                <Select value={form.staffId} onValueChange={(v) => setForm({ ...form, staffId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No author</SelectItem>
                    {(staff ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Content</Label>
                <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Create Draft</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : (posts ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <Newspaper className="h-8 w-8 mb-2" />
          <p>No posts yet. Create your first post to share learning stories.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(posts ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.title}</span>
                    {statusBadge(p.status)}
                    <Badge variant="outline" className="text-xs">{p.postType === "group" ? "Group" : "Individual"}</Badge>
                    {p.childName && <span className="text-sm text-muted-foreground">— {p.childName}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.staffName && `By ${p.staffName} • `}{format(new Date(p.createdAt), "MMM d, yyyy")}
                    {p.publishedAt && ` • Published ${format(new Date(p.publishedAt), "MMM d, yyyy")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => handlePublish(p.id)} disabled={updateMutation.isPending}>
                      <Send className="h-3 w-3 mr-1" />Publish
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
