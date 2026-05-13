import { useState } from "react";
import { useListConditionReports, useCreateConditionReport, useUpdateConditionReport } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ClipboardX, Plus } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function severityBadge(s: string) {
  const map: Record<string, string> = { low: "bg-slate-100 text-slate-700", medium: "bg-yellow-100 text-yellow-800", high: "bg-orange-100 text-orange-800", critical: "bg-red-100 text-red-800" };
  return <Badge className={map[s] || ""}>{s.charAt(0).toUpperCase() + s.slice(1)}</Badge>;
}

function statusBadge(s: string) {
  const map: Record<string, string> = { open: "bg-red-100 text-red-800", in_progress: "bg-blue-100 text-blue-800", resolved: "bg-green-100 text-green-800" };
  const labels: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };
  return <Badge className={map[s] || ""}>{labels[s] || s}</Badge>;
}

export default function ConditionReports() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: reports, isLoading } = useListConditionReports();
  const createMutation = useCreateConditionReport();
  const updateMutation = useUpdateConditionReport();

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const selectedReport = (reports ?? []).find((r) => r.id === selected);

  const [form, setForm] = useState({ title: "", description: "", location: "", severity: "low", actionRequired: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ data: form as any }, {
      onSuccess: () => {
        setCreateOpen(false);
        setForm({ title: "", description: "", location: "", severity: "low", actionRequired: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/condition-reports"] });
        toast({ title: "Condition report submitted" });
      },
      onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
    });
  }

  function updateStatus(id: number, status: string, extraData: Record<string, unknown> = {}) {
    updateMutation.mutate({ id, data: { status, ...extraData } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/condition-reports"] });
        setResolutionNotes("");
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Condition Reports</h1>
          <p className="text-muted-foreground mt-1">Report and track hazards, damaged equipment, or unsafe conditions.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Report Hazard</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Report a Hazard</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Outdoor play area, Kitchen" required /></div>
              <div className="space-y-1"><Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} required /></div>
              <div className="space-y-1"><Label>Action Required</Label><Textarea value={form.actionRequired} onChange={(e) => setForm({ ...form, actionRequired: e.target.value })} rows={2} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Submit Report</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (reports ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <ClipboardX className="h-8 w-8 mb-2" />
          <p>No condition reports. Use the button above to report a hazard.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <div className="divide-y">
            {(reports ?? []).map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => { setSelected(r.id); setResolutionNotes(""); }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.title}</span>
                    {severityBadge(r.severity)}
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.location} • {format(new Date(r.reportedAt), "MMM d, yyyy")}</p>
                </div>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelected(r.id); }}>View</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedReport && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{selectedReport.title}</SheetTitle>
                <div className="flex gap-2">{severityBadge(selectedReport.severity)}{statusBadge(selectedReport.status)}</div>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-muted-foreground text-xs mb-1">Location</p><p>{selectedReport.location}</p></div>
                  <div><p className="text-muted-foreground text-xs mb-1">Reported</p><p>{format(new Date(selectedReport.reportedAt), "MMM d, yyyy")}</p></div>
                </div>
                <div><p className="text-muted-foreground text-xs mb-1">Description</p><p>{selectedReport.description}</p></div>
                {selectedReport.actionRequired && <div><p className="text-muted-foreground text-xs mb-1">Action Required</p><p>{selectedReport.actionRequired}</p></div>}
                {selectedReport.resolutionNotes && <div><p className="text-muted-foreground text-xs mb-1">Resolution Notes</p><p>{selectedReport.resolutionNotes}</p></div>}
                {selectedReport.resolvedAt && <div><p className="text-muted-foreground text-xs mb-1">Resolved</p><p>{format(new Date(selectedReport.resolvedAt), "MMM d, yyyy")}</p></div>}

                {selectedReport.status !== "resolved" && (
                  <div className="border rounded-lg p-4 space-y-3">
                    <p className="font-medium">Update Status</p>
                    {selectedReport.status === "open" && (
                      <Button className="w-full" variant="outline" onClick={() => updateStatus(selectedReport.id, "in_progress")} disabled={updateMutation.isPending}>Mark In Progress</Button>
                    )}
                    <div className="space-y-2">
                      <Textarea placeholder="Resolution notes..." value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={2} />
                      <Button className="w-full" onClick={() => updateStatus(selectedReport.id, "resolved", { resolutionNotes })} disabled={updateMutation.isPending}>Mark Resolved</Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
