import { useState, useEffect, useRef } from "react";
import { useParams, useSearch } from "wouter";
import {
  useGetPlanningExperience, getGetPlanningExperienceQueryKey,
  useCreatePlanningExperience,
  useUpdatePlanningExperience,
  useDeletePlanningExperience,
  useListChildren,
  useListSites,
  useListOutcomes,
  useListPlanningComments, getListPlanningCommentsQueryKey,
  useCreatePlanningComment, useDeletePlanningComment,
} from "@workspace/api-client-react";
import { useActiveStaff } from "@/hooks/use-active-staff";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Save, Trash2, Users, Upload, FileText, X, Loader2, Copy, Pencil, Link, ExternalLink, Plus, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import { StaffCommentSection } from "@/components/staff-comment-section";
import { format } from "date-fns";

const STAGE_LABELS: Record<string, string> = {
  brainstorm: "Brainstorm",
  planned: "Planned",
  assessment: "Assessment Stage",
  closed: "Closed",
};

const STAGE_COLORS: Record<string, string> = {
  brainstorm: "bg-slate-100 text-slate-700 border-slate-300",
  planned: "bg-blue-100 text-blue-700 border-blue-300",
  assessment: "bg-amber-100 text-amber-700 border-amber-300",
  closed: "bg-green-100 text-green-700 border-green-300",
};

const MTOP_OUTCOMES = [
  "Children have a strong sense of identity",
  "Children are connected with and contribute to their world",
  "Children have a strong sense of wellbeing",
  "Children are confident and involved learners",
  "Children are effective communicators",
];

type MtopEntry = { details: string; strengths: string; weaknesses: string };

type AssessmentData = {
  mtop: MtopEntry[];
  educatorReview: {
    documentedLearning: string;
    programIssues: string;
    educatorSupport: string;
    childChoices: string;
  };
  askTheChildren: {
    favouriteActivity: string;
    enjoyment: string;
    learning: string;
    improvements: string;
  };
};

const emptyAssessment = (): AssessmentData => ({
  mtop: MTOP_OUTCOMES.map(() => ({ details: "", strengths: "", weaknesses: "" })),
  educatorReview: { documentedLearning: "", programIssues: "", educatorSupport: "", childChoices: "" },
  askTheChildren: { favouriteActivity: "", enjoyment: "", learning: "", improvements: "" },
});

function mergeAssessment(raw: unknown): AssessmentData {
  const base = emptyAssessment();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.mtop)) {
    base.mtop = MTOP_OUTCOMES.map((_, i) => {
      const entry = r.mtop && (r.mtop as any)[i];
      return {
        details: entry?.details ?? "",
        strengths: entry?.strengths ?? "",
        weaknesses: entry?.weaknesses ?? "",
      };
    });
  }
  const er = r.educatorReview as Record<string, string> | undefined;
  if (er) {
    base.educatorReview = {
      documentedLearning: er.documentedLearning ?? "",
      programIssues: er.programIssues ?? "",
      educatorSupport: er.educatorSupport ?? "",
      childChoices: er.childChoices ?? "",
    };
  }
  const atc = r.askTheChildren as Record<string, string> | undefined;
  if (atc) {
    base.askTheChildren = {
      favouriteActivity: atc.favouriteActivity ?? "",
      enjoyment: atc.enjoyment ?? "",
      learning: atc.learning ?? "",
      improvements: atc.improvements ?? "",
    };
  }
  return base;
}

type DocEntry = { type: "file" | "link"; path: string; name: string };

function getDocHref(doc: DocEntry): string {
  if (doc.type === "link") return doc.path;
  const stripped = doc.path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

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
  assessmentDocuments: DocEntry[];
  assessmentData: AssessmentData;
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
  assessmentDocuments: [],
  assessmentData: emptyAssessment(),
});

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b pb-3 mb-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      {value ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">—</p>
      )}
    </div>
  );
}

function PromptTextarea({ label, prompt, value, onChange, rows = 4 }: {
  label: string; prompt: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <p className="text-xs text-muted-foreground leading-relaxed">{prompt}</p>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder="Type here..." className="resize-y" />
    </div>
  );
}

