import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  useGetPlanningExperience,
  useCreatePlanningExperience,
  useUpdatePlanningExperience,
  useDeletePlanningExperience,
  useListChildren,
  useListSites,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STAGE_LABELS: Record<string, string> = {
  brainstorm: "Brainstorm",
  planned: "Planned",
  implemented: "Implemented",
  evaluated: "Evaluated",
};

type FormState = {
  title: string;
  startDate: string;
  siteId: string;
  childIds: number[];
  stage: string;
  collaborateExplore: string;
  identifySkills: string;
  researchIdeas: string;
  frameworkLinks: string;
  qualityAreas: string;
  additionalResources: string;
  assessAndReview: string;
  learning: string;
  backgroundInformation: string;
  preparedBy: string;
  editedBy: string;
};

const emptyForm = (): FormState => ({
  title: "",
  startDate: "",
  siteId: "none",
  childIds: [],
  stage: "brainstorm",
  collaborateExplore: "",
  identifySkills: "",
  researchIdeas: "",
  frameworkLinks: "",
  qualityAreas: "",
  additionalResources: "",
  assessAndReview: "",
  learning: "",
  backgroundInformation: "",
  preparedBy: "",
  editedBy: "",
});

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b pb-3 mb-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

function PromptTextarea({
  label,
  prompt,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  prompt: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground leading-relaxed">{prompt}</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder="Type here..."
        className="resize-y"
      />
    </div>
  );
}

