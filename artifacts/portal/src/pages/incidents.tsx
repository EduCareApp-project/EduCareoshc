import { useState } from "react";
import { useListIncidents, useCreateIncident, useUpdateIncident, useListChildren } from "@workspace/api-client-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertTriangle, Plus, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STATUS_STEPS = [
  { key: "parent_notified", label: "Parent Notified", next: "parent_notified" },
  { key: "director_notified", label: "Director Notified", next: "director_notified" },
  { key: "dept_notified", label: "Department Notified", next: "dept_notified" },
  { key: "closed", label: "Closed", next: "closed" },
];

const STATUS_ORDER = ["open", "parent_notified", "director_notified", "dept_notified", "closed"];

function statusBadge(s: string) {
  const map: Record<string, string> = {
    open: "bg-red-100 text-red-800 border-red-200",
    parent_notified: "bg-amber-100 text-amber-800 border-amber-200",
    director_notified: "bg-blue-100 text-blue-800 border-blue-200",
    dept_notified: "bg-purple-100 text-purple-800 border-purple-200",
    closed: "bg-green-100 text-green-800 border-green-200",
  };
  const labels: Record<string, string> = {
    open: "Open", parent_notified: "Parent Notified", director_notified: "Director Notified",
    dept_notified: "Dept. Notified", closed: "Closed",
  };
  return <Badge className={map[s] || ""}>{labels[s] || s}</Badge>;
}

export default function Incidents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: incidents, isLoading } = useListIncidents();
  const { data: children } = useListChildren();
  const createMutation = useCreateIncident();
  const updateMutation = useUpdateIncident();

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedIncident = (incidents ?? []).find((i) => i.id === selected);

  const [form, setForm] = useState({ title: "", description: "", childId: "", incidentDate: "", location: "", injuryDescription: "", actionTaken: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ data: { ...form, childId: parseInt(form.childId) } as any }, {
      onSuccess: () => {
        setCreateOpen(false);
        setForm({ title: "", description: "", childId: "", incidentDate: "", location: "", injuryDescription: "", actionTaken: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
        toast({ title: "Incident logged" });
      },
      onError: () => toast({ title: "Failed to log incident", variant: "destructive" }),
    });
  }

  function advanceStatus(incident: { id: number; status: string }) {
    const idx = STATUS_ORDER.indexOf(incident.status);
    const next = STATUS_ORDER[idx + 1];
    if (!next) return;
    const update: Record<string, unknown> = { status: next };
    const now = new Date().toISOString();
    if (next === "parent_notified") update.parentNotifiedAt = now;
    if (next === "director_notified") update.directorNotifiedAt = now;
    if (next === "dept_notified") update.deptNotifiedAt = now;
    updateMutation.mutate({ id: incident.id, data: update as any }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/incidents"] }),
    });
  }

  const nextStatusLabel = (status: string) => {
    const idx = STATUS_ORDER.indexOf(status);
    const next = STATUS_ORDER[idx + 1];
    const labels: Record<string, string> = { parent_notified: "Mark Parent Notified", director_notified: "Mark Director Notified", dept_notified: "Mark Dept. Notified", closed: "Close Incident" };
    return next ? labels[next] : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Incident Log</h1>
          <p className="text-muted-foreground mt-1">Record and track incidents with notification stages.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Log Incident</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Log Incident</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Child</Label>
                <Select value={form.childId} onValueChange={(v) => setForm({ ...form, childId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                  <SelectContent>{(children ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Date of Incident</Label><Input type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Outdoor play area" /></div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} required /></div>
              <div className="space-y-1"><Label>Injury Description</Label><Textarea value={form.injuryDescription} onChange={(e) => setForm({ ...form, injuryDescription: e.target.value })} rows={2} /></div>
              <div className="space-y-1"><Label>Action Taken</Label><Textarea value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || !form.childId}>Log Incident</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (incidents ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p>No incidents recorded. Use the button above to log one.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <div className="divide-y">
            {(incidents ?? []).map((inc) => (
              <div key={inc.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelected(inc.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{inc.title}</span>
                    {statusBadge(inc.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{inc.childName} • {format(new Date(inc.incidentDate + "T00:00:00"), "MMM d, yyyy")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelected(inc.id); }}>View</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedIncident && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{selectedIncident.title}</SheetTitle>
                <div>{statusBadge(selectedIncident.status)}</div>
              </SheetHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground text-xs mb-1">Child</p><p className="font-medium">{selectedIncident.childName}</p></div>
                  <div><p className="text-muted-foreground text-xs mb-1">Date</p><p>{format(new Date(selectedIncident.incidentDate + "T00:00:00"), "MMM d, yyyy")}</p></div>
                  {selectedIncident.location && <div><p className="text-muted-foreground text-xs mb-1">Location</p><p>{selectedIncident.location}</p></div>}
                </div>

                <div><p className="text-muted-foreground text-xs mb-1">Description</p><p className="leading-relaxed">{selectedIncident.description}</p></div>
                {selectedIncident.injuryDescription && <div><p className="text-muted-foreground text-xs mb-1">Injury</p><p>{selectedIncident.injuryDescription}</p></div>}
                {selectedIncident.actionTaken && <div><p className="text-muted-foreground text-xs mb-1">Action Taken</p><p>{selectedIncident.actionTaken}</p></div>}

                <div className="border rounded-lg p-4 space-y-3 mt-4">
                  <p className="font-medium text-sm">Notification Timeline</p>
                  {STATUS_STEPS.map((step) => {
                    const tsMap: Record<string, string | null | undefined> = {
                      parent_notified: selectedIncident.parentNotifiedAt,
                      director_notified: selectedIncident.directorNotifiedAt,
                      dept_notified: selectedIncident.deptNotifiedAt,
                      closed: selectedIncident.status === "closed" ? selectedIncident.createdAt : null,
                    };
                    const ts = tsMap[step.key];
                    const done = !!ts;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        {done ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="flex-1">
                          <p className={done ? "font-medium" : "text-muted-foreground"}>{step.label}</p>
                          {ts && <p className="text-xs text-muted-foreground">{format(new Date(ts), "MMM d, yyyy 'at' h:mm a")}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {nextStatusLabel(selectedIncident.status) && (
                  <Button className="w-full" onClick={() => advanceStatus(selectedIncident)} disabled={updateMutation.isPending}>
                    {nextStatusLabel(selectedIncident.status)}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
