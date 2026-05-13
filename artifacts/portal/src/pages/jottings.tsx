import { useState } from "react";
import { useListJottings, useCreateJotting, useDeleteJotting, useListChildren, useListSites } from "@workspace/api-client-react";
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
  const { data: sites } = useListSites();
  const createMutation = useCreateJotting();
  const deleteMutation = useDeleteJotting();

  const [content, setContent] = useState("");
  const [childId, setChildId] = useState<string>("none");
  const [captureSite, setCaptureSite] = useState<string>("all");
  const [listSiteFilter, setListSiteFilter] = useState<string>("all");

  // Map childId → siteId for client-side filtering
  const childSiteMap = new Map((children ?? []).map((c) => [c.id, c.siteId ?? null]));

  // Children shown in the capture form, narrowed by the capture site selector
  const captureChildren = (children ?? []).filter((c) =>
    captureSite === "all" ? true : String(c.siteId ?? "") === captureSite,
  );

  function handleCaptureSiteChange(val: string) {
    setCaptureSite(val);
    setChildId("none"); // reset child when site changes
  }

  const sorted = [...(jottings ?? [])].reverse().filter((j) => {
    if (listSiteFilter === "all") return true;
    if (!j.childId) return listSiteFilter === "none";
    return listSiteFilter === "none" ? false : childSiteMap.get(j.childId) === parseInt(listSiteFilter);
  });

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

  const showSiteFilter = sites && sites.length > 0;

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
            {sites && sites.length > 0 && (
              <Select value={captureSite} onValueChange={handleCaptureSiteChange}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Link to a child (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No child linked</SelectItem>
                {captureChildren.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Write a jotting..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="resize-none"
            />

            <Button type="submit" disabled={!content.trim() || createMutation.isPending}>
              Save Jotting
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Site filter for the list */}
      {showSiteFilter && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground shrink-0">Filter by site:</span>
          <Select value={listSiteFilter} onValueChange={setListSiteFilter}>
            <SelectTrigger className="w-52 bg-card">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              <SelectItem value="none">No site (unlinked or no child)</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : sorted.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <StickyNote className="h-8 w-8 mb-2" />
            <p>{listSiteFilter !== "all" ? "No jottings match this site filter." : "No jottings yet. Write your first one above."}</p>
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
