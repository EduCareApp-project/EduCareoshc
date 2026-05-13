import { useState } from "react";
import { useListEvacuations, useCreateEvacuation } from "@workspace/api-client-react";
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
import { ShieldAlert, Plus, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Evacuations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: evacuations, isLoading } = useListEvacuations();
  const createMutation = useCreateEvacuation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ drillType: "evacuation", conductedAt: "", participantCount: "", durationMinutes: "", notes: "", conductedBy: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { drillType: form.drillType, conductedAt: new Date(form.conductedAt).toISOString() };
    if (form.participantCount) data.participantCount = parseInt(form.participantCount);
    if (form.durationMinutes) data.durationMinutes = parseInt(form.durationMinutes);
    if (form.notes) data.notes = form.notes;
    if (form.conductedBy) data.conductedBy = form.conductedBy;
    createMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ drillType: "evacuation", conductedAt: "", participantCount: "", durationMinutes: "", notes: "", conductedBy: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/evacuations"] });
        toast({ title: "Drill logged" });
      },
      onError: () => toast({ title: "Failed to log drill", variant: "destructive" }),
    });
  }

  const mostRecent = (evacuations ?? []).find((e) => e.drillType === "evacuation");
  const nextDue = mostRecent?.nextDueAt ? new Date(mostRecent.nextDueAt) : null;
  const daysUntilDue = nextDue ? differenceInDays(nextDue, new Date()) : null;

  const bannerColor = daysUntilDue === null ? "bg-slate-100 border-slate-200 text-slate-700"
    : daysUntilDue < 0 ? "bg-red-50 border-red-200 text-red-800"
    : daysUntilDue < 30 ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-green-50 border-green-200 text-green-800";

  const BannerIcon = daysUntilDue === null ? Clock : daysUntilDue < 0 ? AlertCircle : CheckCircle;

  const drillTypeLabel = (t: string) => ({ evacuation: "Evacuation", lockdown: "Lockdown", shelter_in_place: "Shelter in Place", other: "Other" }[t] || t);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety Evacuation</h1>
          <p className="text-muted-foreground mt-1">Track evacuation drills and safety practice logs. Evacuation drills are required every 90 days.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Log Drill</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Log Safety Drill</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Drill Type</Label>
                <Select value={form.drillType} onValueChange={(v) => setForm({ ...form, drillType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evacuation">Evacuation</SelectItem>
                    <SelectItem value="lockdown">Lockdown</SelectItem>
                    <SelectItem value="shelter_in_place">Shelter in Place</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Date & Time Conducted</Label><Input type="datetime-local" value={form.conductedAt} onChange={(e) => setForm({ ...form, conductedAt: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Participants</Label><Input type="number" min="0" value={form.participantCount} onChange={(e) => setForm({ ...form, participantCount: e.target.value })} /></div>
                <div className="space-y-1"><Label>Duration (min)</Label><Input type="number" min="0" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>Conducted By</Label><Input value={form.conductedBy} onChange={(e) => setForm({ ...form, conductedBy: e.target.value })} /></div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Log Drill</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className={`border rounded-lg p-4 flex items-center gap-4 ${bannerColor}`}>
        <BannerIcon className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">
            {daysUntilDue === null ? "No evacuation drills recorded yet"
              : daysUntilDue < 0 ? `Evacuation drill overdue by ${Math.abs(daysUntilDue)} days`
              : daysUntilDue === 0 ? "Evacuation drill due today"
              : `Next evacuation drill due in ${daysUntilDue} days`}
          </p>
          <p className="text-sm opacity-80">
            {mostRecent ? `Last conducted: ${format(new Date(mostRecent.conductedAt), "MMM d, yyyy")}` : "Log your first drill to start tracking"}
            {nextDue ? ` • Next due: ${format(nextDue, "MMM d, yyyy")}` : ""}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (evacuations ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <ShieldAlert className="h-8 w-8 mb-2" />
          <p>No drills logged yet.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Drill History</CardTitle></CardHeader>
          <div className="divide-y">
            {(evacuations ?? []).map((e) => (
              <div key={e.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{drillTypeLabel(e.drillType)}</span>
                    {e.drillType === "evacuation" && e.nextDueAt && (
                      <Badge variant="outline" className="text-xs">Next due: {format(new Date(e.nextDueAt), "MMM d, yyyy")}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(e.conductedAt), "MMM d, yyyy 'at' h:mm a")}
                    {e.participantCount != null && ` • ${e.participantCount} participants`}
                    {e.durationMinutes != null && ` • ${e.durationMinutes} min`}
                    {e.conductedBy && ` • ${e.conductedBy}`}
                  </p>
                  {e.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{e.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
