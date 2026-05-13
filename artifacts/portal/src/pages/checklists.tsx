import { useState } from "react";
import { useListChecklists, useCreateChecklist, useCompleteChecklist, useGetChecklistCompletions, useListStaff } from "@workspace/api-client-react";
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
import { CheckSquare, Plus, Trash2, CheckCircle2, Circle, X } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const CHECKLIST_TYPES: Record<string, string> = { monthly_programming: "Monthly Programming", quality_improvement: "Quality Improvement", start_of_term: "Start of Term", end_of_term: "End of Term", general: "General" };

function SelectedChecklist({ checklistId, staff }: { checklistId: number; staff: { id: number; firstName: string; lastName: string }[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: completions, isLoading } = useGetChecklistCompletions(checklistId, { query: { enabled: true } });
  const completeMutation = useCompleteChecklist();
  const [staffId, setStaffId] = useState("");
  const [notes, setNotes] = useState("");

  function handleComplete() {
    const data: Record<string, unknown> = {};
    if (staffId) data.staffId = parseInt(staffId);
    if (notes) data.notes = notes;
    completeMutation.mutate({ id: checklistId, data: data as any }, {
      onSuccess: () => {
        setStaffId("");
        setNotes("");
        queryClient.invalidateQueries({ queryKey: [`/api/checklists/${checklistId}/completions`] });
        toast({ title: "Checklist completed" });
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 space-y-3">
        <p className="font-medium text-sm">Mark as Completed</p>
        <Select value={staffId} onValueChange={setStaffId}>
          <SelectTrigger><SelectValue placeholder="Completed by (optional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">No staff selected</SelectItem>
            {staff.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <Button className="w-full" onClick={handleComplete} disabled={completeMutation.isPending}>
          <CheckCircle2 className="h-4 w-4 mr-2" />Mark Complete
        </Button>
      </div>

      <div>
        <p className="font-medium text-sm mb-2">Completion History</p>
        {isLoading ? <Skeleton className="h-16 w-full" /> : (completions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No completions yet.</p>
        ) : (
          <div className="space-y-2">
            {[...(completions ?? [])].reverse().map((c) => (
              <div key={c.id} className="text-sm border rounded-md p-3">
                <p className="font-medium">{format(new Date(c.completedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                {c.staffName && <p className="text-muted-foreground text-xs">By {c.staffName}</p>}
                {c.notes && <p className="text-muted-foreground text-xs mt-1 italic">{c.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Checklists() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: checklists, isLoading } = useListChecklists();
  const { data: staff } = useListStaff();
  const createMutation = useCreateChecklist();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", type: "general", items: [""] });
  const selectedChecklist = (checklists ?? []).find((c) => c.id === selected);

  function addItem() { setForm({ ...form, items: [...form.items, ""] }); }
  function removeItem(i: number) { setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) }); }
  function updateItem(i: number, val: string) { const items = [...form.items]; items[i] = val; setForm({ ...form, items }); }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const items = form.items.filter((i) => i.trim());
    createMutation.mutate({ data: { title: form.title, type: form.type as any, items } }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ title: "", type: "general", items: [""] });
        queryClient.invalidateQueries({ queryKey: ["/api/checklists"] });
        toast({ title: "Checklist created" });
      },
      onError: () => toast({ title: "Failed to create checklist", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
          <p className="text-muted-foreground mt-1">Reusable checklists for programming, compliance, and daily operations.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Create Checklist</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Checklist</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CHECKLIST_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Items</Label>
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={item} onChange={(e) => updateItem(i, e.target.value)} placeholder={`Item ${i + 1}`} />
                    {form.items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><X className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add Item</Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (checklists ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <CheckSquare className="h-8 w-8 mb-2" />
          <p>No checklists yet. Create your first checklist template.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-2">
            {(checklists ?? []).map((c) => (
              <div key={c.id} className={`p-3 border rounded-lg cursor-pointer transition-colors ${selected === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`} onClick={() => setSelected(c.id)}>
                <p className="font-medium text-sm">{c.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{CHECKLIST_TYPES[c.type] || c.type}</Badge>
                  <span className="text-xs text-muted-foreground">{c.items.length} items</span>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!selectedChecklist ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Select a checklist to view details and log completions.</CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedChecklist.title}</CardTitle>
                  <Badge variant="outline" className="w-fit text-xs">{CHECKLIST_TYPES[selectedChecklist.type] || selectedChecklist.type}</Badge>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="font-medium text-sm mb-2">Items</p>
                    <ul className="space-y-1.5">
                      {selectedChecklist.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <SelectedChecklist checklistId={selectedChecklist.id} staff={staff ?? []} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
