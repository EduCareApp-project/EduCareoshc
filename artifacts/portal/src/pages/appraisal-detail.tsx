import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useActiveStaff } from "@/hooks/use-active-staff";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle2, Circle, Clock, Users, User, UserCheck, Shield, Pencil, Trash2, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { fmtMelb } from "@/lib/timezone";
import { useState, useEffect } from "react";

type Appraisal = {
  id: number;
  type: string;
  staffId: number;
  staffName: string;
  reviewerId: number | null;
  reviewerName: string | null;
  dueDate: string;
  status: string;
  absencesCount: number | null;
  employeeStage1: unknown;
  employeeStage1SubmittedAt: string | null;
  reviewerStage1: unknown;
  reviewerStage1SubmittedAt: string | null;
  stage2Data: unknown;
  stage2SubmittedAt: string | null;
  coordLeadershipData: unknown;
  coordLeadershipSubmittedAt: string | null;
  stage3Data: unknown;
  completedAt: string | null;
  createdAt: string;
};

const STAGE_STATUS = {
  stage1: 1,
  stage2: 2,
  stage3: 3,
  completed: 4,
};

const COORD_STAGE_STATUS = {
  stage1: 1,
  stage2: 2,
  stage3: 3,
  stage4: 4,
  completed: 5,
};

