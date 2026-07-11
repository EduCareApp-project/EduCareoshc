import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, Save, Send, Lock, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/use-permissions";
import {
  COORD_UPWARD_SECTIONS, LIKERT_OPTIONS,
  buildEmptyCoordStage2,
  type CoordStage2Data, type LikertEntry,
} from "@/lib/appraisal-constants";

type Appraisal = {
  id: number;
  staffName: string;
  reviewerName: string | null;
  status: string;
  stage2Data: CoordStage2Data | null;
  stage2SubmittedAt: string | null;
};

function LikertRow({
  statement,
  entry,
  onChange,
  disabled,
}: {
  statement: string;
  entry: LikertEntry;
  onChange: (updated: LikertEntry) => void;
  disabled: boolean;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <p className="font-medium text-sm">{statement}</p>
      <div className="flex flex-wrap gap-2">
        {LIKERT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={disabled}
            onClick={() => onChange({ ...entry, rating: opt.value })}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
              entry.rating === opt.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CoordAppraisalStage2() {
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

  const [formData, setFormData] = useState<CoordStage2Data | null>(null);
  const submitted = !!appraisal?.stage2SubmittedAt;

  useEffect(() => {
    if (!appraisal || formData !== null) return;
    setFormData(appraisal.stage2Data ?? buildEmptyCoordStage2());
  }, [appraisal?.id]);

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
      toast({ title: "Upward Appraisal submitted!" });
      navigate(`/appraisals/${id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || formData === null) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!appraisal) return <div className="p-6 text-center text-muted-foreground">Appraisal not found.</div>;

  if (appraisal.status !== "stage2" && !submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-lg font-semibold">Stage 2 not yet available</h2>
        <p className="text-muted-foreground text-sm">Stage 1 must be submitted first.</p>
        <Button onClick={() => navigate(`/appraisals/${id}`)}>Back to Appraisal</Button>
      </div>
    );
  }

  if (isAdminOrEL && !submitted) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <Lock className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Stage 2 — Upward Appraisal</h2>
        <p className="text-muted-foreground text-sm">This stage is completed privately by the Coordinator and is not visible to reviewers until the appraisal is completed.</p>
        <Button onClick={() => navigate(`/appraisals/${id}`)}>Back to Appraisal</Button>
      </div>
    );
  }

  const updateEntry = (sectionKey: keyof CoordStage2Data, statementKey: string, updated: LikertEntry) => {
    setFormData((d) => {
      if (!d) return d;
      const section = d[sectionKey] as LikertEntry[];
      return { ...d, [sectionKey]: section.map((e) => e.key === statementKey ? updated : e) };
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button onClick={() => navigate(`/appraisals/${id}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Appraisal
        </button>
        <h1 className="text-2xl font-bold">Stage 2 — Upward Appraisal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{appraisal.staffName}</p>
        {submitted && appraisal.stage2SubmittedAt && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Submitted {format(new Date(appraisal.stage2SubmittedAt), "dd/MM/yyyy, h:mm a")}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>This section is completed privately by you as the Coordinator. Your responses are not shared with your reviewer until the appraisal is fully completed. Please respond honestly.</span>
      </div>

      {COORD_UPWARD_SECTIONS.map((section) => {
        const sectionKey = section.key as keyof CoordStage2Data;
        const entries = (formData[sectionKey] as LikertEntry[]) ?? [];
        return (
          <div key={section.key} className="bg-card border rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold border-b pb-3">{section.label}</h2>
            <div className="space-y-4">
              {section.statements.map((stmt) => {
                const entry = entries.find((e) => e.key === stmt.key) ?? { key: stmt.key };
                return (
                  <LikertRow
                    key={stmt.key}
                    statement={stmt.statement}
                    entry={entry}
                    onChange={(updated) => updateEntry(sectionKey, stmt.key, updated)}
                    disabled={submitted}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {!submitted && (
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
          </Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {submitMutation.isPending ? "Submitting…" : "Submit Upward Appraisal"}
          </Button>
        </div>
      )}
    </div>
  );
}
