import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  useGetPlanningExperience,
  useCreatePlanningExperience,
  useUpdatePlanningExperience,
  useDeletePlanningExperience,
  useListChildren,
  useListSites,
  useListStaff,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Users, Upload, FileText, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STAGE_LABELS: Record<string, string> = {
  brainstorm: "Brainstorm",
  planned: "Planned",
  implemented: "Implemented",
  evaluated: "Evaluated",
};

type DocEntry = { path: string; name: string };

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
  documents: DocEntry[];
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
  preparedBy: "none",
  editedBy: "none",
  documents: [],
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
      {label && <Label className="text-sm font-medium">{label}</Label>}
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: experience, isLoading: loadingExp } = useGetPlanningExperience(
    id ?? 0,
    { query: { enabled: !isNew && id !== null } }
  );
  const { data: allChildren } = useListChildren();
  const { data: sites } = useListSites();
  const { data: staffList } = useListStaff();

  const { uploadFile, isUploading } = useUpload({
    onError: () => toast({ title: "File upload failed", variant: "destructive" }),
  });

  const createMutation = useCreatePlanningExperience();
  const updateMutation = useUpdatePlanningExperience();
  const deleteMutation = useDeletePlanningExperience();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!isNew && experience && !initialized) {
      const paths = experience.documentPaths ?? [];
      const names = experience.documentNames ?? [];
      const docs: DocEntry[] = paths.map((p, i) => ({ path: p, name: names[i] ?? p }));
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
        preparedBy: experience.preparedBy ?? "none",
        editedBy: experience.editedBy ?? "none",
        documents: docs,
      });
      setInitialized(true);
    }
    if (isNew && !initialized) setInitialized(true);
  }, [experience, isNew, initialized]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
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

  // When site changes, drop any selected children not in the new site
  function handleSiteChange(newSiteId: string) {
    setForm((f) => {
      const filtered =
        newSiteId === "none" || newSiteId === "all"
          ? f.childIds
          : f.childIds.filter((cid) => {
              const child = (allChildren ?? []).find((c) => c.id === cid);
              return child?.siteId === parseInt(newSiteId, 10);
            });
      return { ...f, siteId: newSiteId, childIds: filtered };
    });
  }

  // Active children filtered by selected site
  const visibleChildren = (allChildren ?? []).filter((c) => {
    if (c.status !== "active") return false;
    if (form.siteId === "none" || form.siteId === "all") return true;
    return c.siteId === parseInt(form.siteId, 10);
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    for (const file of files) {
      const response = await uploadFile(file);
      if (response) {
        setForm((f) => ({
          ...f,
          documents: [...f.documents, { path: response.objectPath, name: file.name }],
        }));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeDocument(index: number) {
    setForm((f) => ({ ...f, documents: f.documents.filter((_, i) => i !== index) }));
  }

  function buildPayload() {
    const payload: Record<string, unknown> = {
      title: form.title,
      stage: form.stage,
      childIds: form.childIds,
      outcomeIds: experience?.outcomeIds ?? [],
      ageGroups: experience?.ageGroups ?? [],
      documentPaths: form.documents.map((d) => d.path),
      documentNames: form.documents.map((d) => d.name),
    };
    if (form.startDate) payload.startDate = form.startDate;
    if (form.siteId !== "none") payload.siteId = parseInt(form.siteId, 10);
    else payload.siteId = null;

    const textFields: (keyof FormState)[] = [
      "collaborateExplore", "identifySkills", "researchIdeas",
      "frameworkLinks", "qualityAreas", "additionalResources",
      "assessAndReview", "learning", "backgroundInformation",
    ];
    for (const f of textFields) {
      if (form[f]) payload[f] = form[f];
    }
    if (form.preparedBy !== "none") payload.preparedBy = form.preparedBy;
    if (form.editedBy !== "none") payload.editedBy = form.editedBy;
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

  const activeStaff = (staffList ?? []).filter((s) => s.status === "active");

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Top bar */}
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
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

      {/* Header section */}
      <div className="bg-white border rounded-xl p-6 space-y-6">
        <SectionHeader title="Planning Cycle" description="Document the details of this educational experience." />

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
            <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={form.siteId} onValueChange={handleSiteChange}>
              <SelectTrigger><SelectValue placeholder="Select site…" /></SelectTrigger>
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Focus Children */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />Focus Children
          </Label>
          <p className="text-xs text-muted-foreground">
            {form.siteId === "none"
              ? "Select a location above to filter children by site, or choose from all active children."
              : "Showing active children enrolled at the selected location."}
          </p>
          {visibleChildren.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              {form.siteId === "none" ? "No active children enrolled yet." : "No active children at this location."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
              {visibleChildren.map((child) => {
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

      {/* Collaborate / Explore */}
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

      {/* Research Ideas */}
      <div className="bg-white border rounded-xl p-6">
        <SectionHeader
          title="Research Ideas"
          description="Begin formulating a plan that includes activities, games, resources, and opportunities that would help support the experience for the focus child. These activities could be one on one, group activities, experience tables/boxes, literature, fine motor, gross motor, science, technology, or wellness."
        />
        <Textarea value={form.researchIdeas} onChange={(e) => set("researchIdeas", e.target.value)} rows={6} placeholder="Type here..." className="resize-y" />
      </div>

      {/* Framework Links */}
      <div className="bg-white border rounded-xl p-6">
        <SectionHeader
          title="Framework Links"
          description="Take a look at documents such as the National Quality Standards, My Time Our Place and the outcomes for school aged children and match elements with the activities you have planned."
        />
        <Textarea value={form.frameworkLinks} onChange={(e) => set("frameworkLinks", e.target.value)} rows={5} placeholder="Type here..." className="resize-y" />
      </div>

      {/* Quality Areas */}
      <div className="bg-white border rounded-xl p-6">
        <SectionHeader
          title="Quality Areas"
          description="Take a look at the quality areas for OSHC and see if there are any that can be connected or strengthened with your experience. List down any areas that would gain significant benefit from this experience. How will the experience strengthen relationships between children, staff, family, and community?"
        />
        <Textarea value={form.qualityAreas} onChange={(e) => set("qualityAreas", e.target.value)} rows={5} placeholder="Type here..." className="resize-y" />
      </div>

      {/* Additional Resources */}
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

      {/* Assess and Review */}
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

      {/* Learning */}
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

      {/* Background Information */}
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

      {/* Documents */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Documents" description="Upload any supporting documents for this planning cycle." />

        {form.documents.length > 0 && (
          <ul className="space-y-2">
            {form.documents.map((doc, i) => (
              <li key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`/api/storage/objects/${doc.path.replace(/^\/objects\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm font-medium hover:underline truncate"
                >
                  {doc.name}
                </a>
                <button
                  type="button"
                  onClick={() => removeDocument(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                  aria-label="Remove document"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
          ) : (
            <><Upload className="h-4 w-4 mr-2" />Upload Documents</>
          )}
        </Button>
      </div>

      {/* Sign-off */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Sign-off" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Prepared by</Label>
            <Select value={form.preparedBy} onValueChange={(v) => set("preparedBy", v)}>
              <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not selected —</SelectItem>
                {activeStaff.map((s) => (
                  <SelectItem key={s.id} value={`${s.firstName} ${s.lastName}`}>
                    {s.firstName} {s.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Edited by</Label>
            <Select value={form.editedBy} onValueChange={(v) => set("editedBy", v)}>
              <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not selected —</SelectItem>
                {activeStaff.map((s) => (
                  <SelectItem key={s.id} value={`${s.firstName} ${s.lastName}`}>
                    {s.firstName} {s.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bottom save / delete */}
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
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