export default function AppraisalDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdminOrEL, isAdmin } = usePermissions();
  const { data: staffList } = useActiveStaff();
  const activeStaff = (staffList ?? []).filter((s) => s.status === "active");

  const { data: appraisal, isLoading } = useQuery<Appraisal>({
    queryKey: [`/api/appraisals/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/appraisals/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const [editReviewerId, setEditReviewerId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAbsences, setEditAbsences] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (appraisal) {
      setEditReviewerId(appraisal.reviewerId ? String(appraisal.reviewerId) : "");
      setEditDueDate(appraisal.dueDate ?? "");
      setEditAbsences(appraisal.absencesCount != null ? String(appraisal.absencesCount) : "");
    }
  }, [appraisal?.id]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerId: editReviewerId || null,
          dueDate: editDueDate || null,
          absencesCount: editAbsences !== "" ? Number(editAbsences) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Saved" });
      setEditing(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => { navigate("/appraisals"); toast({ title: "Appraisal deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!appraisal) {
    return <div className="p-6 text-center text-muted-foreground">Appraisal not found.</div>;
  }

  const isCoordinator = appraisal.type === "coordinator_appraisal";

  const stageNum = isCoordinator
    ? (COORD_STAGE_STATUS[appraisal.status as keyof typeof COORD_STAGE_STATUS] ?? 1)
    : (STAGE_STATUS[appraisal.status as keyof typeof STAGE_STATUS] ?? 1);

  const typeLabel = isCoordinator
    ? "Program Coordinator Appraisal & Development Plan"
    : "Educator Appraisal & Development Plan";

  const stages = isCoordinator
    ? [
        {
          num: 1,
          label: "Stage 1 — Position Specific Performance Review",
          description: "Coordinator and Assessor complete ratings independently across 7 areas, self-reflection, and performance indicators.",
          icon: Users,
          details: [
            { label: "Coordinator assessment", done: !!appraisal.employeeStage1SubmittedAt, at: appraisal.employeeStage1SubmittedAt },
            { label: "Assessor assessment", done: !!appraisal.reviewerStage1SubmittedAt, at: appraisal.reviewerStage1SubmittedAt },
          ],
          actionLabel: "Enter Stage 1",
          actionPath: `/appraisals/${id}/coord-stage1`,
          available: stageNum >= 1,
        },
        {
          num: 2,
          label: "Stage 2 — Upward Appraisal",
          description: isAdminOrEL && stageNum < 5
            ? "Completed privately by the Coordinator — not visible until the appraisal is fully completed."
            : "Coordinator rates the organisation across Leadership, Organisation, Culture, and a final question.",
          icon: User,
          details: [
            { label: "Upward appraisal submitted", done: !!appraisal.stage2SubmittedAt, at: appraisal.stage2SubmittedAt },
          ],
          actionLabel: isAdminOrEL && stageNum < 5 ? "Private — Coordinator only" : "Enter Stage 2",
          actionPath: `/appraisals/${id}/coord-stage2`,
          available: stageNum >= 2,
          locked: isAdminOrEL && stageNum < 5,
        },
        {
          num: 3,
          label: "Stage 3 — Leadership",
          description: !isAdminOrEL && stageNum < 5
            ? "Completed privately by your Assessor — visible once the appraisal is fully completed."
            : "Assessor rates 7 leadership capabilities and summarises greatest strengths and development priorities.",
          icon: Shield,
          details: [
            { label: "Leadership summary submitted", done: !!appraisal.coordLeadershipSubmittedAt, at: appraisal.coordLeadershipSubmittedAt },
          ],
          actionLabel: !isAdminOrEL && stageNum < 5 ? "Assessor only" : "Enter Stage 3",
          actionPath: `/appraisals/${id}/coord-stage3`,
          available: stageNum >= 3,
          locked: !isAdminOrEL && stageNum < 5,
        },
        {
          num: 4,
          label: "Stage 4 — Joint Meeting",
          description: "Both parties meet jointly to review the leadership summary, set SMART goals, and sign off.",
          icon: UserCheck,
          details: [
            { label: "Action plan completed", done: !!appraisal.completedAt, at: appraisal.completedAt },
          ],
          actionLabel: "Enter Stage 4",
          actionPath: `/appraisals/${id}/coord-stage4`,
          available: stageNum >= 4,
        },
      ]
    : [
        {
          num: 1,
          label: "Stage 1 — Assessment",
          description: "Employee and assessor complete their ratings independently.",
          icon: Users,
          details: [
            { label: "Employee assessment", done: !!appraisal.employeeStage1SubmittedAt, at: appraisal.employeeStage1SubmittedAt },
            { label: "Assessor assessment", done: !!appraisal.reviewerStage1SubmittedAt, at: appraisal.reviewerStage1SubmittedAt },
          ],
          actionLabel: "Enter Stage 1",
          actionPath: `/appraisals/${id}/stage1`,
          available: stageNum >= 1,
        },
        {
          num: 2,
          label: "Stage 2 — Upward Appraisal",
          description: "The educator completes the upward appraisal privately.",
          icon: User,
          details: [
            { label: "Upward appraisal", done: !!appraisal.stage2SubmittedAt, at: appraisal.stage2SubmittedAt },
          ],
          actionLabel: "Enter Stage 2",
          actionPath: `/appraisals/${id}/stage2`,
          available: stageNum >= 2,
        },
        {
          num: 3,
          label: "Stage 3 — Joint Meeting",
          description: "Both parties meet to review actions, set goals, and sign off.",
          icon: UserCheck,
          details: [
            { label: "Joint session completed", done: !!appraisal.completedAt, at: appraisal.completedAt },
          ],
          actionLabel: "Enter Stage 3",
          actionPath: `/appraisals/${id}/stage3`,
          available: stageNum >= 3,
        },
      ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => navigate("/appraisals")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> All Appraisals
      </button>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold">{appraisal.staffName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{typeLabel}</p>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Assessor:</span> {appraisal.reviewerName ?? <em>Unassigned</em>}
                </div>
                {appraisal.dueDate && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Due {format(parseISO(appraisal.dueDate), "dd/MM/yyyy")}
                  </div>
                )}
                {appraisal.absencesCount != null && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{appraisal.absencesCount}</span> absences (prev. 12 months)
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Details
              </Button>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this appraisal?</AlertDialogTitle>
                      <AlertDialogDescription>All stage data will be permanently removed. This cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Edit form */}
          {editing && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Assessor</Label>
                  <Select value={editReviewerId || "__none__"} onValueChange={(v) => setEditReviewerId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {activeStaff.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" className="h-8 text-sm" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Absences (prev. 12 months)</Label>
                  <Input type="number" min={0} className="h-8 text-sm" value={editAbsences} onChange={(e) => setEditAbsences(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage Cards */}
      <div className="space-y-4">
        {stages.map((stage) => {
          const allDone = stage.details.every((d) => d.done);
          const isCurrentStage = stageNum === stage.num;
          const isPastStage = stageNum > stage.num;
          const isFuture = !stage.available;

          return (
            <Card key={stage.num} className={`transition-all ${isFuture ? "opacity-50" : ""}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-4">
                  {/* Stage indicator */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    allDone ? "bg-emerald-50 border-emerald-500" :
                    isCurrentStage ? "bg-primary/10 border-primary" :
                    "bg-muted border-muted-foreground/20"
                  }`}>
                    {allDone
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      : isCurrentStage
                        ? <Clock className="h-5 w-5 text-primary" />
                        : <Circle className="h-5 w-5 text-muted-foreground/40" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-sm">{stage.label}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
                      </div>
                      {stage.available && (!("locked" in stage && stage.locked) || allDone) && (
                        <Button
                          size="sm"
                          variant={isCurrentStage && !allDone ? "default" : "outline"}
                          onClick={() => navigate(stage.actionPath)}
                          className="flex-shrink-0"
                        >
                          {allDone ? "Review" : stage.actionLabel}
                        </Button>
                      )}
                      {"locked" in stage && stage.locked && stage.available && !allDone && (
                        <span className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-1.5 border border-border flex-shrink-0">
                          {stage.actionLabel}
                        </span>
                      )}
                    </div>

                    {/* Progress items */}
                    {stage.available && (
                      <div className="mt-2 space-y-1">
                        {stage.details.map((d) => (
                          <div key={d.label} className="flex items-center gap-2 text-xs">
                            {d.done
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                              : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                            }
                            <span className={d.done ? "text-foreground" : "text-muted-foreground"}>{d.label}</span>
                            {d.done && d.at && <span className="text-muted-foreground/60">— {fmtMelb(d.at, "dd/MM/yyyy, h:mm a")}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {appraisal.status === "completed" && appraisal.completedAt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800 font-medium text-center">
          ✓ Appraisal completed on {fmtMelb(appraisal.completedAt, "dd/MM/yyyy")}
        </div>
      )}
    </div>
  );
}
