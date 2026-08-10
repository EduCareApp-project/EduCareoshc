import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, Save, Send, Lock, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fmtMelb } from "@/lib/timezone";
import { usePermissions } from "@/hooks/use-permissions";
import {
  COORD_LEADERSHIP_CAPABILITIES, RATING_SCALE,
  buildEmptyCoordStage3,
  type CoordStage3Data,
} from "@/lib/appraisal-constants";

type Appraisal = {
  id: number;
  staffName: string;
  reviewerName: string | null;
  status: string;
  coordLeadershipData: CoordStage3Data | null;
  coordLeadershipSubmittedAt: string | null;
  completedAt: string | null;
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

export default function CoordAppraisalStage3() {
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

  const [formData, setFormData] = useState<CoordStage3Data | null>(null);
  const submitted = !!appraisal?.coordLeadershipSubmittedAt;
  const completed = !!appraisal?.completedAt;

  useEffect(() => {
    if (!appraisal || formData !== null) return;
    setFormData(appraisal.coordLeadershipData ?? buildEmptyCoordStage3());
  }, [appraisal?.id]);

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appraisals/${id}/coord-stage3/draft`, {
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
      const res = await fetch(`/api/appraisals/${id}/coord-stage3`, {
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
      toast({ title: "Leadership Summary submitted!" });
      navigate(`/appraisals/${id}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading || formData === null) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!appraisal) return <div className="p-6 text-center text-muted-foreground">Appraisal not found.</div>;

  const statusNum = { stage1: 1, stage2: 2, stage3: 3, stage4: 4, completed: 5 }[appraisal.status] ?? 0;

  if (statusNum < 3) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <h2 className="text-lg font-semibold">Stage 3 not yet available</h2>
        <p className="text-muted-foreground text-sm">Stage 2 must be submitted before the Leadership Summary opens.</p>
        <Button onClick={() => navigate(`/appraisals/${id}`)}>Back to Appraisal</Button>
      </div>
    );
  }

  if (!isAdminOrEL && !completed) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-4">
        <Lock className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <h2 className="text-lg font-semibold">Stage 3 — Leadership Summary</h2>
        <p className="text-muted-foreground text-sm">This stage is completed by your Assessor only. You will be able to view it once the full appraisal is completed.</p>
        <Button onClick={() => navigate(`/appraisals/${id}`)}>Back to Appraisal</Button>
      </div>
    );
  }

  const updateCapability = (key: string, field: string, val: unknown) => {
    setFormData((d) => d ? {
      ...d,
      capabilities: d.capabilities.map((c) => c.key === key ? { ...c, [field]: val } : c),
    } : d);
  };

  const isReadOnly = submitted || !isAdminOrEL;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button onClick={() => navigate(`/appraisals/${id}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to Appraisal
        </button>
        <h1 className="text-2xl font-bold">Stage 3 — Leadership Summary</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{appraisal.staffName} · Assessor: {appraisal.reviewerName ?? "Unassigned"}</p>
        {submitted && appraisal.coordLeadershipSubmittedAt && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Submitted {fmtMelb(appraisal.coordLeadershipSubmittedAt, "dd/MM/yyyy, h:mm a")}
          </div>
        )}
      </div>

      {isAdminOrEL && !submitted && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex gap-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>This summary is completed by the Assessor only. Rate each leadership capability and note any areas requiring action. Your assessment will remain private until the full appraisal is completed.</span>
        </div>
      )}

      {!isAdminOrEL && completed && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-3 text-sm text-amber-800">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>This is your Assessor's Leadership Summary. It is now viewable as your appraisal has been completed.</span>
        </div>
      )}

      {/* Rating Legend */}
      <div className="bg-muted/50 rounded-lg px-4 py-3 flex flex-wrap gap-x-4 gap-y-1">
        {RATING_SCALE.map((r) => (
          <span key={r.value} className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{r.value}</span> — {r.label.split(" – ")[1]}</span>
        ))}
      </div>

      {/* ── Leadership Capability Table ─────────────────────────────── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/30">
          <h2 className="text-base font-bold">Leadership Capability Assessment</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Rate the Coordinator's performance against each leadership capability.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="py-2 px-4 text-left font-medium text-xs text-muted-foreground w-[30%]">Capability</th>
                <th className="py-2 px-3 text-center font-medium text-xs text-primary w-[15%]">Rating</th>
                <th className="py-2 px-3 text-left font-medium text-xs text-muted-foreground w-[45%]">Comment</th>
                {isAdminOrEL && <th className="py-2 px-3 text-center font-medium text-xs text-muted-foreground w-[10%]">Action</th>}
              </tr>
            </thead>
            <tbody>
              {COORD_LEADERSHIP_CAPABILITIES.map((cap, ci) => {
                const entry = formData.capabilities.find((c) => c.key === cap.key) ?? { key: cap.key };
                return (
                  <tr key={cap.key} className={`border-b last:border-0 ${ci % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="py-3 px-4 font-medium align-top">{cap.label}</td>
                    <td className="py-3 px-3 align-top">
                      <RatingSelect
                        value={entry.rating}
                        onChange={(v) => updateCapability(cap.key, "rating", v)}
                        disabled={isReadOnly}
                      />
                    </td>
                    <td className="py-3 px-3 align-top">
                      <Textarea
                        rows={2}
                        className="text-xs resize-none"
                        placeholder="Notes on this capability…"
                        value={entry.comment ?? ""}
                        onChange={(e) => updateCapability(cap.key, "comment", e.target.value)}
                        disabled={isReadOnly}
                      />
                    </td>
                    {isAdminOrEL && (
                      <td className="py-3 px-3 align-top text-center">
                        <label className="flex flex-col items-center gap-1 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!entry.actionRequired}
                            onChange={(e) => updateCapability(cap.key, "actionRequired", e.target.checked)}
                            disabled={isReadOnly}
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

      {/* ── Greatest Strength & Priority ────────────────────────────── */}
      <div className="bg-card border rounded-xl p-6 space-y-5">
        <h2 className="text-base font-bold border-b pb-3">Assessor Summary</h2>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Educator's Greatest Strength</Label>
          <Textarea
            rows={4}
            className="text-sm resize-y"
            placeholder="Describe the Coordinator's greatest strength…"
            value={formData.greatestStrength ?? ""}
            onChange={(e) => setFormData((d) => d ? { ...d, greatestStrength: e.target.value } : d)}
            disabled={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Highest Priority for Development (next 12 months)</Label>
          <Textarea
            rows={4}
            className="text-sm resize-y"
            placeholder="Describe the highest priority area for development…"
            value={formData.highestPriority ?? ""}
            onChange={(e) => setFormData((d) => d ? { ...d, highestPriority: e.target.value } : d)}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {isAdminOrEL && !submitted && (
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Draft
          </Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {submitMutation.isPending ? "Submitting…" : "Submit Leadership Summary"}
          </Button>
        </div>
      )}
    </div>
  );
}
