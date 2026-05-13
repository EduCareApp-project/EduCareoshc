import { useState } from "react";
import { useListQipItems, useCreateQipItem, useUpdateQipItem, useDeleteQipItem } from "@workspace/api-client-react";
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
import { TrendingUp, Plus, Trash2, CheckCircle, PauseCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const QA_AREAS = ["QA 1 – Educational Program", "QA 2 – Children's Health and Safety", "QA 3 – Physical Environment", "QA 4 – Staffing Arrangements", "QA 5 – Relationships with Children", "QA 6 – Collaborative Partnerships", "QA 7 – Governance and Leadership"];

function statusBadge(s: string) {
  const map: Record<string, string> = { in_progress: "bg-blue-100 text-blue-800", completed: "bg-green-100 text-green-800", on_hold: "bg-amber-100 text-amber-800" };
  const labels: Record<string, string> = { in_progress: "In Progress", completed: "Completed", on_hold: "On Hold" };
  return <Badge className={map[s] || ""}>{labels[s] || s}</Badge>;
}

export default function Qip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: items, isLoading } = useListQipItems();
  const createMutation = useCreateQipItem();
  const updateMutation = useUpdateQipItem();
  const deleteMutation = useDeleteQipItem();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ qualityArea: "", goal: "", strategy: "", successMeasure: "", timeline: "", notes: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ data: form as any }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ qualityArea: "", goal: "", strategy: "", successMeasure: "", timeline: "", notes: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/qip"] });
        toast({ title: "QIP item added" });
      },
      onError: () => toast({ title: "Failed to add QIP item", variant: "destructive" }),
    });
  }

  function updateStatus(id: number, status: string) {
    updateMutation.mutate({ id, data: { status } as any }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/qip"] }),
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/qip"] }),
    });
  }

  const grouped = QA_AREAS.reduce<Record<string, typeof items>>((acc, area) => {
    acc[area] = (items ?? []).filter((i) => i.qualityArea === area);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Improvement Plan</h1>
          <p className="text-muted-foreground mt-1">Goals and strategies for continuous improvement across all quality areas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Item</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add QIP Item</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Quality Area</Label>
                <Select value={form.qualityArea} onValueChange={(v) => setForm({ ...form, qualityArea: v })}>
                  <SelectTrigger><SelectValue placeholder="Select quality area" /></SelectTrigger>
                  <SelectContent>{QA_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Goal</Label><Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Strategy</Label><Textarea value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} rows={3} required /></div>
              <div className="space-y-1"><Label>Success Measure</Label><Input value={form.successMeasure} onChange={(e) => setForm({ ...form, successMeasure: e.target.value })} /></div>
              <div className="space-y-1"><Label>Timeline</Label><Input value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} placeholder="e.g. Term 2 2026" /></div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || !form.qualityArea}>Add Item</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : (items ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <TrendingUp className="h-8 w-8 mb-2" />
          <p>No QIP items yet. Add your first improvement goal.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {QA_AREAS.map((area) => {
            const areaItems = grouped[area] ?? [];
            if (areaItems.length === 0) return null;
            return (
              <Card key={area}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{area}</CardTitle>
                </CardHeader>
                <div className="divide-y">
                  {areaItems.map((item) => (
                    <div key={item.id} className="px-6 py-4 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{item.goal}</span>
                            {statusBadge(item.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.strategy}</p>
                          {item.successMeasure && <p className="text-xs text-muted-foreground mt-1">Measure: {item.successMeasure}</p>}
                          {item.timeline && <p className="text-xs text-muted-foreground">Timeline: {item.timeline}</p>}
                          {item.notes && <p className="text-xs text-muted-foreground italic mt-1">{item.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.status !== "completed" && (
                            <Button size="sm" variant="ghost" title="Mark completed" onClick={() => updateStatus(item.id, "completed")}>
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          {item.status === "in_progress" && (
                            <Button size="sm" variant="ghost" title="Put on hold" onClick={() => updateStatus(item.id, "on_hold")}>
                              <PauseCircle className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          {item.status === "on_hold" && (
                            <Button size="sm" variant="ghost" title="Resume" onClick={() => updateStatus(item.id, "in_progress")}>
                              <TrendingUp className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
