import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, Save, Send, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  UPWARD_APPRAISAL_SECTIONS, LIKERT_OPTIONS,
  buildEmptyStage2,
  type Stage2Data,
} from "@/lib/appraisal-constants";

type Appraisal = {
  id: number;
  staffName: string;
  status: string;
  stage2Data: Stage2Data | null;
  stage2SubmittedAt: string | null;
};

const LIKERT_COLORS: Record<number, string> = {
  7: "bg-emerald-600 text-white",
  6: "bg-emerald-500 text-white",
  5: "bg-lime-500 text-white",
  4: "bg-slate-300 text-slate-700",
  3: "bg-amber-400 text-white",
  2: "bg-orange-500 text-white",
  1: "bg-red-600 text-white",
};

type SectionKey = "manager" | "team" | "organisation" | "workArea";

export default function AppraisalStage2() {
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

  const [formData, setFormData] = useState<Stage2Data>(() => buildEmptyStage2());

  useEffect(() => {
    if (appraisal) {
      setFormData(appraisal.stage2Data ?? buildEmptyStage2());
    }
  }, [appraisal?.id]);

  const submitted = !!appraisal?.stage2SubmittedAt;

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}/stage2/draft`, {
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
      const res = await fetch(`/api/appraisals/${id}/stage2`, {
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
      toast({ title: "Upward appraisal submitted — Stage 3 is now available." });
      navigate(`/appraisals/${id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const setRating = (section: SectionKey, key: string, rating: number) => {
    setFormData((d) => ({
      ...d,
      [section]: d[section].map((s) => s.key === key ? { ...s, rating } : s),
    }));
  };

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!appraisal) return <div className="p-6 text-center text-muted-foreground">Appraisal not found.</div>;

  if (appraisal.status !== "stage2" && !submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-lg font-semibold">Stage 2 not yet available</h2>
        <p className="text-muted-foreground text-sm">Both Stage 1 assessments must be submitted before Stage 2 opens.</p>
        <Button onClick={() => navigate(`/appraisals/${id}`)}>Back to Appraisal</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button onClick={() => navigate(`/appraisals/${id}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Appraisal
        </button>
        <h1 className="text-2xl font-bold">Stage 2 — Upward Appraisal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{appraisal.staffName} · Completed privately by the educator</p>
        {submitted && appraisal.stage2SubmittedAt && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Submitted {format(new Date(appraisal.stage2SubmittedAt), "d MMM yyyy, h:mm a")}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>This section is completed privately by the educator. Please respond honestly — your feedback is valued and helps improve the workplace. Select the option that best reflects your experience.</span>
      </div>

      {/* Sections */}
      {UPWARD_APPRAISAL_SECTIONS.map((section) => {
        const sectionData = formData[section.key as SectionKey] ?? [];
        return (
          <div key={section.key} className="bg-card border rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold border-b pb-3">{section.label}</h2>

            <div className="space-y-4">
              {section.statements.map((stmt) => {
                const entry = sectionData.find((s) => s.key === stmt.key);
                const current = entry?.rating;
                return (
                  <div key={stmt.key} className="space-y-2">
                    <p className="text-sm font-medium">{stmt.statement}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LIKERT_OPTIONS.map((opt) => {
                        const selected = current === opt.value;
                        return (
                          <button
                            key={opt.value}
                            disabled={submitted}
                            onClick={() => setRating(section.key as SectionKey, stmt.key, opt.value)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                              selected
                                ? `${LIKERT_COLORS[opt.value]} border-transparent shadow-sm`
                                : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            } ${submitted ? "cursor-default opacity-80" : ""}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {current && (
                      <p className="text-xs text-muted-foreground">
                        Selected: <span className="font-medium text-foreground">{LIKERT_OPTIONS.find((o) => o.value === current)?.label}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      {!submitted && (
        <div className="flex gap-3 pb-8">
          <Button variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
            <Save className="h-4 w-4 mr-1.5" />
            {saveDraftMutation.isPending ? "Saving…" : "Save Draft"}
          </Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            <Send className="h-4 w-4 mr-1.5" />
            {submitMutation.isPending ? "Submitting…" : "Submit Upward Appraisal"}
          </Button>
        </div>
      )}

      {submitted && (
        <div className="flex gap-3 pb-8">
          <Button variant="outline" onClick={() => navigate(`/appraisals/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Appraisal
          </Button>
        </div>
      )}
    </div>
  );
}
