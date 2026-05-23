import { useState } from "react";
import { useListWellbeingReports, useCreateWellbeingReport, useListChildren } from "@workspace/api-client-react";
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
import { HeartHandshake, Plus, Lock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function typeBadge(t: string) {
  const map: Record<string, string> = { family_violence: "bg-purple-100 text-purple-800", child_protection: "bg-red-100 text-red-800", other: "bg-slate-100 text-slate-700" };
  const labels: Record<string, string> = { family_violence: "Family Violence", child_protection: "Child Protection", other: "Other" };
  return <Badge className={map[t] || ""}>{labels[t] || t}</Badge>;
}

export default function Wellbeing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: reports, isLoading } = useListWellbeingReports();
  const { data: children } = useListChildren();
  const createMutation = useCreateWellbeingReport();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ childId: "", reportType: "", description: "", actionTaken: "", reportedAt: "", referredTo: "", referralDate: "" });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { ...form, childId: parseInt(form.childId) };
    if (!data.referredTo) delete data.referredTo;
    if (!data.referralDate) delete data.referralDate;
    if (!data.actionTaken) delete data.actionTaken;
    createMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setOpen(false);
        setForm({ childId: "", reportType: "", description: "", actionTaken: "", reportedAt: "", referredTo: "", referralDate: "" });
        queryClient.invalidateQueries({ queryKey: ["/api/wellbeing"] });
        toast({ title: "Wellbeing report submitted" });
      },
      onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wellbeing Reports</h1>
          <p className="text-muted-foreground mt-1">Confidential records of child protection and family wellbeing concerns.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Report</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Submit Wellbeing Report</DialogTitle></DialogHeader>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800 flex items-start gap-2 mb-4">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>This report is confidential. It should only be accessed by authorised staff.</span>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Child</Label>
                <Select value={form.childId} onValueChange={(v) => setForm({ ...form, childId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                  <SelectContent>{(children ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Report Type</Label>
                <Select value={form.reportType} onValueChange={(v) => setForm({ ...form, reportType: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family_violence">Family Violence</SelectItem>
                    <SelectItem value="child_protection">Child Protection</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Date Reported</Label><Input type="date" value={form.reportedAt} onChange={(e) => setForm({ ...form, reportedAt: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Description of Concern</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required /></div>
              <div className="space-y-1"><Label>Action Taken</Label><Textarea value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Referred To</Label><Input value={form.referredTo} onChange={(e) => setForm({ ...form, referredTo: e.target.value })} placeholder="Agency or person" /></div>
                <div className="space-y-1"><Label>Referral Date</Label><Input type="date" value={form.referralDate} onChange={(e) => setForm({ ...form, referralDate: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || !form.childId || !form.reportType}>Submit Report</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 flex items-start gap-2">
        <Lock className="h-4 w-4 shrink-0 mt-0.5" />
        <span>All records on this page are confidential. Handle with care in accordance with your service's privacy policy and mandatory reporting obligations.</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (reports ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <HeartHandshake className="h-8 w-8 mb-2" />
          <p>No wellbeing reports on record.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <div className="divide-y">
            {(reports ?? []).map((r) => (
              <div key={r.id} className="p-4 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{r.childName}</span>
                  {typeBadge(r.reportType)}
                  <span className="text-xs text-muted-foreground">{format(new Date(r.reportedAt + "T00:00:00"), "dd/MM/yyyy")}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                {r.referredTo && <p className="text-xs text-muted-foreground">Referred to: {r.referredTo}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
