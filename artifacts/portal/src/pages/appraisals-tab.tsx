import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListStaff } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, ClipboardList, CalendarDays, User, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

type Appraisal = {
  id: number;
  staffId: number;
  reviewerId: number | null;
  period: string;
  status: string;
  scheduledDate: string | null;
  completedAt: string | null;
  managerRating: string | null;
  managerStrengths: string | null;
  managerDevelopment: string | null;
  managerComments: string | null;
  selfRating: string | null;
  selfStrengths: string | null;
  selfDevelopment: string | null;
  selfComments: string | null;
  agreedGoals: string | null;
  staffName: string;
  reviewerName: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  complete: "Complete",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  complete: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const RATING_OPTIONS = [
  { value: "outstanding", label: "Outstanding" },
  { value: "satisfactory", label: "Satisfactory" },
  { value: "needs_improvement", label: "Needs Improvement" },
];

const RATING_STYLES: Record<string, string> = {
  outstanding: "text-emerald-700",
  satisfactory: "text-blue-700",
  needs_improvement: "text-amber-700",
};

async function fetchAppraisals(): Promise<Appraisal[]> {
  const res = await fetch("/api/appraisals");
  if (!res.ok) throw new Error("Failed to load appraisals");
  return res.json();
}

async function createAppraisal(data: {
  staffId: number; reviewerId?: number | null; period: string; scheduledDate?: string | null;
}): Promise<Appraisal> {
  const res = await fetch("/api/appraisals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to create appraisal");
  return json;
}

async function updateAppraisal(id: number, data: Partial<Appraisal>): Promise<Appraisal> {
  const res = await fetch(`/api/appraisals/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to save appraisal");
  return json;
}

async function deleteAppraisal(id: number): Promise<void> {
  const res = await fetch(`/api/appraisals/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete appraisal");
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 border-slate-200"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function RatingSelect({
  value, onChange, label,
}: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={`Select ${label}`} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Not rated</SelectItem>
        {RATING_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type FormState = {
  staffId: string;
  reviewerId: string;
  period: string;
  scheduledDate: string;
};

function CreateDialog({
  open, onClose, staffList,
}: {
  open: boolean;
  onClose: () => void;
  staffList: { id: number; firstName: string; lastName: string }[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({ staffId: "", reviewerId: "", period: "", scheduledDate: "" });

  const mutation = useMutation({
    mutationFn: () => createAppraisal({
      staffId: Number(form.staffId),
      reviewerId: form.reviewerId ? Number(form.reviewerId) : null,
      period: form.period.trim(),
      scheduledDate: form.scheduledDate || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Appraisal created" });
      setForm({ staffId: "", reviewerId: "", period: "", scheduledDate: "" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleClose() {
    setForm({ staffId: "", reviewerId: "", period: "", scheduledDate: "" });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Appraisal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Staff Member <span className="text-destructive">*</span></Label>
            <Select value={form.staffId} onValueChange={(v) => setForm((f) => ({ ...f, staffId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reviewer / Appraiser</Label>
            <Select value={form.reviewerId || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, reviewerId: v === "__none__" ? "" : v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select reviewer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Period <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. 2025 Annual Review"
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled Date</Label>
            <Input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!form.staffId || !form.period.trim() || mutation.isPending}
            >
              {mutation.isPending ? "Creating…" : "Create Appraisal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type EditState = {
  status: string;
  scheduledDate: string;
  reviewerId: string;
  managerRating: string;
  managerStrengths: string;
  managerDevelopment: string;
  managerComments: string;
  selfRating: string;
  selfStrengths: string;
  selfDevelopment: string;
  selfComments: string;
  agreedGoals: string;
};

function appraisalToEditState(a: Appraisal): EditState {
  return {
    status: a.status,
    scheduledDate: a.scheduledDate ?? "",
    reviewerId: a.reviewerId ? String(a.reviewerId) : "",
    managerRating: a.managerRating ?? "",
    managerStrengths: a.managerStrengths ?? "",
    managerDevelopment: a.managerDevelopment ?? "",
    managerComments: a.managerComments ?? "",
    selfRating: a.selfRating ?? "",
    selfStrengths: a.selfStrengths ?? "",
    selfDevelopment: a.selfDevelopment ?? "",
    selfComments: a.selfComments ?? "",
    agreedGoals: a.agreedGoals ?? "",
  };
}

function EditDialog({
  appraisal, onClose, staffList,
}: {
  appraisal: Appraisal;
  onClose: () => void;
  staffList: { id: number; firstName: string; lastName: string }[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditState>(() => appraisalToEditState(appraisal));

  useEffect(() => {
    setForm(appraisalToEditState(appraisal));
  }, [appraisal.id]);

  function set<K extends keyof EditState>(k: K, v: EditState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const mutation = useMutation({
    mutationFn: () => updateAppraisal(appraisal.id, {
      status: form.status,
      scheduledDate: form.scheduledDate || null,
      reviewerId: form.reviewerId ? Number(form.reviewerId) : null,
      managerRating: form.managerRating || null,
      managerStrengths: form.managerStrengths || null,
      managerDevelopment: form.managerDevelopment || null,
      managerComments: form.managerComments || null,
      selfRating: form.selfRating || null,
      selfStrengths: form.selfStrengths || null,
      selfDevelopment: form.selfDevelopment || null,
      selfComments: form.selfComments || null,
      agreedGoals: form.agreedGoals || null,
    } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Appraisal saved" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const ratingLabel = (v: string | null) => RATING_OPTIONS.find((o) => o.value === v)?.label;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-lg">{appraisal.staffName}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{appraisal.period}</p>
            </div>
            <StatusBadge status={form.status} />
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Overview */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Scheduled Date</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={form.scheduledDate}
                onChange={(e) => set("scheduledDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Reviewer</Label>
              <Select value={form.reviewerId || "__none__"} onValueChange={(v) => set("reviewerId", v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Manager Assessment */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-primary rounded-full" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Manager / Director Assessment</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Overall Rating</Label>
              <RatingSelect
                label="rating"
                value={form.managerRating}
                onChange={(v) => set("managerRating", v)}
              />
              {form.managerRating && (
                <p className={`text-xs font-medium ${RATING_STYLES[form.managerRating]}`}>
                  {ratingLabel(form.managerRating)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Key Strengths Observed</Label>
              <Textarea
                rows={3}
                placeholder="What has this staff member done particularly well?"
                value={form.managerStrengths}
                onChange={(e) => set("managerStrengths", e.target.value)}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Development Areas</Label>
              <Textarea
                rows={3}
                placeholder="Areas identified for growth and improvement…"
                value={form.managerDevelopment}
                onChange={(e) => set("managerDevelopment", e.target.value)}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Additional Comments</Label>
              <Textarea
                rows={2}
                placeholder="Any other observations or feedback…"
                value={form.managerComments}
                onChange={(e) => set("managerComments", e.target.value)}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <Separator />

          {/* Self Assessment */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-blue-500 rounded-full" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Staff Self-Assessment</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Self Rating</Label>
              <RatingSelect
                label="self rating"
                value={form.selfRating}
                onChange={(v) => set("selfRating", v)}
              />
              {form.selfRating && (
                <p className={`text-xs font-medium ${RATING_STYLES[form.selfRating]}`}>
                  {ratingLabel(form.selfRating)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">What have you done well this period?</Label>
              <Textarea
                rows={3}
                placeholder="Reflect on your key contributions and achievements…"
                value={form.selfStrengths}
                onChange={(e) => set("selfStrengths", e.target.value)}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">What would you like to develop or improve?</Label>
              <Textarea
                rows={3}
                placeholder="Skills, knowledge, or areas you want to grow in…"
                value={form.selfDevelopment}
                onChange={(e) => set("selfDevelopment", e.target.value)}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Additional Comments</Label>
              <Textarea
                rows={2}
                placeholder="Anything else you'd like to share…"
                value={form.selfComments}
                onChange={(e) => set("selfComments", e.target.value)}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <Separator />

          {/* Agreed Outcomes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-emerald-500 rounded-full" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Agreed Goals & Next Steps</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Agreed Goals</Label>
              <Textarea
                rows={4}
                placeholder="Goals and actions agreed between staff member and manager…"
                value={form.agreedGoals}
                onChange={(e) => set("agreedGoals", e.target.value)}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save Appraisal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AppraisalsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Appraisal | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/appraisals"],
    queryFn: fetchAppraisals,
  });

  const { data: staffList } = useListStaff();
  const activeStaff = (staffList ?? []).filter((s) => s.status === "active");

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAppraisal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Appraisal deleted" });
    },
    onError: () => toast({ title: "Failed to delete appraisal", variant: "destructive" }),
  });

  const counts = {
    draft: (data ?? []).filter((a) => a.status === "draft").length,
    in_progress: (data ?? []).filter((a) => a.status === "in_progress").length,
    complete: (data ?? []).filter((a) => a.status === "complete").length,
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-4">
      {/* Summary + action */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES.draft}`}>
              {counts.draft} Draft{counts.draft !== 1 ? "s" : ""}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES.in_progress}`}>
              {counts.in_progress} In Progress
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES.complete}`}>
              {counts.complete} Complete
            </span>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> New Appraisal
        </Button>
      </div>

      {(data ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed">
          <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No appraisals yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Create your first staff appraisal to get started.</p>
          <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Appraisal
          </Button>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/50">
              <tr>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff Member</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Period</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reviewer</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rating</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Scheduled</th>
                <th className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((a) => (
                <tr
                  key={a.id}
                  className="border-t hover:bg-muted/20 transition-colors group cursor-pointer"
                  onClick={() => setEditing(a)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        {a.staffName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-sm font-medium">{a.staffName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">{a.period}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {a.reviewerName ?? <span className="italic">Unassigned</span>}
                  </td>
                  <td className="py-3 px-4">
                    {a.managerRating ? (
                      <span className={`text-xs font-medium ${RATING_STYLES[a.managerRating] ?? ""}`}>
                        {RATING_OPTIONS.find((o) => o.value === a.managerRating)?.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 italic">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                    {a.scheduledDate
                      ? format(parseISO(a.scheduledDate), "d MMM yyyy")
                      : <span className="italic text-muted-foreground/50">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); setEditing(a); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete appraisal?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the appraisal for <strong>{a.staffName}</strong> — {a.period}. All assessment data will be lost.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate(a.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} staffList={activeStaff} />
      {editing && (
        <EditDialog
          appraisal={editing}
          onClose={() => setEditing(null)}
          staffList={activeStaff}
        />
      )}
    </div>
  );
}
