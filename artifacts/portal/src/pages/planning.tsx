import { useState } from "react";
import { useListPlanningExperiences, useCreatePlanningExperience, useUpdatePlanningExperience, useDeletePlanningExperience, useListOutcomes } from "@workspace/api-client-react";
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
import { Layers, Plus, Trash2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STAGES = ["brainstorm", "planned", "implemented", "evaluated"] as const;
const STAGE_LABELS: Record<string, string> = { brainstorm: "Brainstorm", planned: "Planned", implemented: "Implemented", evaluated: "Evaluated" };
const STAGE_COLORS: Record<string, string> = { brainstorm: "bg-slate-100 border-slate-200", planned: "bg-blue-50 border-blue-200", implemented: "bg-amber-50 border-amber-200", evaluated: "bg-green-50 border-green-200" };
const AGE_GROUPS = ["infant", "toddler", "preschool", "school_age"];
const AGE_LABELS: Record<string, string> = { infant: "Infant", toddler: "Toddler", preschool: "Preschool", school_age: "School Age" };

export default function Planning() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: experiences, isLoading } = useListPlanningExperiences();
  const { data: outcomes } = useListOutcomes();
  const createMutation = useCreatePlanningExperience();
  const updateMutation = useUpdatePlanningExperience();
  const deleteMutation = useDeletePlanningExperience();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", stage: "brainstorm", ageGroups: [] as string[], outcomeIds: [] as number[], startDate: "" });

  function toggleAgeGroup(ag: string) {
    setForm((f) => ({ ...f, ageGroups: f.ageGroups.includes(ag) ? f.ageGroups.filter((a) => a !== ag) : [...f.ageGroups, ag] }));
  }

  function toggleOutcome(id: number) {
    setForm((f) => ({ ...f, outcomeIds: f.outcomeIds.includes(id) ? f.outcomeIds.filter((o) => o !== id) : [...f.outcomeIds, id] }));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { title: form.title, stage: form.stage, outcomeIds: form.outcomeIds, ageGroups: form.ageGroups, childIds: [] };
    if (form.description) data.description = form.description;
    if (form.startDate) data.startDate = form.startDate;
    createMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ title: "", description: "", stage: "brainstorm", ageGroups: [], outcomeIds: [], startDate: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/planning"] });
        toast({ title: "Experience added" });
      },
      onError: () => toast({ title: "Failed to add experience", variant: "destructive" }),
    });
  }

  function advanceStage(exp: { id: number; stage: string }) {
    const idx = STAGES.indexOf(exp.stage as any);
    const next = STAGES[idx + 1];
    if (!next) return;
    updateMutation.mutate({ id: exp.id, data: { stage: next } as any }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/planning"] }),
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/planning"] }),
    });
  }

  const byStage = STAGES.reduce<Record<string, typeof experiences>>((acc, s) => {
    acc[s] = (experiences ?? []).filter((e) => e.stage === s);
    return acc;
  }, {} as any);

  const outcomeLabel = (id: number) => {
    const o = (outcomes ?? []).find((o) => o.id === id);
    return o ? `Outcome ${o.number}` : `#${id}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planning Cycle</h1>
          <p className="text-muted-foreground mt-1">Track planned experiences through the observation-planning-implementation-evaluation cycle.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Experience</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Learning Experience</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="space-y-1"><Label>Initial Stage</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Start Date (optional)</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>MTOP Outcomes</Label>
                <div className="flex flex-wrap gap-2">
                  {(outcomes ?? []).map((o) => (
                    <button key={o.id} type="button" onClick={() => toggleOutcome(o.id)} className={`px-2 py-1 rounded-md text-xs border transition-colors ${form.outcomeIds.includes(o.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                      Outcome {o.number}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2"><Label>Age Groups</Label>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUPS.map((ag) => (
                    <button key={ag} type="button" onClick={() => toggleAgeGroup(ag)} className={`px-2 py-1 rounded-md text-xs border transition-colors ${form.ageGroups.includes(ag) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                      {AGE_LABELS[ag]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Add Experience</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const stageExps = byStage[stage] ?? [];
            return (
              <div key={stage} className={`rounded-lg border p-3 ${STAGE_COLORS[stage]}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
                  <Badge variant="secondary" className="text-xs">{stageExps.length}</Badge>
                </div>
                {stageExps.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No experiences</p>
                ) : (
                  <div className="space-y-2">
                    {stageExps.map((exp) => (
                      <Card key={exp.id} className="shadow-none">
                        <CardContent className="p-3 space-y-2">
                          <p className="font-medium text-sm leading-tight">{exp.title}</p>
                          {exp.description && <p className="text-xs text-muted-foreground line-clamp-2">{exp.description}</p>}
                          <div className="flex flex-wrap gap-1">
                            {exp.outcomeIds.map((id) => <Badge key={id} variant="outline" className="text-xs">{outcomeLabel(id)}</Badge>)}
                            {exp.ageGroups.map((ag) => <Badge key={ag} variant="secondary" className="text-xs">{AGE_LABELS[ag] || ag}</Badge>)}
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            {stage !== "evaluated" ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => advanceStage(exp)} disabled={updateMutation.isPending}>
                                <ArrowRight className="h-3 w-3 mr-1" />{STAGE_LABELS[STAGES[STAGES.indexOf(stage) + 1]]}
                              </Button>
                            ) : <div />}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(exp.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
