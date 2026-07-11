import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, Save, Send, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import {
  COORD_POSITION_SECTIONS, COORD_SELF_REFLECTION_QUESTIONS, COORD_PERFORMANCE_INDICATORS, RATING_SCALE,
  buildEmptyCoordStage1,
  type CoordStage1Data, type CoordPositionEntry, type CoordSelfReflectionEntry, type CoordIndicatorEntry,
} from "@/lib/appraisal-constants";

type Appraisal = {
  id: number;
  type: string;
  staffName: string;
  reviewerName: string | null;
  status: string;
  employeeStage1: CoordStage1Data | null;
  employeeStage1SubmittedAt: string | null;
  reviewerStage1: CoordStage1Data | null;
  reviewerStage1SubmittedAt: string | null;
};

function RatingSelect({ value, onChange, disabled }: { value?: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <Select
      disabled={disabled}
      value={value != null ? String(value) : "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? undefined as any : Number(v))}
    >
      <SelectTrigger className="h-8 text-sm w-full min-w-[140px]">
        <SelectValue placeholder="Rate…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Not rated</SelectItem>
        {RATING_SCALE.map((r) => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function CoordAppraisalStage1() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdminOrEL } = usePermissions();

  const { data: appraisal, isLoading } = useQuery<Appraisal>({
    queryKey: [`/api/appraisals/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/appraisals/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const [empData, setEmpData] = useState<CoordStage1Data | null>(null);
  const [revData, setRevData] = useState<CoordStage1Data | null>(null);

  const empSubmitted = !!appraisal?.employeeStage1SubmittedAt;
  const revSubmitted = !!appraisal?.reviewerStage1SubmittedAt;

  useEffect(() => {
    if (!appraisal || empData !== null) return;
    setEmpData(appraisal.employeeStage1 ?? buildEmptyCoordStage1());
    setRevData(appraisal.reviewerStage1 ?? buildEmptyCoordStage1());
  }, [appraisal?.id]);

  const saveDraftMutation = useMutation({
    mutationFn: async (section: "employee" | "reviewer") => {
      const data = section === "employee" ? empData : revData;
      const res = await fetch(`/api/appraisals/${id}/stage1/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => toast({ title: "Draft saved" }),
    onError: () => toast({ title: "Failed to save draft", variant: "destructive" }),
  });

  const submitEmpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}/stage1/employee`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit");
      return json;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/appraisals/${id}`], data);
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Your assessment has been submitted!" });
      navigate(`/appraisals/${id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitRevMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}/stage1/reviewer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(revData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to submit");
      return json;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/appraisals/${id}`], data);
      queryClient.invalidateQueries({ queryKey: ["/api/appraisals"] });
      toast({ title: "Reviewer assessment submitted!" });
      navigate(`/appraisals/${id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || empData === null || revData === null) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!appraisal) return <div className="p-6 text-center text-muted-foreground">Appraisal not found.</div>;

  const updateEmpPosition = (key: string, field: keyof CoordPositionEntry, val: unknown) => {
    setEmpData((d) => d ? {
      ...d,
      positionItems: d.positionItems.map((e) => e.key === key ? { ...e, [field]: val } : e),
    } : d);
  };
  const updateRevPosition = (key: string, field: keyof CoordPositionEntry, val: unknown) => {
    setRevData((d) => d ? {
      ...d,
      positionItems: d.positionItems.map((e) => e.key === key ? { ...e, [field]: val } : e),
    } : d);
  };
  const updateEmpReflection = (key: string, field: keyof CoordSelfReflectionEntry, val: unknown) => {
    setEmpData((d) => d ? {
      ...d,
      selfReflection: d.selfReflection.map((e) => e.key === key ? { ...e, [field]: val } : e),
    } : d);
  };
  const updateRevReflection = (key: string, field: keyof CoordSelfReflectionEntry, val: unknown) => {
    setRevData((d) => d ? {
      ...d,
      selfReflection: d.selfReflection.map((e) => e.key === key ? { ...e, [field]: val } : e),
    } : d);
  };
  const updateEmpIndicator = (key: string, field: keyof CoordIndicatorEntry, val: unknown) => {
    setEmpData((d) => d ? {
      ...d,
      indicators: d.indicators.map((e) => e.key === key ? { ...e, [field]: val } : e),
    } : d);
  };
  const updateRevIndicator = (key: string, field: keyof CoordIndicatorEntry, val: unknown) => {
    setRevData((d) => d ? {
      ...d,
      indicators: d.indicators.map((e) => e.key === key ? { ...e, [field]: val } : e),
    } : d);
  };

  const allDone = empSubmitted && revSubmitted;
  const isLocked = appraisal.status !== "stage1" && appraisal.status !== "stage2";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button onClick={() => navigate(`/appraisals/${id}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Appraisal
        </button>
        <h1 className="text-2xl font-bold">Stage 1 — Position Specific Performance Review</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{appraisal.staffName} · Assessor: {appraisal.reviewerName ?? "Unassigned"}</p>
        <div className="flex flex-wrap gap-3 mt-2">
          {empSubmitted && appraisal.employeeStage1SubmittedAt && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Coordinator submitted {format(new Date(appraisal.employeeStage1SubmittedAt), "dd/MM/yyyy, h:mm a")}
            </span>
          )}
          {revSubmitted && appraisal.reviewerStage1SubmittedAt && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reviewer submitted {format(new Date(appraisal.reviewerStage1SubmittedAt), "dd/MM/yyyy, h:mm a")}
            </span>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>Both the Coordinator and Assessor complete their ratings independently using the dropdown (1 = Unsatisfactory → 5 = Exceptional). The comment column is a shared space for discussion notes.</span>
      </div>

      {/* ── Position Sections ───────────────────────────────────────── */}
      {COORD_POSITION_SECTIONS.map((section) => (
        <div key={section.key} className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30">
            <h2 className="text-base font-bold">{section.label}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 italic">{section.reviewStatement}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="py-2 px-4 text-left font-medium text-xs text-muted-foreground w-[35%]">Question</th>
                  <th className="py-2 px-3 text-center font-medium text-xs text-blue-700 w-[13%]">Coordinator Rating</th>
                  <th className="py-2 px-3 text-center font-medium text-xs text-primary w-[13%]">Reviewer Rating</th>
                  <th className="py-2 px-3 text-left font-medium text-xs text-muted-foreground w-[30%]">Comment</th>
                  {isAdminOrEL && <th className="py-2 px-3 text-center font-medium text-xs text-muted-foreground w-[9%]">Action</th>}
                </tr>
              </thead>
              <tbody>
                {section.questions.map((q, qi) => {
                  const emp = empData.positionItems.find((e) => e.key === q.key) ?? { key: q.key };
                  const rev = revData.positionItems.find((e) => e.key === q.key) ?? { key: q.key };
                  return (
                    <tr key={q.key} className={`border-b last:border-0 ${qi % 2 === 0 ? "" : "bg-muted/5"}`}>
                      <td className="py-3 px-4 text-sm align-top">{q.question}</td>
                      <td className="py-3 px-3 align-top">
                        <RatingSelect
                          value={emp.empRating}
                          onChange={(v) => updateEmpPosition(q.key, "empRating", v)}
                          disabled={empSubmitted || isLocked || isAdminOrEL}
                        />
                      </td>
                      <td className="py-3 px-3 align-top">
                        <RatingSelect
                          value={rev.revRating}
                          onChange={(v) => updateRevPosition(q.key, "revRating", v)}
                          disabled={revSubmitted || isLocked || !isAdminOrEL}
                        />
                      </td>
                      <td className="py-3 px-3 align-top">
                        <Textarea
                          rows={2}
                          className="text-xs resize-none"
                          placeholder="Notes…"
                          value={emp.comment ?? ""}
                          onChange={(e) => updateEmpPosition(q.key, "comment", e.target.value)}
                          disabled={allDone || isLocked}
                        />
                      </td>
                      {isAdminOrEL && (
                        <td className="py-3 px-3 align-top text-center">
                          <label className="flex flex-col items-center gap-1 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!rev.actionRequired}
                              onChange={(e) => updateRevPosition(q.key, "actionRequired", e.target.checked)}
                              disabled={revSubmitted || isLocked}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="text-muted-foreground text-[10px]">Required</span>
                          </label>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Coordinator Self-Reflection ──────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-base font-bold">Coordinator Self-Reflection</h2>
          <p className="text-xs text-muted-foreground mt-0.5">The Coordinator reflects on their practice and experience; the Reviewer provides feedback on each response.</p>
        </div>
        <div className="divide-y">
          {COORD_SELF_REFLECTION_QUESTIONS.map((q, qi) => {
            const emp = empData.selfReflection.find((e) => e.key === q.key) ?? { key: q.key };
            const rev = revData.selfReflection.find((e) => e.key === q.key) ?? { key: q.key };
            return (
              <div key={q.key} className={`px-6 py-4 space-y-3 ${qi % 2 === 0 ? "" : "bg-muted/5"}`}>
                <p className="font-medium text-sm">{q.question}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Coordinator Response</label>
                    <Textarea
                      rows={3}
                      className="text-sm resize-y"
                      placeholder="Your response…"
                      value={emp.comment ?? ""}
                      onChange={(e) => updateEmpReflection(q.key, "comment", e.target.value)}
                      disabled={empSubmitted || isLocked || isAdminOrEL}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-primary uppercase tracking-wide">Reviewer Feedback</label>
                      {isAdminOrEL && (
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!rev.actionRequired}
                            onChange={(e) => updateRevReflection(q.key, "actionRequired", e.target.checked)}
                            disabled={revSubmitted || isLocked}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-muted-foreground">Action required</span>
                        </label>
                      )}
                    </div>
                    <Textarea
                      rows={3}
                      className="text-sm resize-y"
                      placeholder="Reviewer's feedback…"
                      value={rev.feedback ?? ""}
                      onChange={(e) => updateRevReflection(q.key, "feedback", e.target.value)}
                      disabled={revSubmitted || isLocked || !isAdminOrEL}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Performance Indicators ───────────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-base font-bold">Performance Indicators</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Both parties rate each area independently using the 1–5 scale.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="py-2 px-4 text-left font-medium text-xs text-muted-foreground w-[25%]">Area</th>
                <th className="py-2 px-3 text-center font-medium text-xs text-blue-700 w-[15%]">Coordinator Rating</th>
                <th className="py-2 px-3 text-center font-medium text-xs text-primary w-[15%]">Reviewer Rating</th>
                <th className="py-2 px-3 text-left font-medium text-xs text-muted-foreground w-[36%]">Comment</th>
                {isAdminOrEL && <th className="py-2 px-3 text-center font-medium text-xs text-muted-foreground w-[9%]">Action</th>}
              </tr>
            </thead>
            <tbody>
              {COORD_PERFORMANCE_INDICATORS.map((ind, ii) => {
                const emp = empData.indicators.find((e) => e.key === ind.key) ?? { key: ind.key };
                const rev = revData.indicators.find((e) => e.key === ind.key) ?? { key: ind.key };
                return (
                  <tr key={ind.key} className={`border-b last:border-0 ${ii % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="py-3 px-4 font-medium align-top">{ind.label}</td>
                    <td className="py-3 px-3 align-top">
                      <RatingSelect
                        value={emp.empRating}
                        onChange={(v) => updateEmpIndicator(ind.key, "empRating", v)}
                        disabled={empSubmitted || isLocked || isAdminOrEL}
                      />
                    </td>
                    <td className="py-3 px-3 align-top">
                      <RatingSelect
                        value={rev.revRating}
                        onChange={(v) => updateRevIndicator(ind.key, "revRating", v)}
                        disabled={revSubmitted || isLocked || !isAdminOrEL}
                      />
                    </td>
                    <td className="py-3 px-3 align-top">
                      <Textarea
                        rows={2}
                        className="text-xs resize-none"
                        placeholder="Notes…"
                        value={emp.comment ?? ""}
                        onChange={(e) => updateEmpIndicator(ind.key, "comment", e.target.value)}
                        disabled={allDone || isLocked}
                      />
                    </td>
                    {isAdminOrEL && (
                      <td className="py-3 px-3 align-top text-center">
                        <label className="flex flex-col items-center gap-1 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!rev.actionRequired}
                            onChange={(e) => updateRevIndicator(ind.key, "actionRequired", e.target.checked)}
                            disabled={revSubmitted || isLocked}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-muted-foreground text-[10px]">Required</span>
                        </label>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Submit Section ───────────────────────────────────────────── */}
      {!isLocked && (
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          {/* Employee submit */}
          {!isAdminOrEL && (
            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
              <div>
                <h3 className="font-semibold text-sm text-blue-900">Your Assessment</h3>
                <p className="text-xs text-blue-700 mt-0.5">Once submitted you cannot edit your ratings or comments.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveDraftMutation.mutate("employee")}
                  disabled={saveDraftMutation.isPending || empSubmitted}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitEmpMutation.mutate()}
                  disabled={empSubmitted || submitEmpMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {empSubmitted ? "Submitted ✓" : submitEmpMutation.isPending ? "Submitting…" : "Submit My Assessment"}
                </Button>
              </div>
            </div>
          )}

          {/* Reviewer submit */}
          {isAdminOrEL && (
            <div className="flex-1 bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
              <div>
                <h3 className="font-semibold text-sm">Reviewer Assessment</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Once submitted you cannot edit reviewer ratings or action flags.</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveDraftMutation.mutate("reviewer")}
                  disabled={saveDraftMutation.isPending || revSubmitted}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={() => submitRevMutation.mutate()}
                  disabled={revSubmitted || submitRevMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {revSubmitted ? "Submitted ✓" : submitRevMutation.isPending ? "Submitting…" : "Submit Reviewer Assessment"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isLocked && (
        <div className="bg-muted/30 border rounded-lg px-4 py-3 text-sm text-muted-foreground text-center">
          Stage 1 is locked — all data submitted.
        </div>
      )}
    </div>
  );
}
