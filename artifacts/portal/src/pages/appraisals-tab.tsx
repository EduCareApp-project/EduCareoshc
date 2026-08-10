import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useActiveStaff } from "@/hooks/use-active-staff";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ClipboardList, ChevronRight, Trash2, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { format, parseISO, isPast } from "date-fns";
import { fmtMelb } from "@/lib/timezone";
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

const EDUCATOR_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  stage1: { label: "Stage 1 — Assessment", className: "bg-amber-100 text-amber-800 border-amber-200" },
  stage2: { label: "Stage 2 — Upward Appraisal", className: "bg-blue-100 text-blue-800 border-blue-200" },
  stage3: { label: "Stage 3 — Joint Meeting", className: "bg-purple-100 text-purple-800 border-purple-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

const COORD_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  stage1: { label: "Stage 1 — Assessment", className: "bg-amber-100 text-amber-800 border-amber-200" },
  stage2: { label: "Stage 2 — Upward Appraisal", className: "bg-blue-100 text-blue-800 border-blue-200" },
  stage3: { label: "Stage 3 — Leadership", className: "bg-purple-100 text-purple-800 border-purple-200" },
  stage4: { label: "Stage 4 — Joint Meeting", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

function StatusBadge({ status, type }: { status: string; type: string }) {
  const config = type === "coordinator_appraisal" ? COORD_STATUS_CONFIG : EDUCATOR_STATUS_CONFIG;
  const cfg = config[status] ?? { label: status, className: "bg-slate-100 text-slate-700 border-slate-200" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>{cfg.label}</span>;
}

function CreateDialog({
  open, onClose, staffList, fixedStaffId,
}: {
  open: boolean;
  onClose: () => void;
  staffList: { id: number; firstName: string; lastName: string }[];
  fixedStaffId?: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    type: "educator_appraisal",
    staffId: fixedStaffId ? String(fixedStaffId) : "",
    reviewerId: "",
    dueDate: "",
  });

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
      if (!res.ok) throw new Error(json.error ?? "Failed to create");
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
            <Label>Appraisal Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPRAISAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!fixedStaffId && (
            <div className="space-y-1.5">
              <Label>Staff Member <span className="text-destructive">*</span></Label>
              <Select value={form.staffId} onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
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
            <Button
              onClick={() => mutation.mutate()}
              disabled={!form.staffId || !form.dueDate || mutation.isPending}
            >
              {mutation.isPending ? "Creating…" : "Create Appraisal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AppraisalsTab({ staffId }: { staffId?: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const { isEducatorRole } = usePermissions();

  const { data: staffList } = useActiveStaff();
  const activeStaff = (staffList ?? []).filter((s) => s.status === "active");

  const { data, isLoading } = useQuery<AppraisalRow[]>({
    queryKey: ["/api/appraisals", staffId],
    queryFn: async () => {
      const url = staffId ? `/api/appraisals?staffId=${staffId}` : "/api/appraisals";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load appraisals");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/appraisals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] }); toast({ title: "Appraisal deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="space-y-3 mt-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  const appraisals = data ?? [];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {appraisals.length === 0 ? "No appraisals yet" : `${appraisals.length} appraisal${appraisals.length !== 1 ? "s" : ""}`}
        </p>
        {!isEducatorRole && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Appraisal
          </Button>
        )}
      </div>

      {appraisals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-lg">
          <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No appraisals yet</p>
          {!isEducatorRole && (
            <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Appraisal
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden divide-y">
          {appraisals.map((a) => {
            const isOverdue = a.status !== "completed" && a.dueDate && isPast(parseISO(a.dueDate));
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer group"
                onClick={() => navigate(`/appraisals/${a.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">Educator Appraisal &amp; Development Plan</span>
                    <StatusBadge status={a.status} type={a.type} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {a.reviewerName && <span>Assessor: {a.reviewerName}</span>}
                    {a.dueDate && (
                      <div className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
                        <CalendarDays className="h-3 w-3" />
                        Due {format(parseISO(a.dueDate), "dd/MM/yyyy")}
                        {isOverdue && " (overdue)"}
                      </div>
                    )}
                    {a.completedAt && <span className="text-emerald-700">Completed {fmtMelb(a.completedAt, "dd/MM/yyyy")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {!isEducatorRole && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this appraisal?</AlertDialogTitle>
                          <AlertDialogDescription>All stage data will be permanently deleted. This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate(a.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        staffList={activeStaff}
        fixedStaffId={staffId}
      />
    </div>
  );
}
