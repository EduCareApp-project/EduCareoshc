import { useState } from "react";
import { useCreateObservation, useListChildren, useListStaff, getListObservationsQueryKey } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
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
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const prefilledChildId = searchParams.get("childId");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createObservation = useCreateObservation();
  const { data: children } = useListChildren();
  const { data: staff } = useListStaff();

  const activeChildren = useMemo(() => children?.filter((c) => c.status === "active") || [], [children]);

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    childId: prefilledChildId || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.childId) e.childId = "Select a child";
    if (!form.staffId) e.staffId = "Select an educator";
    if (!form.observationDate) e.observationDate = "Date is required";
    if (!form.description.trim()) e.description = "Observation is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const body: Record<string, unknown> = {
      childId: parseInt(form.childId),
      staffId: parseInt(form.staffId),
      observationDate: form.observationDate,
      description: form.description.trim(),
    };
    if (form.commentPlan.trim()) body.commentPlan = form.commentPlan.trim();
    if (form.actionNotes.trim()) body.actionNotes = form.actionNotes.trim();

    createObservation.mutate(
      { data: body as any },
      {
        onSuccess: (obs) => {
          queryClient.invalidateQueries({ queryKey: getListObservationsQueryKey() });
          toast({ title: "Observation recorded" });
          setLocation(`/observations/${obs.id}`);
        },
        onError: () => toast({ title: "Failed to save observation", variant: "destructive" }),
      }
    );
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
          <h1 className="text-2xl font-bold tracking-tight">New Observation</h1>
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
          <Button type="submit" disabled={createObservation.isPending}>
            {createObservation.isPending ? "Saving..." : "Save Observation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