export default function PlanningDetail() {
  const params = useParams<{ id?: string }>();
  const search = useSearch();
  const isTemplateQuery = new URLSearchParams(search).get("template") === "1";
  const id = params.id && params.id !== "new" ? parseInt(params.id, 10) : null;
  const isNew = id === null;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isGuardian = user?.type === "guardian";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assessmentFileInputRef = useRef<HTMLInputElement>(null);

  const { data: experience, isLoading: loadingExp } = useGetPlanningExperience(
    id ?? 0,
    { query: { queryKey: getGetPlanningExperienceQueryKey(id ?? 0), enabled: !isNew && id !== null } }
  );
  const { data: allChildren } = useListChildren();
  const { data: sites } = useListSites();
  const { data: staffList } = useActiveStaff();

  const { uploadFile, isUploading } = useUpload({
    onError: () => toast({ title: "File upload failed", variant: "destructive" }),
  });

  const createMutation = useCreatePlanningExperience();
  const updateMutation = useUpdatePlanningExperience();
  const deleteMutation = useDeletePlanningExperience();

  const commentsQueryKey = getListPlanningCommentsQueryKey(id ?? 0);
  const { data: planComments = [] } = useListPlanningComments(id ?? 0, { query: { queryKey: commentsQueryKey, enabled: !isNew && id !== null } });
  const addPlanComment = useCreatePlanningComment();
  const removePlanComment = useDeletePlanningComment();

  const [form, setForm] = useState<FormState>(emptyForm());
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm());
  const [initialized, setInitialized] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [activeTab, setActiveTab] = useState("planning");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showAssessmentLinkForm, setShowAssessmentLinkForm] = useState(false);
  const [assessmentLinkUrl, setAssessmentLinkUrl] = useState("");
  const [assessmentLinkName, setAssessmentLinkName] = useState("");
  const { uploadFile: uploadAssessmentFile, isUploading: isAssessmentUploading } = useUpload({
    onError: () => toast({ title: "File upload failed", variant: "destructive" }),
  });

  const showAssessmentTab = form.stage === "assessment" || form.stage === "closed";

  useEffect(() => {
    if (!showAssessmentTab && activeTab === "assessment") setActiveTab("planning");
  }, [showAssessmentTab, activeTab]);

  useEffect(() => {
    if (!isNew && experience && !initialized) {
      const paths = experience.documentPaths ?? [];
      const names = experience.documentNames ?? [];
      const docs: DocEntry[] = paths.map((p, i) => ({
        type: p.startsWith("http://") || p.startsWith("https://") ? "link" : "file",
        path: p,
        name: names[i] ?? p,
      }));
      const loaded: FormState = {
        title: experience.title ?? "",
        startDate: experience.startDate ? String(experience.startDate).slice(0, 10) : "",
        siteId: experience.isTemplate ? "__template__" : (experience.siteId ? String(experience.siteId) : "none"),
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
        assessmentDocuments: (experience.assessmentDocumentPaths ?? []).map((p, i) => ({
          type: (p.startsWith("http://") || p.startsWith("https://") ? "link" : "file") as DocEntry["type"],
          path: p,
          name: (experience.assessmentDocumentNames ?? [])[i] ?? p,
        })),
        assessmentData: mergeAssessment(experience.assessmentData),
      };
      setForm(loaded);
      setSavedForm(loaded);
      setInitialized(true);
    }
    if (isNew && !initialized) {
      if (isTemplateQuery) setForm((f) => ({ ...f, siteId: "__template__" }));
      setInitialized(true);
    }
  }, [experience, isNew, initialized, isTemplateQuery]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setMtop(index: number, field: keyof MtopEntry, value: string) {
    setForm((f) => {
      const updated = f.assessmentData.mtop.map((m, i) => i === index ? { ...m, [field]: value } : m);
      return { ...f, assessmentData: { ...f.assessmentData, mtop: updated } };
    });
  }

  function setEducatorReview(field: keyof AssessmentData["educatorReview"], value: string) {
    setForm((f) => ({ ...f, assessmentData: { ...f.assessmentData, educatorReview: { ...f.assessmentData.educatorReview, [field]: value } } }));
  }

  function setAskChildren(field: keyof AssessmentData["askTheChildren"], value: string) {
    setForm((f) => ({ ...f, assessmentData: { ...f.assessmentData, askTheChildren: { ...f.assessmentData.askTheChildren, [field]: value } } }));
  }

  function toggleChild(childId: number) {
    setForm((f) => ({
      ...f,
      childIds: f.childIds.includes(childId) ? f.childIds.filter((c) => c !== childId) : [...f.childIds, childId],
    }));
  }

  function handleSiteChange(newSiteId: string) {
    setForm((f) => {
      const filtered =
        newSiteId === "__template__" || newSiteId === "none" || newSiteId === "all"
          ? []
          : f.childIds.filter((cid) => {
              const child = (allChildren ?? []).find((c) => c.id === cid);
              return child?.siteId === parseInt(newSiteId, 10);
            });
      return { ...f, siteId: newSiteId, childIds: filtered };
    });
  }

  function handleCancel() {
    setForm(savedForm);
    setIsEditing(false);
  }

  const isTemplateMode = form.siteId === "__template__";

  const visibleChildren = (allChildren ?? []).filter((c) => {
    if (c.status !== "active") return false;
    if (isTemplateMode) return false;
    if (form.siteId === "none" || form.siteId === "all") return true;
    return c.siteId === parseInt(form.siteId, 10);
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    for (const file of files) {
      const response = await uploadFile(file);
      if (response) {
        setForm((f) => ({ ...f, documents: [...f.documents, { type: "file" as const, path: response.objectPath, name: file.name }] }));
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAddLink() {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) return;
    const url = trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://") ? trimmedUrl : `https://${trimmedUrl}`;
    const name = linkName.trim() || url;
    setForm((f) => ({ ...f, documents: [...f.documents, { type: "link" as const, path: url, name }] }));
    setLinkUrl("");
    setLinkName("");
    setShowLinkForm(false);
  }

  function removeDocument(index: number) {
    setForm((f) => ({ ...f, documents: f.documents.filter((_, i) => i !== index) }));
  }

  async function handleAssessmentFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      const response = await uploadAssessmentFile(file);
      if (response) setForm((f) => ({ ...f, assessmentDocuments: [...f.assessmentDocuments, { type: "file" as const, path: response.objectPath, name: file.name }] }));
    }
    if (assessmentFileInputRef.current) assessmentFileInputRef.current.value = "";
  }

  function handleAddAssessmentLink() {
    const trimmedUrl = assessmentLinkUrl.trim();
    if (!trimmedUrl) return;
    const url = trimmedUrl.startsWith("http") ? trimmedUrl : `https://${trimmedUrl}`;
    const name = assessmentLinkName.trim() || url;
    setForm((f) => ({ ...f, assessmentDocuments: [...f.assessmentDocuments, { type: "link" as const, path: url, name }] }));
    setAssessmentLinkUrl("");
    setAssessmentLinkName("");
    setShowAssessmentLinkForm(false);
  }

  function removeAssessmentDocument(index: number) {
    setForm((f) => ({ ...f, assessmentDocuments: f.assessmentDocuments.filter((_, i) => i !== index) }));
  }

  function buildPayload() {
    const payload: Record<string, unknown> = {
      title: form.title,
      stage: form.stage,
      childIds: form.childIds,
      outcomeIds: experience?.outcomeIds ?? [],
      documentPaths: form.documents.map((d) => d.path),
      documentNames: form.documents.map((d) => d.name),
      assessmentDocumentPaths: form.assessmentDocuments.map((d) => d.path),
      assessmentDocumentNames: form.assessmentDocuments.map((d) => d.name),
      isTemplate: isTemplateMode,
      assessmentData: form.assessmentData,
    };
    if (form.startDate) payload.startDate = form.startDate;
    if (isTemplateMode || form.siteId === "none") payload.siteId = null;
    else payload.siteId = parseInt(form.siteId, 10);
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
          setSavedForm(form);
          setIsEditing(false);
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

  function handleDuplicate() {
    const payload = buildPayload();
    payload.title = `Copy of ${form.title}`;
    payload.isTemplate = false;
    createMutation.mutate({ data: payload as any }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["/api/planning"] });
        toast({ title: "Planning cycle duplicated" });
        window.location.href = `/planning/${data.id}`;
      },
      onError: () => toast({ title: "Failed to duplicate", variant: "destructive" }),
    });
  }

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

  const siteName =
    form.siteId === "__template__" ? "⭐ Template"
    : form.siteId === "none" ? "—"
    : (sites ?? []).find((s) => s.id === parseInt(form.siteId, 10))?.name ?? "—";

  const focusChildrenNames = (allChildren ?? [])
    .filter((c) => form.childIds.includes(c.id))
    .map((c) => `${c.firstName} ${c.lastName}`);

  const ad = form.assessmentData;
  const hasAssessmentContent =
    ad.mtop.some((m) => m.details || m.strengths || m.weaknesses) ||
    Object.values(ad.educatorReview).some(Boolean) ||
    Object.values(ad.askTheChildren).some(Boolean) ||
    form.assessmentDocuments.length > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Print-only header */}
      <div className="hidden print:flex items-center gap-3 pb-4 border-b border-gray-200 mb-2">
        <img src="/educare-logo.png" alt="EduCare" className="h-10 w-10 object-contain" />
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">EduCare</p>
          <p className="text-xs text-gray-400">Planning Cycle — printed {format(new Date(), "dd/MM/yyyy")}</p>
        </div>
      </div>

      {/* Top bar */}
      <div className="print:hidden flex items-center justify-between">
        <button
          onClick={() => (window.location.href = "/planning")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />Back to Planning Cycle
        </button>
        <div className="flex items-center gap-2">
          {!isNew && !isEditing && !isGuardian && (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileDown className="h-4 w-4 mr-1.5" />Export PDF
            </Button>
          )}
          {!isNew && !isEditing && (
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={createMutation.isPending}>
              <Copy className="h-4 w-4 mr-1.5" />Duplicate
            </Button>
          )}
          {!isNew && !isEditing && (
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
                    This will permanently delete "{form.title}" and all its content. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />Edit
            </Button>
          )}
          {isEditing && !isNew && (
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
          )}
          {isEditing && (
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1.5" />{isSaving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* Main content + side comments panel */}
      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-6">
          {/* Tabs — shown when stage is assessment or closed */}
          {showAssessmentTab ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="print:hidden">
                <TabsTrigger value="planning">Planning Cycle</TabsTrigger>
                <TabsTrigger value="assessment">Assessment</TabsTrigger>
              </TabsList>

              <TabsContent value="planning" className="space-y-6 mt-0 print:!block">
                {isEditing ? <PlanningEditContent {...{ form, set, sites, allChildren, visibleChildren, isTemplateMode, handleSiteChange, toggleChild, fileInputRef, handleFileSelect, removeDocument, isUploading, activeStaff, showLinkForm, setShowLinkForm, linkUrl, setLinkUrl, linkName, setLinkName, handleAddLink }} />
                  : <PlanningViewContent {...{ form, siteName, focusChildrenNames }} />}
                {isEditing && (
                  <div className="print:hidden flex justify-end gap-3">
                    {!isNew && <Button variant="outline" onClick={handleCancel} disabled={isSaving}>Cancel</Button>}
                    <Button onClick={handleSave} disabled={isSaving} size="lg">
                      <Save className="h-4 w-4 mr-1.5" />{isSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assessment" className="space-y-6 mt-0 print:!block">
                {isEditing ? (
                  <AssessmentEditContent ad={ad} setMtop={setMtop} setEducatorReview={setEducatorReview} setAskChildren={setAskChildren} assessmentDocuments={form.assessmentDocuments} assessmentFileInputRef={assessmentFileInputRef} handleAssessmentFileSelect={handleAssessmentFileSelect} removeAssessmentDocument={removeAssessmentDocument} isAssessmentUploading={isAssessmentUploading} showAssessmentLinkForm={showAssessmentLinkForm} setShowAssessmentLinkForm={setShowAssessmentLinkForm} assessmentLinkUrl={assessmentLinkUrl} setAssessmentLinkUrl={setAssessmentLinkUrl} assessmentLinkName={assessmentLinkName} setAssessmentLinkName={setAssessmentLinkName} handleAddAssessmentLink={handleAddAssessmentLink} />
                ) : (
                  <AssessmentViewContent ad={ad} hasContent={hasAssessmentContent} assessmentDocuments={form.assessmentDocuments} />
                )}
                {isEditing && (
                  <div className="print:hidden flex justify-end gap-3">
                    {!isNew && <Button variant="outline" onClick={handleCancel} disabled={isSaving}>Cancel</Button>}
                    <Button onClick={handleSave} disabled={isSaving} size="lg">
                      <Save className="h-4 w-4 mr-1.5" />{isSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-6">
              {isEditing ? <PlanningEditContent {...{ form, set, sites, allChildren, visibleChildren, isTemplateMode, handleSiteChange, toggleChild, fileInputRef, handleFileSelect, removeDocument, isUploading, activeStaff, showLinkForm, setShowLinkForm, linkUrl, setLinkUrl, linkName, setLinkName, handleAddLink }} />
                : <PlanningViewContent {...{ form, siteName, focusChildrenNames }} />}
              {isEditing && (
                <div className="print:hidden flex justify-end gap-3">
                  {!isNew && <Button variant="outline" onClick={handleCancel} disabled={isSaving}>Cancel</Button>}
                  <Button onClick={handleSave} disabled={isSaving} size="lg">
                    <Save className="h-4 w-4 mr-1.5" />{isSaving ? "Saving…" : "Save"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comments side panel */}
        {!isNew && (
          <div className="w-72 shrink-0 print:hidden sticky top-6">
            <StaffCommentSection
              comments={planComments}
              queryKey={commentsQueryKey}
              onAdd={(body) => new Promise((resolve, reject) =>
                addPlanComment.mutate({ id: id!, data: { body } }, {
                  onSuccess: () => { queryClient.invalidateQueries({ queryKey: commentsQueryKey }); resolve(); },
                  onError: reject,
                })
              )}
              onDelete={(commentId) => new Promise((resolve, reject) =>
                removePlanComment.mutate({ id: id!, commentId }, {
                  onSuccess: () => { queryClient.invalidateQueries({ queryKey: commentsQueryKey }); resolve(); },
                  onError: reject,
                })
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Planning tab: edit ────────────────────────────────────────────────────────

function PlanningEditContent({ form, set, sites, allChildren, visibleChildren, isTemplateMode, handleSiteChange, toggleChild, fileInputRef, handleFileSelect, removeDocument, isUploading, activeStaff, showLinkForm, setShowLinkForm, linkUrl, setLinkUrl, linkName, setLinkName, handleAddLink }: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  sites: any[] | undefined;
  allChildren: any[] | undefined;
  visibleChildren: any[];
  isTemplateMode: boolean;
  handleSiteChange: (v: string) => void;
  toggleChild: (id: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeDocument: (i: number) => void;
  isUploading: boolean;
  activeStaff: any[];
  showLinkForm: boolean;
  setShowLinkForm: (v: boolean) => void;
  linkUrl: string;
  setLinkUrl: (v: string) => void;
  linkName: string;
  setLinkName: (v: string) => void;
  handleAddLink: () => void;
}) {
  const frameworkLinksRef = useRef<HTMLTextAreaElement>(null);
  const savedCursorPos = useRef<{ start: number; end: number } | null>(null);
  const [showMtopPicker, setShowMtopPicker] = useState(false);
  const { data: outcomes } = useListOutcomes();

  function openMtopPicker() {
    const ta = frameworkLinksRef.current;
    if (ta) savedCursorPos.current = { start: ta.selectionStart, end: ta.selectionEnd };
    setShowMtopPicker(true);
  }

  function insertMtopCode(code: string) {
    const pos = savedCursorPos.current;
    const text = form.frameworkLinks;
    const start = pos?.start ?? text.length;
    const end = pos?.end ?? start;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const sep = before.length > 0 && !before.endsWith(" ") ? " " : "";
    const newVal = before + sep + code + " " + after;
    set("frameworkLinks", newVal);
    const newPos = start + sep.length + code.length + 1;
    savedCursorPos.current = { start: newPos, end: newPos };
  }

  return (
    <>
      <div className="bg-white border rounded-xl p-6 space-y-6">
        <SectionHeader title="Planning Cycle" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Experience Title <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Enter a title for this experience" />
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
                <SelectItem value="__template__">⭐ Templates</SelectItem>
                <SelectItem value="none">No location</SelectItem>
                {(sites ?? []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isTemplateMode && <p className="text-xs text-amber-600">This is a template — duplicate to create a site-specific copy.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Users className="h-4 w-4" />Focus Children</Label>
          <p className="text-xs text-muted-foreground">
            {isTemplateMode ? "Templates don't have focus children." : form.siteId === "none" ? "Select a location above to filter children by site." : "Showing active children enrolled at the selected location."}
          </p>
          {!isTemplateMode && visibleChildren.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{form.siteId === "none" ? "No active children enrolled yet." : "No active children at this location."}</p>
          ) : !isTemplateMode && (
            <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
              {visibleChildren.map((child: any) => {
                const selected = form.childIds.includes(child.id);
                return (
                  <button key={child.id} type="button" onClick={() => toggleChild(child.id)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
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
        <PromptTextarea label="Where did the theme come from?" prompt="Where did the theme for the experience come from? What could be accomplished with this theme? Who was involved in generating ideas?" value={form.collaborateExplore} onChange={(v) => set("collaborateExplore", v)} rows={5} />
        <PromptTextarea label="Identify Skills" prompt="What skills do staff and children have to support the experience? Will information need to be researched or will additional support need to be sourced for the experience?" value={form.identifySkills} onChange={(v) => set("identifySkills", v)} rows={5} />
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Research Ideas" />
        <p className="text-xs text-muted-foreground leading-relaxed">Begin formulating a plan that includes activities, games, resources, and opportunities that would help support the experience for the focus child.</p>
        <Textarea value={form.researchIdeas} onChange={(e) => set("researchIdeas", e.target.value)} rows={6} placeholder="Type here..." className="resize-y" />
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Framework Links" />
        <p className="text-xs text-muted-foreground leading-relaxed">Take a look at documents such as the National Quality Standards, My Time Our Place and the outcomes for school aged children and match elements with the activities you have planned.</p>
        <Textarea
          ref={frameworkLinksRef}
          value={form.frameworkLinks}
          onChange={(e) => set("frameworkLinks", e.target.value)}
          rows={5}
          placeholder="Type here…"
          className="resize-y"
        />
        <div>
          <Button type="button" variant="outline" size="sm" onClick={openMtopPicker}>
            <Plus className="h-4 w-4 mr-1.5" />Add MTOP Link
          </Button>
        </div>

        <Dialog open={showMtopPicker} onOpenChange={setShowMtopPicker}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>MTOP Outcome Links</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-1">Click any sub-outcome to insert its code into your framework links text.</p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {(outcomes ?? []).map((outcome) => (
                <div key={outcome.id} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    {outcome.number}. {outcome.title}
                  </p>
                  <div className="flex flex-col gap-1.5 pl-3">
                    {outcome.subOutcomes.map((sub, idx) => {
                      const code = `${outcome.number}.${idx + 1}`;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => { insertMtopCode(code); setShowMtopPicker(false); }}
                          className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-colors group"
                        >
                          <span className="shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground min-w-[2rem]">
                            {code}
                          </span>
                          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Quality Areas" />
        <p className="text-xs text-muted-foreground leading-relaxed">Take a look at the quality areas for OSHC and see if there are any that can be connected or strengthened with your experience.</p>
        <Textarea value={form.qualityAreas} onChange={(e) => set("qualityAreas", e.target.value)} rows={5} placeholder="Type here..." className="resize-y" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <SectionHeader title="Additional Resources" />
          <p className="text-xs text-muted-foreground leading-relaxed">Can you list any additional resources needed for this experience?</p>
          <Textarea value={form.additionalResources} onChange={(e) => set("additionalResources", e.target.value)} rows={4} placeholder="Type here..." className="resize-y" />
        </div>
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <SectionHeader title="Assess and Review" />
          <p className="text-xs text-muted-foreground leading-relaxed">How will this experience be assessed and reviewed? Who will take part in the review?</p>
          <Textarea value={form.assessAndReview} onChange={(e) => set("assessAndReview", e.target.value)} rows={4} placeholder="Type here..." className="resize-y" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <SectionHeader title="Learning" />
          <p className="text-xs text-muted-foreground leading-relaxed">How will the content be delivered in the learning environment? Will there need to be different strategies for different children or experiences?</p>
          <Textarea value={form.learning} onChange={(e) => set("learning", e.target.value)} rows={5} placeholder="Type here..." className="resize-y" />
        </div>
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <SectionHeader title="Background Information" />
          <p className="text-xs text-muted-foreground leading-relaxed">What background information is needed for educators or children?</p>
          <Textarea value={form.backgroundInformation} onChange={(e) => set("backgroundInformation", e.target.value)} rows={5} placeholder="Type here..." className="resize-y" />
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Documents & Links" />
        {form.documents.length > 0 && (
          <ul className="space-y-2">
            {form.documents.map((doc, i) => (
              <li key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                {doc.type === "link"
                  ? <Link className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                <a href={getDocHref(doc)} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-medium hover:underline truncate">{doc.name}</a>
                <button type="button" onClick={() => removeDocument(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" aria-label="Remove"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {showLinkForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Add web link</p>
            <div className="space-y-2">
              <Input
                placeholder="URL (e.g. https://example.com)"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLink(); } }}
                autoFocus
              />
              <Input
                placeholder="Display name (optional — defaults to URL)"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLink(); } }}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleAddLink} disabled={!linkUrl.trim()}>
                <Plus className="h-4 w-4 mr-1.5" />Add Link
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setShowLinkForm(false); setLinkUrl(""); setLinkName(""); }}>Cancel</Button>
            </div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : <><Upload className="h-4 w-4 mr-2" />Upload File</>}
          </Button>
          {!showLinkForm && (
            <Button type="button" variant="outline" onClick={() => setShowLinkForm(true)}>
              <Link className="h-4 w-4 mr-2" />Add Link
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Sign-off" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Prepared by</Label>
            <Select value={form.preparedBy} onValueChange={(v) => set("preparedBy", v)}>
              <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not selected —</SelectItem>
                {activeStaff.map((s: any) => <SelectItem key={s.id} value={`${s.firstName} ${s.lastName}`}>{s.firstName} {s.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Edited by</Label>
            <Select value={form.editedBy} onValueChange={(v) => set("editedBy", v)}>
              <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Not selected —</SelectItem>
                {activeStaff.map((s: any) => <SelectItem key={s.id} value={`${s.firstName} ${s.lastName}`}>{s.firstName} {s.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderWithMtopBadges(text: string) {
  // Split on MTOP codes like 1.1, 2.3, 4.2 and render them as inline badges
  const parts = text.split(/(\d+\.\d+)/g);
  return (
    <span className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) =>
        /^\d+\.\d+$/.test(part) ? (
          <span
            key={i}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground mx-0.5 align-middle"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── Planning tab: view ────────────────────────────────────────────────────────

function PlanningViewContent({ form, siteName, focusChildrenNames }: { form: FormState; siteName: string; focusChildrenNames: string[] }) {
  return (
    <>
      <div className="bg-white border rounded-xl p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STAGE_COLORS[form.stage] ?? STAGE_COLORS.brainstorm}`}>
              {STAGE_LABELS[form.stage] ?? form.stage}
            </span>
            {form.siteId === "__template__" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-yellow-50 text-yellow-700 border-yellow-300">⭐ Template</span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{form.title || "Untitled"}</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <ViewField label="Commencement Date" value={form.startDate ? format(new Date(form.startDate), "dd/MM/yyyy") : null} />
          <ViewField label="Location" value={siteName} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Focus Children</p>
            {focusChildrenNames.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {focusChildrenNames.map((name) => (
                  <span key={name} className="px-2.5 py-0.5 rounded-full text-xs border bg-muted text-muted-foreground">{name}</span>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground italic">—</p>}
          </div>
        </div>
      </div>

      {(form.collaborateExplore || form.identifySkills) && (
        <div className="bg-white border rounded-xl p-6 space-y-5">
          <SectionHeader title="Collaborate / Explore Options" />
          {form.collaborateExplore && <ViewField label="Where did the theme come from?" value={form.collaborateExplore} />}
          {form.identifySkills && <ViewField label="Identify Skills" value={form.identifySkills} />}
        </div>
      )}
      {form.researchIdeas && <div className="bg-white border rounded-xl p-6 space-y-3"><SectionHeader title="Research Ideas" /><ViewField label="" value={form.researchIdeas} /></div>}
      {form.frameworkLinks && (
        <div className="bg-white border rounded-xl p-6 space-y-3">
          <SectionHeader title="Framework Links" />
          <div>{renderWithMtopBadges(form.frameworkLinks)}</div>
        </div>
      )}
      {form.qualityAreas && <div className="bg-white border rounded-xl p-6 space-y-3"><SectionHeader title="Quality Areas" /><ViewField label="" value={form.qualityAreas} /></div>}
      {(form.additionalResources || form.assessAndReview) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.additionalResources && <div className="bg-white border rounded-xl p-6 space-y-3"><SectionHeader title="Additional Resources" /><ViewField label="" value={form.additionalResources} /></div>}
          {form.assessAndReview && <div className="bg-white border rounded-xl p-6 space-y-3"><SectionHeader title="Assess and Review" /><ViewField label="" value={form.assessAndReview} /></div>}
        </div>
      )}
      {(form.learning || form.backgroundInformation) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.learning && <div className="bg-white border rounded-xl p-6 space-y-3"><SectionHeader title="Learning" /><ViewField label="" value={form.learning} /></div>}
          {form.backgroundInformation && <div className="bg-white border rounded-xl p-6 space-y-3"><SectionHeader title="Background Information" /><ViewField label="" value={form.backgroundInformation} /></div>}
        </div>
      )}

      {form.documents.length > 0 && (
        <div className="bg-white border rounded-xl p-6 space-y-3">
          <SectionHeader title="Documents & Links" />
          <ul className="space-y-2">
            {form.documents.map((doc, i) => (
              <li key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                {doc.type === "link"
                  ? <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                <a href={getDocHref(doc)} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-medium hover:underline truncate">{doc.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(form.preparedBy !== "none" || form.editedBy !== "none") && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <SectionHeader title="Sign-off" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ViewField label="Prepared by" value={form.preparedBy !== "none" ? form.preparedBy : null} />
            <ViewField label="Edited by" value={form.editedBy !== "none" ? form.editedBy : null} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Assessment tab: edit ──────────────────────────────────────────────────────

function AssessmentEditContent({ ad, setMtop, setEducatorReview, setAskChildren, assessmentDocuments, assessmentFileInputRef, handleAssessmentFileSelect, removeAssessmentDocument, isAssessmentUploading, showAssessmentLinkForm, setShowAssessmentLinkForm, assessmentLinkUrl, setAssessmentLinkUrl, assessmentLinkName, setAssessmentLinkName, handleAddAssessmentLink }: {
  ad: AssessmentData;
  setMtop: (i: number, f: keyof MtopEntry, v: string) => void;
  setEducatorReview: (f: keyof AssessmentData["educatorReview"], v: string) => void;
  setAskChildren: (f: keyof AssessmentData["askTheChildren"], v: string) => void;
  assessmentDocuments: DocEntry[];
  assessmentFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleAssessmentFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeAssessmentDocument: (i: number) => void;
  isAssessmentUploading: boolean;
  showAssessmentLinkForm: boolean;
  setShowAssessmentLinkForm: (v: boolean) => void;
  assessmentLinkUrl: string;
  setAssessmentLinkUrl: (v: string) => void;
  assessmentLinkName: string;
  setAssessmentLinkName: (v: string) => void;
  handleAddAssessmentLink: () => void;
}) {
  return (
    <>
      {/* MTOP Elements table */}
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <SectionHeader title="MTOP Framework Assessment" />
        <div className="space-y-6">
          {MTOP_OUTCOMES.map((outcome, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">{i + 1}. {outcome}</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Details</Label>
                  <Textarea value={ad.mtop[i].details} onChange={(e) => setMtop(i, "details", e.target.value)} rows={3} placeholder="Details about this outcome…" className="resize-y" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Strengths</Label>
                    <Textarea value={ad.mtop[i].strengths} onChange={(e) => setMtop(i, "strengths", e.target.value)} rows={3} placeholder="Strengths observed…" className="resize-y" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Weaknesses</Label>
                    <Textarea value={ad.mtop[i].weaknesses} onChange={(e) => setMtop(i, "weaknesses", e.target.value)} rows={3} placeholder="Areas for improvement…" className="resize-y" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Educator Review */}
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <SectionHeader title="Educator Review" />
        <PromptTextarea
          label="Documented Learning"
          prompt="What documented learning did you accomplish in the program? What family feedback has been gathered (if any)?"
          value={ad.educatorReview.documentedLearning}
          onChange={(v) => setEducatorReview("documentedLearning", v)}
          rows={4}
        />
        <PromptTextarea
          label="Program Issues"
          prompt="What are the issues affecting your program this week?"
          value={ad.educatorReview.programIssues}
          onChange={(v) => setEducatorReview("programIssues", v)}
          rows={4}
        />
        <PromptTextarea
          label="Educator Support"
          prompt="How did educators support the needs of children in the program? How might you do things differently?"
          value={ad.educatorReview.educatorSupport}
          onChange={(v) => setEducatorReview("educatorSupport", v)}
          rows={4}
        />
        <PromptTextarea
          label="Child Choices & Further Enquiry"
          prompt="How were children able to make choices and decisions and influence? What items require further enquiry?"
          value={ad.educatorReview.childChoices}
          onChange={(v) => setEducatorReview("childChoices", v)}
          rows={4}
        />
      </div>

      {/* Ask the Children */}
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <SectionHeader title="Ask the Children" />
        <PromptTextarea
          label="Favourite Activity"
          prompt="What was your favourite activity?"
          value={ad.askTheChildren.favouriteActivity}
          onChange={(v) => setAskChildren("favouriteActivity", v)}
          rows={3}
        />
        <PromptTextarea
          label="Enjoyment"
          prompt="What did you / didn't you enjoy? Why? Did you play each activity? What did you play outside?"
          value={ad.askTheChildren.enjoyment}
          onChange={(v) => setAskChildren("enjoyment", v)}
          rows={4}
        />
        <PromptTextarea
          label="Learning"
          prompt="What did you learn?"
          value={ad.askTheChildren.learning}
          onChange={(v) => setAskChildren("learning", v)}
          rows={3}
        />
        <PromptTextarea
          label="Ideas & Improvements"
          prompt="Ideas, improvements or changes?"
          value={ad.askTheChildren.improvements}
          onChange={(v) => setAskChildren("improvements", v)}
          rows={3}
        />
      </div>

      {/* Documents & Links */}
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <SectionHeader title="Documents & Links" />
        {assessmentDocuments.length > 0 && (
          <ul className="space-y-2">
            {assessmentDocuments.map((doc, i) => (
              <li key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                {doc.type === "link"
                  ? <Link className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                <a href={getDocHref(doc)} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-medium hover:underline truncate">{doc.name}</a>
                <button type="button" onClick={() => removeAssessmentDocument(i)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded" aria-label="Remove"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {showAssessmentLinkForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Add web link</p>
            <div className="space-y-2">
              <Input
                placeholder="URL (e.g. https://example.com)"
                value={assessmentLinkUrl}
                onChange={(e) => setAssessmentLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAssessmentLink(); } }}
                autoFocus
              />
              <Input
                placeholder="Display name (optional — defaults to URL)"
                value={assessmentLinkName}
                onChange={(e) => setAssessmentLinkName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAssessmentLink(); } }}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleAddAssessmentLink} disabled={!assessmentLinkUrl.trim()}>
                <Plus className="h-4 w-4 mr-1.5" />Add Link
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setShowAssessmentLinkForm(false); setAssessmentLinkUrl(""); setAssessmentLinkName(""); }}>Cancel</Button>
            </div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <input ref={assessmentFileInputRef} type="file" multiple className="hidden" onChange={handleAssessmentFileSelect} />
          <Button type="button" variant="outline" onClick={() => assessmentFileInputRef.current?.click()} disabled={isAssessmentUploading}>
            {isAssessmentUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : <><Upload className="h-4 w-4 mr-2" />Upload File</>}
          </Button>
          {!showAssessmentLinkForm && (
            <Button type="button" variant="outline" onClick={() => setShowAssessmentLinkForm(true)}>
              <Link className="h-4 w-4 mr-2" />Add Link
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Assessment tab: view ──────────────────────────────────────────────────────

function AssessmentViewContent({ ad, hasContent, assessmentDocuments }: { ad: AssessmentData; hasContent: boolean; assessmentDocuments: DocEntry[] }) {
  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No assessment data recorded yet.</p>
        <p className="text-muted-foreground text-xs mt-1">Click Edit to complete the assessment.</p>
      </div>
    );
  }

  const anyMtop = ad.mtop.some((m) => m.details || m.strengths || m.weaknesses);
  const anyEdu = Object.values(ad.educatorReview).some(Boolean);
  const anyAtc = Object.values(ad.askTheChildren).some(Boolean);

  return (
    <>
      {anyMtop && (
        <div className="bg-white border rounded-xl p-6 space-y-5">
          <SectionHeader title="MTOP Framework Assessment" />
          <div className="space-y-4">
            {MTOP_OUTCOMES.map((outcome, i) => {
              const m = ad.mtop[i];
              if (!m.details && !m.strengths && !m.weaknesses) return null;
              return (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold">{i + 1}. {outcome}</p>
                  {m.details && <ViewField label="Details" value={m.details} />}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {m.strengths && <ViewField label="Strengths" value={m.strengths} />}
                    {m.weaknesses && <ViewField label="Weaknesses" value={m.weaknesses} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {anyEdu && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <SectionHeader title="Educator Review" />
          {ad.educatorReview.documentedLearning && <ViewField label="Documented Learning" value={ad.educatorReview.documentedLearning} />}
          {ad.educatorReview.programIssues && <ViewField label="Program Issues" value={ad.educatorReview.programIssues} />}
          {ad.educatorReview.educatorSupport && <ViewField label="Educator Support" value={ad.educatorReview.educatorSupport} />}
          {ad.educatorReview.childChoices && <ViewField label="Child Choices & Further Enquiry" value={ad.educatorReview.childChoices} />}
        </div>
      )}

      {anyAtc && (
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <SectionHeader title="Ask the Children" />
          {ad.askTheChildren.favouriteActivity && <ViewField label="Favourite Activity" value={ad.askTheChildren.favouriteActivity} />}
          {ad.askTheChildren.enjoyment && <ViewField label="Enjoyment" value={ad.askTheChildren.enjoyment} />}
          {ad.askTheChildren.learning && <ViewField label="Learning" value={ad.askTheChildren.learning} />}
          {ad.askTheChildren.improvements && <ViewField label="Ideas & Improvements" value={ad.askTheChildren.improvements} />}
        </div>
      )}

      {assessmentDocuments.length > 0 && (
        <div className="bg-white border rounded-xl p-6 space-y-3">
          <SectionHeader title="Documents & Links" />
          <ul className="space-y-2">
            {assessmentDocuments.map((doc, i) => (
              <li key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                {doc.type === "link"
                  ? <Link className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                <a href={getDocHref(doc)} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-medium hover:underline truncate">{doc.name}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
