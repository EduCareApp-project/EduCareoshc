import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, Save, Send, Lock, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  COMPETENCIES, POSITION_REVIEW, PERFORMANCE_DEV_QUESTIONS, RATING_SCALE,
  buildEmptyStage1,
  type Stage1Data, type CompetencyEntry, type PositionReviewEntry, type PerformanceDevEntry,
} from "@/lib/appraisal-constants";

type Appraisal = {
  id: number;
  staffName: string;
  reviewerName: string | null;
  dueDate: string;
  status: string;
  employeeStage1: Stage1Data | null;
  employeeStage1SubmittedAt: string | null;
  reviewerStage1: Stage1Data | null;
  reviewerStage1SubmittedAt: string | null;
};

const RATING_LABELS: Record<number, string> = { 5: "Exceptional", 4: "Above Average", 3: "Average", 2: "Below Average", 1: "Unsatisfactory" };

function RatingSelect({ value, onChange, disabled }: { value?: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <Select
      disabled={disabled}
      value={value != null ? String(value) : "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? undefined as any : Number(v))}
    >
      <SelectTrigger className="h-8 text-sm w-full min-w-[120px]">
        <SelectValue placeholder="Rate…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Not rated</SelectItem>
        {RATING_SCALE.map((r) => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function SubmittedBadge({ at }: { at: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 font-medium">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Submitted {format(new Date(at), "d MMM yyyy, h:mm a")}
    </div>
  );
}

function SectionHeader({ title, color, submitted, submittedAt }: { title: string; color: string; submitted: boolean; submittedAt?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap py-3 border-b mb-4">
      <div className="flex items-center gap-2">
        <div className={`h-5 w-1.5 rounded-full ${color}`} />
        <h3 className="font-semibold text-base">{title}</h3>
        {submitted && <Lock className="h-4 w-4 text-muted-foreground" />}
      </div>
      {submitted && submittedAt && <SubmittedBadge at={submittedAt} />}
    </div>
  );
}

export default function AppraisalStage1() {
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

  const [empData, setEmpData] = useState<Stage1Data>(() => buildEmptyStage1());
  const [revData, setRevData] = useState<Stage1Data>(() => buildEmptyStage1());

  useEffect(() => {
    if (appraisal) {
      setEmpData(appraisal.employeeStage1 ?? buildEmptyStage1());
      setRevData(appraisal.reviewerStage1 ?? buildEmptyStage1());
    }
  }, [appraisal?.id]);

  const empSubmitted = !!appraisal?.employeeStage1SubmittedAt;
  const revSubmitted = !!appraisal?.reviewerStage1SubmittedAt;

  const saveDraftMutation = useMutation({
    mutationFn: async (section: "employee" | "reviewer") => {
      const res = await fetch(`/api/appraisals/${id}/stage1/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data: section === "employee" ? empData : revData }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => toast({ title: "Draft saved" }),
    onError: () => toast({ title: "Failed to save draft", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async (section: "employee" | "reviewer") => {
      const data = section === "employee" ? empData : revData;
      const res = await fetch(`/api/appraisals/${id}/stage1/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit");
      return json;
    },
    onSuccess: (data, section) => {
      queryClient.setQueryData([`/api/appraisals/${id}`], data);
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: `${section === "employee" ? "Employee" : "Assessor"} assessment submitted` });
      if (data.status === "stage2") {
        toast({ title: "Both sections complete — moving to Stage 2", description: "The upward appraisal is now available." });
      }
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateEmpComp = useCallback((key: string, field: keyof CompetencyEntry, value: unknown) => {
    setEmpData((d) => ({ ...d, competencies: d.competencies.map((c) => c.key === key ? { ...c, [field]: value } : c) }));
  }, []);

  const updateRevComp = useCallback((key: string, field: keyof CompetencyEntry, value: unknown) => {
    setRevData((d) => ({ ...d, competencies: d.competencies.map((c) => c.key === key ? { ...c, [field]: value } : c) }));
  }, []);

  const updateEmpPos = useCallback((key: string, field: keyof PositionReviewEntry, value: unknown) => {
    setEmpData((d) => ({ ...d, positionReview: d.positionReview.map((p) => p.key === key ? { ...p, [field]: value } : p) }));
  }, []);

  const updateRevPos = useCallback((key: string, field: keyof PositionReviewEntry, value: unknown) => {
    setRevData((d) => ({ ...d, positionReview: d.positionReview.map((p) => p.key === key ? { ...p, [field]: value } : p) }));
  }, []);

  const updateEmpPd = useCallback((key: string, field: keyof PerformanceDevEntry, value: unknown) => {
    setEmpData((d) => ({ ...d, performanceDev: d.performanceDev.map((q) => q.key === key ? { ...q, [field]: value } : q) }));
  }, []);

  const updateRevPd = useCallback((key: string, field: keyof PerformanceDevEntry, value: unknown) => {
    setRevData((d) => ({ ...d, performanceDev: d.performanceDev.map((q) => q.key === key ? { ...q, [field]: value } : q) }));
  }, []);

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!appraisal) return <div className="p-6 text-center text-muted-foreground">Appraisal not found.</div>;

  if (appraisal.status !== "stage1") {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <h2 className="text-lg font-semibold">Stage 1 Complete</h2>
        <p className="text-muted-foreground text-sm">Both assessments have been submitted. This stage is now locked.</p>
        <Button onClick={() => navigate(`/appraisals/${id}`)}>Back to Appraisal</Button>
      </div>
    );
  }

  const RatingBadge = ({ value }: { value?: number }) => {
    if (!value) return null;
    const colour = value >= 4 ? "text-emerald-700" : value === 3 ? "text-blue-700" : "text-amber-700";
    return <span className={`text-xs font-medium ${colour}`}>{RATING_LABELS[value]}</span>;
  };

  const ActionCheckbox = ({ checked, onChange, disabled }: { checked?: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="h-4 w-4 accent-primary" />
      <span className="text-xs text-muted-foreground">Action</span>
    </label>
  );

  return (
    <div className="p-6 max-w-full mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => navigate(`/appraisals/${id}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Appraisal
          </button>
          <h1 className="text-2xl font-bold">Stage 1 — Assessment</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{appraisal.staffName} · Assessor: {appraisal.reviewerName ?? "Unassigned"}</p>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Rating Scale:</strong> 5 – Exceptional · 4 – Above Average · 3 – Average · 2 – Below Average · 1 – Unsatisfactory.
          Tick <strong>Action</strong> if further development is needed for that area.
        </div>
      </div>

      {/* ── SECTION A: Competency Based Review ────────────────────── */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold border-b pb-3">Section A — Competency Based Review</h2>
        <p className="text-sm text-muted-foreground">Rate current performance for each competency. Add examples in the comment field. Tick Action if further development is needed.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground w-64">Competency</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-blue-700 w-36">Emp. Rating</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-primary w-36">Assessor Rating</th>
                <th className="py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Comment</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-blue-700 w-20">Emp.</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-primary w-20">Assess.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {COMPETENCIES.map((comp) => {
                const ec = empData.competencies.find((c) => c.key === comp.key) ?? { key: comp.key };
                const rc = revData.competencies.find((c) => c.key === comp.key) ?? { key: comp.key };
                return (
                  <tr key={comp.key} className="align-top hover:bg-muted/30">
                    <td className="py-3 px-3">
                      <p className="font-medium text-sm">{comp.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{comp.description}</p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <RatingSelect value={ec.rating} onChange={(v) => updateEmpComp(comp.key, "rating", v)} disabled={empSubmitted} />
                        <RatingBadge value={ec.rating} />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <RatingSelect value={rc.rating} onChange={(v) => updateRevComp(comp.key, "rating", v)} disabled={revSubmitted} />
                        <RatingBadge value={rc.rating} />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Textarea
                        rows={2}
                        placeholder="Examples or comments…"
                        className="text-sm resize-y min-h-[60px]"
                        value={ec.comment ?? ""}
                        onChange={(e) => updateEmpComp(comp.key, "comment", e.target.value)}
                        disabled={empSubmitted && revSubmitted}
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <ActionCheckbox checked={ec.actionRequired} onChange={(v) => updateEmpComp(comp.key, "actionRequired", v)} disabled={empSubmitted} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <ActionCheckbox checked={rc.actionRequired} onChange={(v) => updateRevComp(comp.key, "actionRequired", v)} disabled={revSubmitted} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION B: Position Specific Review ──────────────────── */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-bold border-b pb-3">Section B — Position Specific Performance Review</h2>
        <p className="text-sm text-muted-foreground">Based on key job requirements. Rate and comment as above.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Requirement</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-blue-700 w-36">Emp. Rating</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-primary w-36">Assessor Rating</th>
                <th className="py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground">Comment</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-blue-700 w-20">Emp.</th>
                <th className="py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wide text-primary w-20">Assess.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {POSITION_REVIEW.map((pos) => {
                const ep = empData.positionReview.find((p) => p.key === pos.key) ?? { key: pos.key };
                const rp = revData.positionReview.find((p) => p.key === pos.key) ?? { key: pos.key };
                return (
                  <tr key={pos.key} className="align-top hover:bg-muted/30">
                    <td className="py-3 px-3">
                      <p className="font-medium text-sm">{pos.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pos.description}</p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <RatingSelect value={ep.rating} onChange={(v) => updateEmpPos(pos.key, "rating", v)} disabled={empSubmitted} />
                        <RatingBadge value={ep.rating} />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <RatingSelect value={rp.rating} onChange={(v) => updateRevPos(pos.key, "rating", v)} disabled={revSubmitted} />
                        <RatingBadge value={rp.rating} />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Textarea
                        rows={2}
                        placeholder="Comments…"
                        className="text-sm resize-y min-h-[60px]"
                        value={ep.comment ?? ""}
                        onChange={(e) => updateEmpPos(pos.key, "comment", e.target.value)}
                        disabled={empSubmitted && revSubmitted}
                      />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <ActionCheckbox checked={ep.actionRequired} onChange={(v) => updateEmpPos(pos.key, "actionRequired", v)} disabled={empSubmitted} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <ActionCheckbox checked={rp.actionRequired} onChange={(v) => updateRevPos(pos.key, "actionRequired", v)} disabled={revSubmitted} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION C: Performance Development Plan ───────────────── */}
      <div className="bg-card border rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-bold border-b pb-3">Section C — Performance Development Plan</h2>
        <p className="text-sm text-muted-foreground">Reflect on the previous 12 months. The employee provides comments; the assessor provides feedback.</p>

        {PERFORMANCE_DEV_QUESTIONS.map((q) => {
          const eq = empData.performanceDev.find((d) => d.key === q.key) ?? { key: q.key };
          const rq = revData.performanceDev.find((d) => d.key === q.key) ?? { key: q.key };
          return (
            <div key={q.key} className="border rounded-lg p-4 space-y-3">
              <p className="font-medium text-sm">{q.question}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Employee Comment</label>
                    <ActionCheckbox checked={eq.actionRequired} onChange={(v) => updateEmpPd(q.key, "actionRequired", v)} disabled={empSubmitted} />
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Employee's response…"
                    className="text-sm resize-y"
                    value={eq.comment ?? ""}
                    onChange={(e) => updateEmpPd(q.key, "comment", e.target.value)}
                    disabled={empSubmitted}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-primary uppercase tracking-wide">Assessor Feedback</label>
                    <ActionCheckbox checked={rq.actionRequired} onChange={(v) => updateRevPd(q.key, "actionRequired", v)} disabled={revSubmitted} />
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Assessor's feedback…"
                    className="text-sm resize-y"
                    value={rq.feedback ?? ""}
                    onChange={(e) => updateRevPd(q.key, "feedback", e.target.value)}
                    disabled={revSubmitted}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Submit buttons ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Employee section */}
        <div className={`border rounded-xl p-4 space-y-3 ${empSubmitted ? "bg-emerald-50 border-emerald-200" : "bg-card"}`}>
          <SectionHeader title="Employee Assessment" color="bg-blue-500" submitted={empSubmitted} submittedAt={appraisal.employeeStage1SubmittedAt} />
          {!empSubmitted && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => saveDraftMutation.mutate("employee")} disabled={saveDraftMutation.isPending}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
              </Button>
              <Button size="sm" onClick={() => submitMutation.mutate("employee")} disabled={submitMutation.isPending}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {submitMutation.isPending ? "Submitting…" : "Submit Employee Assessment"}
              </Button>
            </div>
          )}
        </div>

        {/* Reviewer section */}
        <div className={`border rounded-xl p-4 space-y-3 ${revSubmitted ? "bg-emerald-50 border-emerald-200" : "bg-card"}`}>
          <SectionHeader title="Assessor Assessment" color="bg-primary" submitted={revSubmitted} submittedAt={appraisal.reviewerStage1SubmittedAt} />
          {!revSubmitted && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => saveDraftMutation.mutate("reviewer")} disabled={saveDraftMutation.isPending}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
              </Button>
              <Button size="sm" onClick={() => submitMutation.mutate("reviewer")} disabled={submitMutation.isPending}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {submitMutation.isPending ? "Submitting…" : "Submit Assessor Assessment"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