export default function PlanningDetail() {
  const params = useParams<{ id?: string }>();
  const id = params.id && params.id !== "new" ? parseInt(params.id, 10) : null;
  const isNew = id === null;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: experience, isLoading: loadingExp } = useGetPlanningExperience(
    { id: id! },
    { query: { enabled: !isNew } }
  );
  const { data: children } = useListChildren();
  const { data: sites } = useListSites();

  const createMutation = useCreatePlanningExperience();
  const updateMutation = useUpdatePlanningExperience();
  const deleteMutation = useDeletePlanningExperience();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isNew && experience && !initialized) {
      setForm({
        title: experience.title ?? "",
        startDate: experience.startDate ?? "",
        siteId: experience.siteId ? String(experience.siteId) : "none",
        childIds: experience.childIds ?? [],
        stage: experience.stage ?? "brainstorm",
        collaborateExplore: experience.collaborateExplore ?? "",
        identifySkills: experience.identifySkills ?? "",
        researchIdeas: experience.researchIdeas ?? "",
        frameworkLinks: experience.frameworkLinks ?? "",
        qualityAreas: experience.qualityAreas ?? "",
        additionalResources: experience.additionalResources ?? "",
        assessAndReview: experience.assessAndReview ?? "",
        learning: experience.learning ?? "",
        backgroundInformation: experience.backgroundInformation ?? "",
        preparedBy: experience.preparedBy ?? "",
        editedBy: experience.editedBy ?? "",
      });
      setInitialized(true);
    }
    if (isNew && !initialized) setInitialized(true);
  }, [experience, isNew, initialized]);

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleChild(childId: number) {
    setForm((f) => ({
      ...f,
      childIds: f.childIds.includes(childId)
        ? f.childIds.filter((c) => c !== childId)
        : [...f.childIds, childId],
    }));
  }

  function buildPayload() {
    const payload: Record<string, unknown> = {
      title: form.title,
      stage: form.stage,
      childIds: form.childIds,
      outcomeIds: experience?.outcomeIds ?? [],
      ageGroups: experience?.ageGroups ?? [],
    };
    if (form.startDate) payload.startDate = form.startDate;
    if (form.siteId !== "none") payload.siteId = parseInt(form.siteId, 10);
    else payload.siteId = null;
    const textFields: (keyof FormState)[] = [
      "collaborateExplore", "identifySkills", "researchIdeas",
      "frameworkLinks", "qualityAreas", "additionalResources",
      "assessAndReview", "learning", "backgroundInformation",
      "preparedBy", "editedBy",
    ];
    for (const f of textFields) {
      if (form[f]) payload[f] = form[f];
    }
    return payload;
  }

  function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Experience title is required", variant: "destructive" });
      return;
    }
    const payload = buildPayload();
    if (isNew) {
      createMutation.mutate({ data: payload as any }, {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ["/api/planning"] });
          toast({ title: "Planning cycle created" });
          window.history.replaceState(null, "", `/planning/${data.id}`);
          window.location.href = `/planning/${data.id}`;
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      });
    } else {
      updateMutation.mutate({ id: id!, data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/planning"] });
          queryClient.invalidateQueries({ queryKey: [`/api/planning/${id}`] });
          toast({ title: "Changes saved" });
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      });
    }
  }

  function handleDelete() {
    deleteMutation.mutate({ id: id! }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/planning"] });
        window.location.href = "/planning";
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && loadingExp) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      <div className="flex items-center justify-between">
        <button
          onClick={() => (window.location.href = "/planning")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />Back to Planning Cycle
        </button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                  <Trash2 className="h-4 w-4 mr-1.5" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete planning cycle?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{experience?.title ?? form.title}" and all its content. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1.5" />{isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <SectionHeader
          title="Planning Cycle"
          description="Document the details of this educational experience."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Experience Title <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Enter a title for this experience"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Commencement Date</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={form.siteId} onValueChange={(v) => set("siteId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select site…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />Focus Children
          </Label>
          <p className="text-xs text-muted-foreground">Select the children this experience is centred around.</p>
          {(children ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No children enrolled yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {(children ?? []).map((child) => {
                const selected = form.childIds.includes(child.id);
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => toggleChild(child.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {child.firstName} {child.lastName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-6">
        <SectionHeader title="Collaborate / Explore Options" />

        <PromptTextarea
          label="Where did the theme come from?"
          prompt="Where did the theme for the experience come from? What could be accomplished with this theme? Who was involved in generating ideas?"
          value={form.collaborateExplore}
          onChange={(v) => set("collaborateExplore", v)}
          rows={5}
        />

        <PromptTextarea
          label="Identify Skills"
          prompt="What skills do staff and children have to support the experience? Will information need to be researched or will additional support need to be sourced for the experience?"
          value={form.identifySkills}
          onChange={(v) => set("identifySkills", v)}
          rows={5}
        />
      </div>

      <div className="bg-white border rounded-xl p-6">
        <SectionHeader
          title="Research Ideas"
          description="Begin formulating a plan that includes activities, games, resources, and opportunities that would help support the experience for the focus child. These activities could be one on one, group activities, experience tables/boxes, literature, fine motor, gross motor, science, technology, or wellness."
        />
        <Textarea
          value={form.researchIdeas}
          onChange={(e) => set("researchIdeas", e.target.value)}
          rows={6}
          placeholder="Type here..."
          className="resize-y"
        />
      </div>

      <div className="bg-white border rounded-xl p-6">
        <SectionHeader
          title="Framework Links"
          description="Take a look at documents such as the National Quality Standards, My Time Our Place and the outcomes for school aged children and match elements with the activities you have planned. Remember that there are many things that guide our intentions as educators and often we can link those into the experience as well."
        />
        <Textarea
          value={form.frameworkLinks}
          onChange={(e) => set("frameworkLinks", e.target.value)}
          rows={5}
          placeholder="Type here..."
          className="resize-y"
        />
      </div>

      <div className="bg-white border rounded-xl p-6">
        <SectionHeader
          title="Quality Areas"
          description="Take a look at the quality areas for OSHC and see if there are any that can be connected or strengthened with your experience. List down any areas that would gain significant benefit from this experience. How will the experience strengthen relationships between children, staff, family, and community?"
        />
        <Textarea
          value={form.qualityAreas}
          onChange={(e) => set("qualityAreas", e.target.value)}
          rows={5}
          placeholder="Type here..."
          className="resize-y"
        />
      </div>

      <div className="bg-white border rounded-xl p-6">
        <SectionHeader title="Additional Resources" />
        <PromptTextarea
          label=""
          prompt="Can you list any additional resources needed for this experience?"
          value={form.additionalResources}
          onChange={(v) => set("additionalResources", v)}
          rows={4}
        />
      </div>

      <div className="bg-white border rounded-xl p-6">
        <SectionHeader title="Assess and Review" />
        <PromptTextarea
          label=""
          prompt="How will this experience be assessed and reviewed? Who will take part in the review?"
          value={form.assessAndReview}
          onChange={(v) => set("assessAndReview", v)}
          rows={5}
        />
      </div>

      <div className="bg-white border rounded-xl p-6">
        <SectionHeader title="Learning" />
        <PromptTextarea
          label=""
          prompt="How will the content be delivered in the learning environment? Will there need to be different strategies for different children or experiences? How will children recognise their own learning? How will families recognise the learning the children are experiencing?"
          value={form.learning}
          onChange={(v) => set("learning", v)}
          rows={6}
        />
      </div>

      <div className="bg-white border rounded-xl p-6">
        <SectionHeader title="Background Information" />
        <PromptTextarea
          label=""
          prompt="What background information is needed for educators or children?"
          value={form.backgroundInformation}
          onChange={(v) => set("backgroundInformation", v)}
          rows={5}
        />
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Sign-off" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Prepared by</Label>
            <Input
              value={form.preparedBy}
              onChange={(e) => set("preparedBy", e.target.value)}
              placeholder="Name of preparer"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Edited by</Label>
            <Input
              value={form.editedBy}
              onChange={(e) => set("editedBy", e.target.value)}
              placeholder="Name of editor"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {!isNew && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                <Trash2 className="h-4 w-4 mr-1.5" />Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete planning cycle?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this planning cycle and all its content. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <Save className="h-4 w-4 mr-1.5" />{isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
