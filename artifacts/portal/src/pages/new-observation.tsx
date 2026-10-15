import { useEffect, useState } from "react";
import {
  useCreateObservation,
  useGetObservation,
  useUpdateObservation,
  getGetObservationQueryKey,
  getListObservationsQueryKey,
} from "@workspace/api-client-react";
import { useActiveStaff } from "@/hooks/use-active-staff";
import { useActiveChildren } from "@/hooks/use-active-children";
import { useLocation, useRoute, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText } from "lucide-react";
import { useMemo } from "react";
import { MtopOutcomePicker } from "@/components/mtop-outcome-picker";

const EMPTY_FORM = {
  childId: "",
  staffId: "",
  observationDate: new Date().toISOString().split("T")[0],
  description: "",
  commentPlan: "",
  actionNotes: "",
};

export default function NewObservation() {
  const [, setLocation] = useLocation();
  const [, editParams] = useRoute("/observations/:id/edit");
  const observationId = editParams?.id ? parseInt(editParams.id) : 0;
  const isEditing = observationId > 0;
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const prefilledChildId = searchParams.get("childId");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createObservation = useCreateObservation();
  const updateObservation = useUpdateObservation();
  const { data: existingObservation } = useGetObservation(observationId, {
    query: { queryKey: getGetObservationQueryKey(observationId), enabled: isEditing },
  });
  const { data: children } = useActiveChildren();
  const { data: staff } = useActiveStaff();

  const activeChildren = useMemo(() => children?.filter((c) => c.status === "active") || [], [children]);

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    childId: prefilledChildId || "",
  });
  const [outcomeIds, setOutcomeIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!existingObservation || initialised) return;
    setForm({
      childId: String(existingObservation.childId),
      staffId: String(existingObservation.staffId),
      observationDate: existingObservation.observationDate.slice(0, 10),
      description: existingObservation.description,
      commentPlan: existingObservation.commentPlan ?? "",
      actionNotes: existingObservation.actionNotes ?? "",
    });
    setOutcomeIds(existingObservation.outcomeIds ?? []);
    setInitialised(true);
  }, [existingObservation, initialised]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.childId) e.childId = "Select a child";
    else if (!activeChildren.some((child) => child.id === Number(form.childId))) e.childId = "Select an active child";
    if (!form.staffId) e.staffId = "Select an educator";
    if (!form.observationDate) e.observationDate = "Date is required";
    if (!form.description.trim()) e.description = "Observation is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function saveObservation(publish: boolean) {
    if (!validate()) return;

    const body: Record<string, unknown> = {
      childId: parseInt(form.childId),
      staffId: parseInt(form.staffId),
      observationDate: form.observationDate,
      description: form.description.trim(),
      outcomeIds,
      ...(publish
        ? { publishedAt: new Date().toISOString() }
        : isEditing
          ? {}
          : { publishedAt: null }),
    };
    if (form.commentPlan.trim()) body.commentPlan = form.commentPlan.trim();
    if (form.actionNotes.trim()) body.actionNotes = form.actionNotes.trim();

    const mutation = isEditing ? updateObservation : createObservation;
    const variables = isEditing
      ? { id: observationId, data: body as any }
      : { data: body as any };

    mutation.mutate(
      variables as any,
      {
        onSuccess: (obs) => {
          queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() });
          if (isEditing) queryClient.invalidateQueries({ queryKey: getGetObservationQueryKey(observationId) });
          toast({ title: publish ? "Observation published" : "Draft saved" });
          setLocation(publish ? `/observations/${obs.id}` : "/observations");
        },
        onError: () => toast({ title: "Failed to save observation", variant: "destructive" }),
      }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveObservation(true);
  }

  const f = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Continue Observation" : "New Observation"}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Context</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Child</Label>
              <Select value={form.childId} onValueChange={(v) => f("childId", v)}>
                <SelectTrigger className={errors.childId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {activeChildren.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.firstName} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.childId && <p className="text-xs text-destructive">{errors.childId}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Educator</Label>
              <Select value={form.staffId} onValueChange={(v) => f("staffId", v)}>
                <SelectTrigger className={errors.staffId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select educator" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.staffId && <p className="text-xs text-destructive">{errors.staffId}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.observationDate}
                onChange={(e) => f("observationDate", e.target.value)}
                className={errors.observationDate ? "border-destructive" : ""}
              />
              {errors.observationDate && <p className="text-xs text-destructive">{errors.observationDate}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documentation</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>MTOP Outcomes</Label>
              <MtopOutcomePicker value={outcomeIds} onChange={setOutcomeIds} label="MTOP Outcomes" />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Observation</Label>
              <Textarea
                rows={6}
                placeholder="Describe what the child did, said, and how they engaged..."
                value={form.description}
                onChange={(e) => f("description", e.target.value)}
                className={errors.description ? "border-destructive" : ""}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Comment / Plan</Label>
              <Textarea
                rows={4}
                placeholder="Educator's analysis, interpretation, and planned next steps..."
                value={form.commentPlan}
                onChange={(e) => f("commentPlan", e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Action Notes <span className="text-muted-foreground font-normal text-xs">(optional — can be added later)</span></Label>
              <Textarea
                rows={3}
                placeholder="Actions taken or follow-up steps completed..."
                value={form.actionNotes}
                onChange={(e) => f("actionNotes", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => history.back()}>Cancel</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => saveObservation(false)}
            disabled={createObservation.isPending || updateObservation.isPending}
          >
            Save Draft
          </Button>
          <Button type="submit" disabled={createObservation.isPending || updateObservation.isPending}>
            {createObservation.isPending || updateObservation.isPending ? "Saving..." : "Publish Observation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
