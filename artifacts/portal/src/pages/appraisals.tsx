import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useListStaff } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, ClipboardList, ChevronRight, Trash2, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isPast } from "date-fns";
import { APPRAISAL_TYPES } from "@/lib/appraisal-constants";

type AppraisalRow = {
  id: number;
  type: string;
  staffId: number;
  staffName: string;
  reviewerId: number | null;
  reviewerName: string | null;
  dueDate: string;
  status: string;
  employeeStage1SubmittedAt: string | null;
  reviewerStage1SubmittedAt: string | null;
  stage2SubmittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  stage1: { label: "Stage 1 — Assessment", className: "bg-amber-100 text-amber-800 border-amber-200" },
  stage2: { label: "Stage 2 — Upward Appraisal", className: "bg-blue-100 text-blue-800 border-blue-200" },
  stage3: { label: "Stage 3 — Joint Meeting", className: "bg-purple-100 text-purple-800 border-purple-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

async function fetchAppraisals(staffId?: number): Promise<AppraisalRow[]> {
  const url = staffId ? `/api/appraisals?staffId=${staffId}` : "/api/appraisals";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load appraisals");
  return res.json();
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>{cfg.label}</span>;
}

function CreateDialog({ open, onClose, staffList }: { open: boolean; onClose: () => void; staffList: { id: number; firstName: string; lastName: string }[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ type: "educator_appraisal", staffId: "", reviewerId: "", dueDate: "" });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          staffId: Number(form.staffId),
          reviewerId: form.reviewerId ? Number(form.reviewerId) : null,
          dueDate: form.dueDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create appraisal");
      return json as AppraisalRow;
    },
    onSuccess: (appraisal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Appraisal created" });
      onClose();
      navigate(`/appraisals/${appraisal.id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Appraisal</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Appraisal Type <span className="text-destructive">*</span></Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPRAISAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div>
                      <div className="font-medium text-sm">{t.label}</div>
                      <div className="text-xs text-muted-foreground">{t.frequency}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Staff Member <span className="text-destructive">*</span></Label>
            <Select value={form.staffId} onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {staffList.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assessor / Reviewer</Label>
            <Select value={form.reviewerId || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, reviewerId: v === "__none__" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {staffList.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={!form.staffId || !form.dueDate || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create Appraisal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Appraisals() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterStaff, setFilterStaff] = useState<string>("__all__");

  const { data: staffList } = useListStaff();
  const activeStaff = (staffList ?? []).filter((s) => s.status === "active");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/appraisals"],
    queryFn: () => fetchAppraisals(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/appraisals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] }); toast({ title: "Appraisal deleted" }); },
    onError: () => toast({ title: "Failed to delete appraisal", variant: "destructive" }),
  });

  const filtered = (data ?? []).filter((a) => filterStaff === "__all__" || String(a.staffId) === filterStaff);
  const counts = {
    stage1: (data ?? []).filter((a) => a.status === "stage1").length,
    stage2: (data ?? []).filter((a) => a.status === "stage2").length,
    stage3: (data ?? []).filter((a) => a.status === "stage3").length,
    completed: (data ?? []).filter((a) => a.status === "completed").length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appraisals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Educator Appraisal &amp; Development Plans</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Appraisal
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["stage1", "stage2", "stage3", "completed"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <div key={s} className="bg-card border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{counts[s]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Filter by staff:</Label>
        <Select value={filterStaff} onValueChange={setFilterStaff}>
          <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All staff</SelectItem>
            {activeStaff.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-lg">
          <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No appraisals found</p>
          <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> New Appraisal</Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff Member</th>
                <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Assessor</th>
                <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Due Date</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => {
                const isOverdue = a.status !== "completed" && a.dueDate && isPast(parseISO(a.dueDate));
                return (
                  <tr key={a.id} className="hover:bg-muted/30 cursor-pointer group" onClick={() => navigate(`/appraisals/${a.id}`)}>
                    <td className="py-3 px-4">
                      <p className="font-medium">{a.staffName}</p>
                      <p className="text-xs text-muted-foreground">Educator Appraisal</p>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-muted-foreground">{a.reviewerName ?? <span className="italic">Unassigned</span>}</td>
                    <td className="py-3 px-4"><StatusBadge status={a.status} /></td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {a.dueDate && (
                        <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(parseISO(a.dueDate), "dd/MM/yyyy")}
                          {isOverdue && " (overdue)"}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete appraisal?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete {a.staffName}'s appraisal and all saved data. This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(a.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} staffList={activeStaff} />
    </div>
  );
}
