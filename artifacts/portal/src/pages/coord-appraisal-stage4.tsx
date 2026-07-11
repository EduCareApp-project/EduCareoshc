import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, Save, Send, Plus, Trash2, Info, Sparkles, MessageSquarePlus, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  PREVIOUS_ACTIONS_QUESTIONS, TRAINING_REVIEW_QUESTIONS,
  buildEmptyStage3, collectCoordAutoActions,
  type CoordStage1Data, type CoordStage3Data, type Stage3Data, type AppraisalGoal, type AdditionalNote, type ReviewQuestion,
} from "@/lib/appraisal-constants";

type Appraisal = {
  id: number;
  staffName: string;
  reviewerName: string | null;
  status: string;
  reviewerStage1: CoordStage1Data | null;
  coordLeadershipData: CoordStage3Data | null;
  stage3Data: Stage3Data | null;
  completedAt: string | null;
};

type GoalNote = { id: number; goalId: string; note: string; createdAt: string };

function uuid() { return crypto.randomUUID(); }

function ReviewQuestionRow({
  q, entry, onChange, disabled,
}: {
  q: { key: string; question: string };
  entry: ReviewQuestion;
  onChange: (updated: ReviewQuestion) => void;
  disabled: boolean;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <p className="font-medium text-sm">{q.question}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Employee Comment</label>
          <Textarea rows={3} className="text-sm resize-y" placeholder="Employee's response…" value={entry.employeeComment ?? ""} onChange={(e) => onChange({ ...entry, employeeComment: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-primary uppercase tracking-wide">Assessor Feedback</label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={!!entry.actionRequired} onChange={(e) => onChange({ ...entry, actionRequired: e.target.checked })} disabled={disabled} className="h-4 w-4 accent-primary" />
              <span className="text-muted-foreground">Action required</span>
            </label>
          </div>
          <Textarea rows={3} className="text-sm resize-y" placeholder="Assessor's feedback…" value={entry.reviewerFeedback ?? ""} onChange={(e) => onChange({ ...entry, reviewerFeedback: e.target.value })} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

function GoalRow({
  goal, notes, onChange, onDelete, onAddNote, onDeleteNote, disabled,
}: {
  goal: AppraisalGoal;
  notes: GoalNote[];
  onChange: (g: AppraisalGoal) => void;
  onDelete: () => void;
  onAddNote: (goalId: string, note: string) => void;
  onDeleteNote: (noteId: number) => void;
  disabled: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState("");
  const goalNotes = notes.filter((n) => n.goalId === goal.id);

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      {goal.source === "auto" && goal.sourceLabel && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/20 rounded-full px-2.5 py-1 w-fit">
            <Sparkles className="h-3 w-3" /> Auto-generated: {goal.sourceLabel}
          </div>
          {goal.sourceNotes && (
            <p className="text-xs text-muted-foreground italic whitespace-pre-wrap pl-1">{goal.sourceNotes}</p>
          )}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Action / Goal <span className="text-destructive">*</span></Label>
          <Textarea rows={2} className="text-sm resize-y" placeholder="Describe the specific action or goal…" value={goal.action} onChange={(e) => onChange({ ...goal, action: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Possible Obstacles</Label>
          <Textarea rows={2} className="text-sm resize-y" placeholder="What might get in the way?" value={goal.possibleObstacles ?? ""} onChange={(e) => onChange({ ...goal, possibleObstacles: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date for Completion</Label>
          <Input type="date" className="h-8 text-sm" value={goal.dateForCompletion ?? ""} onChange={(e) => onChange({ ...goal, dateForCompletion: e.target.value })} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">SMART Goal?</Label>
          <div className="flex gap-2 pt-1">
            {[true, false].map((v) => (
              <button key={String(v)} disabled={disabled} onClick={() => onChange({ ...goal, isSmart: v })} className={`px-3 py-1 rounded text-xs font-medium border transition-all ${goal.isSmart === v ? v ? "bg-emerald-600 text-white border-transparent" : "bg-red-500 text-white border-transparent" : "border-border text-muted-foreground hover:bg-muted"}`}>
                {v ? "Yes — SMART" : "No"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowNotes((s) => !s)}>
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Progress Notes ({goalNotes.length})
          {showNotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {!disabled && (
          <Button variant="ghost" size="sm" className="h-7 text-destructive hover:bg-destructive/10 text-xs" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        )}
      </div>
      {showNotes && (
        <div className="border-t pt-3 space-y-2">
          {goalNotes.length === 0 && <p className="text-xs text-muted-foreground italic">No progress notes yet.</p>}
          {goalNotes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-2 bg-muted/40 rounded-md px-3 py-2">
              <div>
                <p className="text-xs">{note.note}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(note.createdAt), "dd/MM/yyyy, h:mm a")}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => onDeleteNote(note.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input className="h-8 text-xs flex-1" placeholder="Add progress note…" value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newNote.trim()) { onAddNote(goal.id, newNote.trim()); setNewNote(""); } }} />
            <Button size="sm" className="h-8 text-xs" disabled={!newNote.trim()} onClick={() => { onAddNote(goal.id, newNote.trim()); setNewNote(""); }}>Add</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoordAppraisalStage4() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appraisal, isLoading } = useQuery<Appraisal>({
    queryKey: [`/api/appraisals/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/appraisals/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: goalNotesData } = useQuery<GoalNote[]>({
    queryKey: [`/api/appraisals/${id}/goal-notes`],
    queryFn: async () => {
      const res = await fetch(`/api/appraisals/${id}/goal-notes`);
      if (!res.ok) throw new Error("Failed to load notes");
      return res.json();
    },
  });

  const [formData, setFormData] = useState<Stage3Data | null>(null);
  const submitted = !!appraisal?.completedAt;

  useEffect(() => {
    if (!appraisal || formData !== null) return;
    if (appraisal.stage3Data) {
      setFormData(appraisal.stage3Data);
    } else {
      const autoActions = collectCoordAutoActions(appraisal.reviewerStage1, appraisal.coordLeadershipData);
      setFormData(buildEmptyStage3(autoActions));
    }
  }, [appraisal?.id]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}/coord-stage4/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => toast({ title: "Draft saved" }),
    onError: () => toast({ title: "Failed to save draft", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}/coord-stage4`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit");
      return json;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/appraisals/${id}`], data);
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Appraisal completed!" });
      navigate(`/appraisals/${id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addGoalNoteMutation = useMutation({
    mutationFn: async ({ goalId, note }: { goalId: string; note: string }) => {
      const res = await fetch(`/api/appraisals/${id}/goal-notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goalId, note }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add note");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${id}/goal-notes`] }),
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const deleteGoalNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const res = await fetch(`/api/appraisals/${id}/goal-notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/appraisals/${id}/goal-notes`] }),
    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
  });

  if (isLoading || formData === null) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!appraisal) return <div className="p-6 text-center text-muted-foreground">Appraisal not found.</div>;

  if (appraisal.status !== "stage4" && !submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-lg font-semibold">Stage 4 not yet available</h2>
        <p className="text-muted-foreground text-sm">The Leadership Summary (Stage 3) must be submitted before Stage 4 opens.</p>
        <Button onClick={() => navigate(`/appraisals/${id}`)}>Back to Appraisal</Button>
      </div>
    );
  }

  const updatePrevAction = (key: string, updated: ReviewQuestion) => {
    setFormData((d) => d ? { ...d, previousActionsReview: d.previousActionsReview.map((q) => q.key === key ? updated : q) } : d);
  };
  const updateTraining = (key: string, updated: ReviewQuestion) => {
    setFormData((d) => d ? { ...d, trainingReview: d.trainingReview.map((q) => q.key === key ? updated : q) } : d);
  };
  const updateGoal = (goalId: string, updated: AppraisalGoal) => {
    setFormData((d) => d ? { ...d, goals: d.goals.map((g) => g.id === goalId ? updated : g) } : d);
  };
  const deleteGoal = (goalId: string) => {
    setFormData((d) => d ? { ...d, goals: d.goals.filter((g) => g.id !== goalId) } : d);
  };
  const addGoal = () => {
    setFormData((d) => d ? { ...d, goals: [...d.goals, { id: uuid(), source: "manual", action: "", possibleObstacles: "", isSmart: undefined, dateForCompletion: "" }] } : d);
  };
  const updateNote = (noteId: string, field: string, val: string) => {
    setFormData((d) => d ? { ...d, additionalNotes: d.additionalNotes.map((n) => n.id === noteId ? { ...n, [field]: val } : n) } : d);
  };
  const addNote = () => {
    setFormData((d) => d ? { ...d, additionalNotes: [...d.additionalNotes, { id: uuid(), areaOfDiscussion: "", responsibility: "" }] } : d);
  };
  const deleteNote = (noteId: string) => {
    setFormData((d) => d ? { ...d, additionalNotes: d.additionalNotes.filter((n) => n.id !== noteId) } : d);
  };

  const notes = goalNotesData ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button onClick={() => navigate(`/appraisals/${id}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Appraisal
        </button>
        <h1 className="text-2xl font-bold">Stage 4 — Action Plan &amp; Goal Review</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{appraisal.staffName} · Assessor: {appraisal.reviewerName ?? "Unassigned"}</p>
        {submitted && appraisal.completedAt && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed {format(new Date(appraisal.completedAt), "dd/MM/yyyy, h:mm a")}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>This stage is completed jointly during the in-person appraisal meeting. Action items flagged in Stages 1 and 3 have been automatically added to the goals table — review and edit before submitting.</span>
      </div>

      {/* Previous Actions */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold border-b pb-3">Previous Actions &amp; Goals Review</h2>
        <p className="text-sm text-muted-foreground">Review any actions and goals set in the previous appraisal.</p>
        <div className="space-y-4">
          {PREVIOUS_ACTIONS_QUESTIONS.map((q) => {
            const entry = formData.previousActionsReview.find((r) => r.key === q.key) ?? { key: q.key };
            return <ReviewQuestionRow key={q.key} q={q} entry={entry} onChange={(u) => updatePrevAction(q.key, u)} disabled={submitted} />;
          })}
        </div>
      </div>

      {/* Training Review */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold border-b pb-3">Training &amp; Skill Development Review</h2>
        <p className="text-sm text-muted-foreground">Review recent training and identify future development needs.</p>
        <div className="space-y-4">
          {TRAINING_REVIEW_QUESTIONS.map((q) => {
            const entry = formData.trainingReview.find((r) => r.key === q.key) ?? { key: q.key };
            return <ReviewQuestionRow key={q.key} q={q} entry={entry} onChange={(u) => updateTraining(q.key, u)} disabled={submitted} />;
          })}
        </div>
      </div>

      {/* Goals */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <h2 className="text-lg font-bold">Action Planning &amp; Goal Setting</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Goals should be SMART — Specific, Measurable, Achievable, Realistic, and Time-bound.</p>
          </div>
          {!submitted && <Button size="sm" variant="outline" onClick={addGoal}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Goal</Button>}
        </div>
        {formData.goals.length === 0 && <p className="text-sm text-muted-foreground italic py-4 text-center">No goals yet. Add one or mark actions in Stages 1 & 3.</p>}
        <div className="space-y-4">
          {formData.goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              notes={notes}
              onChange={(u) => updateGoal(goal.id, u)}
              onDelete={() => deleteGoal(goal.id)}
              onAddNote={(goalId, note) => addGoalNoteMutation.mutate({ goalId, note })}
              onDeleteNote={(noteId) => deleteGoalNoteMutation.mutate(noteId)}
              disabled={submitted}
            />
          ))}
        </div>
      </div>

      {/* Overview */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold border-b pb-3">Overview</h2>
        <p className="text-sm text-muted-foreground">General comments from both parties relating to performance and the appraisal experience.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Employee Comments</Label>
            <Textarea rows={5} className="text-sm resize-y" placeholder="Employee's overall comments…" value={formData.overview.employeeComments ?? ""} onChange={(e) => setFormData((d) => d ? { ...d, overview: { ...d.overview, employeeComments: e.target.value } } : d)} disabled={submitted} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-primary uppercase tracking-wide">Assessor Comments</Label>
            <Textarea rows={5} className="text-sm resize-y" placeholder="Assessor's overall comments…" value={formData.overview.reviewerComments ?? ""} onChange={(e) => setFormData((d) => d ? { ...d, overview: { ...d.overview, reviewerComments: e.target.value } } : d)} disabled={submitted} />
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-lg font-bold">Additional Notes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Any free discussion that results in actions.</p>
          </div>
          {!submitted && <Button size="sm" variant="outline" onClick={addNote}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Note</Button>}
        </div>
        {formData.additionalNotes.length === 0 && <p className="text-sm text-muted-foreground italic py-2 text-center">No additional notes.</p>}
        <div className="space-y-3">
          {formData.additionalNotes.map((note) => (
            <div key={note.id} className="grid sm:grid-cols-2 gap-3 border rounded-lg p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Area of Discussion</Label>
                <Textarea rows={2} className="text-sm resize-none" value={note.areaOfDiscussion} onChange={(e) => updateNote(note.id, "areaOfDiscussion", e.target.value)} disabled={submitted} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Responsibility</Label>
                  {!submitted && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteNote(note.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                </div>
                <Input className="h-8 text-sm" value={note.responsibility} onChange={(e) => updateNote(note.id, "responsibility", e.target.value)} disabled={submitted} placeholder="Who follows up?" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signatures */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold border-b pb-3">Sign Off</h2>
        <p className="text-sm text-muted-foreground">Both parties confirm they agree with the content of this Appraisal and Development Plan.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Coordinator Signature</Label>
            <Input className="h-9 text-sm" placeholder="Type full name to sign…" value={formData.signatures?.reviewerSigned ? (appraisal.staffName ?? "") : (formData.signatures?.employeeSignedAt ? appraisal.staffName : "")} disabled={submitted || !!formData.signatures?.employeeSigned} onChange={() => {}} readOnly />
            <label className={`flex items-center gap-2 cursor-pointer ${submitted ? "opacity-50" : ""}`}>
              <input type="checkbox" checked={!!formData.signatures?.employeeSigned} onChange={(e) => setFormData((d) => d ? { ...d, signatures: { ...d.signatures, employeeSigned: e.target.checked, employeeSignedAt: e.target.checked ? new Date().toISOString() : undefined } } : d)} disabled={submitted} className="h-4 w-4 accent-primary" />
              <span className="text-sm">I agree with this appraisal</span>
            </label>
            {formData.signatures?.employeeSignedAt && <p className="text-xs text-muted-foreground">Signed {format(new Date(formData.signatures.employeeSignedAt), "dd/MM/yyyy, h:mm a")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-primary uppercase tracking-wide">Assessor Signature</Label>
            <Input className="h-9 text-sm" placeholder="Type full name to sign…" value={formData.signatures?.reviewerSigned ? (appraisal.reviewerName ?? "") : ""} disabled={submitted || !!formData.signatures?.reviewerSigned} onChange={() => {}} readOnly />
            <label className={`flex items-center gap-2 cursor-pointer ${submitted ? "opacity-50" : ""}`}>
              <input type="checkbox" checked={!!formData.signatures?.reviewerSigned} onChange={(e) => setFormData((d) => d ? { ...d, signatures: { ...d.signatures, reviewerSigned: e.target.checked, reviewerSignedAt: e.target.checked ? new Date().toISOString() : undefined } } : d)} disabled={submitted} className="h-4 w-4 accent-primary" />
              <span className="text-sm">I confirm this appraisal</span>
            </label>
            {formData.signatures?.reviewerSignedAt && <p className="text-xs text-muted-foreground">Signed {format(new Date(formData.signatures.reviewerSignedAt), "dd/MM/yyyy, h:mm a")}</p>}
          </div>
        </div>
      </div>

      {!submitted && (
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !formData.signatures?.reviewerSigned || !formData.signatures?.employeeSigned}
            title={!formData.signatures?.reviewerSigned || !formData.signatures?.employeeSigned ? "Both the assessor and coordinator must sign off before completing" : undefined}
          >
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {submitMutation.isPending ? "Submitting…" : "Complete Appraisal"}
          </Button>
          {(!formData.signatures?.reviewerSigned || !formData.signatures?.employeeSigned) && (
            <p className="text-xs text-muted-foreground self-center">Both signatures required to complete.</p>
          )}
        </div>
      )}
    </div>
  );
}
