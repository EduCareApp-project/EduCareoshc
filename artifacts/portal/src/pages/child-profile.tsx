import { useState } from "react";
import {
  useGetChild, useUpdateChild, useDeleteChild,
  useGetChildObservations, useListSites,
  useGetChildWelfareNotes, useCreateWelfareNote, useUpdateWelfareNote, useDeleteWelfareNote,
  useGetChildConfidentialNotes, useCreateConfidentialNote, useUpdateConfidentialNote, useDeleteConfidentialNote,
  useListStaff, useListJottings, useListPlanningExperiences, useListPosts,
  useListChildDocuments, useCreateChildDocument, useDeleteChildDocument,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { format, differenceInYears, differenceInMonths } from "date-fns";
import {
  ArrowLeft, Edit, Plus, Trash2, User, Users, Phone, Mail, FileText,
  Calendar, Heart, ThumbsDown, Smile, BookOpen, Building2,
  ShieldAlert, AlertTriangle, Paperclip, X, Lock, Pencil, StickyNote, Newspaper,
  Upload, FolderOpen,
} from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { useToast } from "@/hooks/use-toast";

const AGE_GROUP_LABELS: Record<string, string> = { infant: "Infant", toddler: "Toddler", preschool: "Preschool", school_age: "School Age" };

function safeDate(value: string, fmt: string) {
  try {
    const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return value;
    return format(d, fmt);
  } catch {
    return value;
  }
}

const EMPTY_WELFARE_FORM = {
  occurredAt: new Date().toISOString().slice(0, 16),
  staffId: "",
  concerns: "",
  riskFactors: "",
  mandatoryReportRequired: false,
  mandatoryReportNotes: "",
  cissThresholdMet: false,
  cissNotes: "",
  fvissThresholdMet: false,
  fvissNotes: "",
  confidentialNotes: "",
};

export default function ChildProfile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [, navigate] = useLocation();

  const { data: child, isLoading } = useGetChild(id, { query: { enabled: !!id } });
  const { data: observations, isLoading: obsLoading } = useGetChildObservations(id, { query: { enabled: !!id } });
  const { data: sites } = useListSites();
  const { data: staff } = useListStaff();
  const { data: welfareNotes, isLoading: welfareLoading } = useGetChildWelfareNotes(id, { query: { enabled: !!id } });
  const { data: confidentialNotes, isLoading: confidentialLoading } = useGetChildConfidentialNotes(id, { query: { enabled: !!id } });
  const { data: allJottings } = useListJottings({ includeArchived: true });
  const { data: allPlanningExperiences } = useListPlanningExperiences();
  const { data: allPosts } = useListPosts();
  const updateMutation = useUpdateChild();
  const deleteMutation = useDeleteChild();
  const createWelfareMutation = useCreateWelfareNote();
  const updateWelfareMutation = useUpdateWelfareNote();
  const deleteWelfareMutation = useDeleteWelfareNote();
  const createConfidentialMutation = useCreateConfidentialNote();
  const updateConfidentialMutation = useUpdateConfidentialNote();
  const deleteConfidentialMutation = useDeleteConfidentialNote();

  const [editOpen, setEditOpen] = useState(false);
  const [welfareOpen, setWelfareOpen] = useState(false);
  const [welfareForm, setWelfareForm] = useState(EMPTY_WELFARE_FORM);
  const [editingWelfareNoteId, setEditingWelfareNoteId] = useState<number | null>(null);

  const [confNoteText, setConfNoteText] = useState("");
  const [confNoteStaffId, setConfNoteStaffId] = useState("");
  const [confAddOpen, setConfAddOpen] = useState(false);
  const [editingConfNote, setEditingConfNote] = useState<{ id: number; content: string } | null>(null);
  const [evidenceObjectPath, setEvidenceObjectPath] = useState<string | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState<string | null>(null);

  const { uploadFile, isUploading: isUploadingEvidence } = useUpload({
    onError: () => toast({ title: "File upload failed", variant: "destructive" }),
  });

  const { data: childDocuments, isLoading: docsLoading } = useListChildDocuments(id, { query: { enabled: !!id } });
  const createDocMutation = useCreateChildDocument();
  const deleteDocMutation = useDeleteChildDocument();
  const { uploadFile: uploadDoc, isUploading: isUploadingDoc } = useUpload({
    onError: () => toast({ title: "Document upload failed", variant: "destructive" }),
  });

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadDoc(file);
    if (!result) return;
    createDocMutation.mutate(
      { id, data: { documentPath: result.objectPath, documentName: file.name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/documents`] });
          toast({ title: "Document uploaded" });
        },
        onError: () => toast({ title: "Failed to save document", variant: "destructive" }),
      }
    );
    e.target.value = "";
  }

  function handleDocDelete(docId: number, docName: string | null) {
    if (!confirm(`Delete "${docName ?? "this document"}"?`)) return;
    deleteDocMutation.mutate(
      { id, docId },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/documents`] }),
        onError: () => toast({ title: "Failed to delete document", variant: "destructive" }),
      }
    );
  }

  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", enrollmentDate: "",
    ageGroup: "", status: "", guardianName: "", guardianEmail: "", guardianPhone: "",
    medicalNotes: "", likes: "", dislikes: "", temperament: "", background: "",
    siteId: "" as string,
  });

  function openEdit() {
    if (!child) return;
    setForm({
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth,
      enrollmentDate: child.enrollmentDate,
      ageGroup: child.ageGroup,
      status: child.status,
      guardianName: child.guardianName,
      guardianEmail: child.guardianEmail,
      guardianPhone: child.guardianPhone,
      medicalNotes: child.medicalNotes ?? "",
      likes: child.likes ?? "",
      dislikes: child.dislikes ?? "",
      temperament: child.temperament ?? "",
      background: child.background ?? "",
      siteId: child.siteId != null ? String(child.siteId) : "",
    });
    setEditOpen(true);
  }

  function handleDelete() {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/children"] });
        toast({ title: "Profile deleted" });
        navigate("/children");
      },
      onError: () => toast({ title: "Failed to delete profile", variant: "destructive" }),
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { ...form };
    if (!data.medicalNotes) delete data.medicalNotes;
    if (!data.likes) delete data.likes;
    if (!data.dislikes) delete data.dislikes;
    if (!data.temperament) delete data.temperament;
    if (!data.background) delete data.background;
    data.siteId = form.siteId ? parseInt(form.siteId) : null;
    updateMutation.mutate({ id, data: data as any }, {
      onSuccess: () => {
        setEditOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}`] });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ title: "Failed to save changes", variant: "destructive" }),
    });
  }

  function buildWelfareBody() {
    const body: Record<string, unknown> = {
      childId: id,
      occurredAt: new Date(welfareForm.occurredAt).toISOString(),
      concerns: welfareForm.concerns,
      riskFactors: welfareForm.riskFactors,
      mandatoryReportRequired: welfareForm.mandatoryReportRequired,
      cissThresholdMet: welfareForm.cissThresholdMet,
      fvissThresholdMet: welfareForm.fvissThresholdMet,
    };
    if (welfareForm.staffId) body.staffId = parseInt(welfareForm.staffId);
    if (evidenceObjectPath) body.evidence = evidenceObjectPath;
    if (welfareForm.mandatoryReportNotes) body.mandatoryReportNotes = welfareForm.mandatoryReportNotes;
    if (welfareForm.cissNotes) body.cissNotes = welfareForm.cissNotes;
    if (welfareForm.fvissNotes) body.fvissNotes = welfareForm.fvissNotes;
    if (welfareForm.confidentialNotes) body.confidentialNotes = welfareForm.confidentialNotes;
    return body;
  }

  function closeWelfareDialog() {
    setWelfareOpen(false);
    setWelfareForm(EMPTY_WELFARE_FORM);
    setEvidenceObjectPath(null);
    setEvidenceFileName(null);
    setEditingWelfareNoteId(null);
  }

  function handleWelfareNoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = buildWelfareBody();

    if (editingWelfareNoteId !== null) {
      updateWelfareMutation.mutate({ id: editingWelfareNoteId, data: body as any }, {
        onSuccess: () => {
          closeWelfareDialog();
          queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/welfare-notes`] });
          toast({ title: "Welfare note updated" });
        },
        onError: () => toast({ title: "Failed to update welfare note", variant: "destructive" }),
      });
    } else {
      createWelfareMutation.mutate({ data: body as any }, {
        onSuccess: () => {
          closeWelfareDialog();
          queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/welfare-notes`] });
          toast({ title: "Welfare note recorded" });
        },
        onError: () => toast({ title: "Failed to save welfare note", variant: "destructive" }),
      });
    }
  }

  function openEditWelfareNote(note: NonNullable<typeof welfareNotes>[number]) {
    setWelfareForm({
      occurredAt: note.occurredAt.slice(0, 16),
      staffId: note.staffId != null ? String(note.staffId) : "",
      concerns: note.concerns,
      riskFactors: note.riskFactors,
      mandatoryReportRequired: note.mandatoryReportRequired,
      mandatoryReportNotes: note.mandatoryReportNotes ?? "",
      cissThresholdMet: note.cissThresholdMet,
      cissNotes: note.cissNotes ?? "",
      fvissThresholdMet: note.fvissThresholdMet,
      fvissNotes: note.fvissNotes ?? "",
      confidentialNotes: note.confidentialNotes ?? "",
    });
    setEvidenceObjectPath(note.evidence ?? null);
    setEvidenceFileName(note.evidence ? note.evidence.split("/").pop() ?? null : null);
    setEditingWelfareNoteId(note.id);
    setWelfareOpen(true);
  }

  function handleDeleteWelfareNote(noteId: number) {
    deleteWelfareMutation.mutate({ id: noteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/welfare-notes`] });
        toast({ title: "Welfare note deleted" });
      },
      onError: () => toast({ title: "Failed to delete welfare note", variant: "destructive" }),
    });
  }

  function handleCreateConfidentialNote(e: React.FormEvent) {
    e.preventDefault();
    if (!confNoteText.trim()) return;
    const body: Record<string, unknown> = { childId: id, content: confNoteText.trim() };
    if (confNoteStaffId) body.staffId = parseInt(confNoteStaffId);
    createConfidentialMutation.mutate({ data: body as any }, {
      onSuccess: () => {
        setConfAddOpen(false);
        setConfNoteText("");
        setConfNoteStaffId("");
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/confidential-notes`] });
        toast({ title: "Confidential note added" });
      },
      onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
    });
  }

  function handleUpdateConfidentialNote(e: React.FormEvent) {
    e.preventDefault();
    if (!editingConfNote || !editingConfNote.content.trim()) return;
    updateConfidentialMutation.mutate({ id: editingConfNote.id, data: { childId: id, content: editingConfNote.content.trim() } as any }, {
      onSuccess: () => {
        setEditingConfNote(null);
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/confidential-notes`] });
        toast({ title: "Note updated" });
      },
      onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
    });
  }

  function handleDeleteConfidentialNote(noteId: number) {
    deleteConfidentialMutation.mutate({ id: noteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/children/${id}/confidential-notes`] });
        toast({ title: "Note deleted" });
      },
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!child) {
    return <div>Child not found</div>;
  }

  const hasProfileInfo = child.likes || child.dislikes || child.temperament || child.background;
  const assignedSite = sites?.find((s) => s.id === child.siteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/children">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
              {child.firstName[0]}{child.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-none">{child.firstName} {child.lastName}</h1>
              <div className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                <Badge variant={child.status === "active" ? "default" : "secondary"} className="capitalize">{child.status}</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={openEdit}>
              <Edit className="h-4 w-4 mr-2" />Edit Profile
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:bg-destructive/10 border-destructive/30">
                  <Trash2 className="h-4 w-4 mr-2" />Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {child.firstName} {child.lastName}'s profile?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the child's profile and all associated data including observations. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete Profile"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="childdata">Child's Data</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {assignedSite && (
                <>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Site</div>
                    <p className="font-medium">{assignedSite.name}</p>
                  </div>
                  <Separator />
                </>
              )}
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Age</div>
                <p className="font-medium">{(() => {
                  const dob = child.dateOfBirth;
                  const birth = new Date(String(dob).length === 10 ? dob + "T00:00:00" : dob);
                  const now = new Date();
                  const years = differenceInYears(now, birth);
                  if (years < 1) {
                    const months = differenceInMonths(now, birth);
                    return `${months} month${months !== 1 ? "s" : ""}`;
                  }
                  return `${years} year${years !== 1 ? "s" : ""}`;
                })()}</p>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Date of Birth</div>
                <p className="font-medium">{safeDate(child.dateOfBirth, "MMMM d, yyyy")}</p>
              </div>
              <Separator />
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><User className="h-4 w-4" />Guardian</div>
                <p className="font-medium">{child.guardianName}</p>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Phone className="h-4 w-4" />Phone</div>
                <p className="font-medium">{child.guardianPhone}</p>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="h-4 w-4" />Email</div>
                <p className="font-medium">{child.guardianEmail}</p>
              </div>
              {child.medicalNotes && (
                <>
                  <Separator />
                  <div className="space-y-1 bg-destructive/10 p-3 rounded-md border border-destructive/20 text-destructive">
                    <div className="text-sm font-semibold">Medical Notes</div>
                    <p className="text-sm">{child.medicalNotes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {hasProfileInfo ? (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Child Profile</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-5">
              {child.likes && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" />Likes</div>
                  <p className="text-sm leading-relaxed">{child.likes}</p>
                </div>
              )}
              {child.dislikes && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-slate-400" />Dislikes</div>
                  <p className="text-sm leading-relaxed">{child.dislikes}</p>
                </div>
              )}
              {child.temperament && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><Smile className="h-4 w-4" />Temperament</div>
                  <p className="text-sm leading-relaxed">{child.temperament}</p>
                </div>
              )}
              {child.background && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><BookOpen className="h-4 w-4" />Background</div>
                  <p className="text-sm leading-relaxed">{child.background}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="md:col-span-2 border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <Smile className="h-6 w-6 mx-auto mb-2 opacity-40" />
              <p>No profile info added yet.</p>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0" onClick={openEdit}>Add likes, dislikes & more</Button>
            </CardContent>
          </Card>
        )}
      </div>
      {/* Welfare Notification Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Welfare Notification Log
          </CardTitle>
          <Button size="sm" onClick={() => { setWelfareForm(EMPTY_WELFARE_FORM); setEvidenceObjectPath(null); setEvidenceFileName(null); setEditingWelfareNoteId(null); setWelfareOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />New Welfare Note
          </Button>
        </CardHeader>
        <CardContent>
          {welfareLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !welfareNotes || welfareNotes.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No welfare notifications recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...welfareNotes].reverse().map((note) => (
                <div key={note.id} className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium">
                          {safeDate(note.occurredAt, "d MMM yyyy, h:mm a")}
                        </span>
                        {note.staffName && (
                          <span className="text-xs text-muted-foreground">Recorded by {note.staffName}</span>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {note.mandatoryReportRequired && (
                          <Badge variant="destructive" className="text-xs">Mandatory Report</Badge>
                        )}
                        {note.cissThresholdMet && (
                          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">CISS Threshold</Badge>
                        )}
                        {note.fvissThresholdMet && (
                          <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100">FVISS Threshold</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditWelfareNote(note)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete welfare note?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this welfare notification record. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteWelfareNote(note.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Concerns</p>
                      <p className="leading-relaxed">{note.concerns}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Risk Factors</p>
                      <p className="leading-relaxed">{note.riskFactors}</p>
                    </div>
                    {note.evidence && (
                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evidence / Observations</p>
                        <p className="leading-relaxed">{note.evidence}</p>
                      </div>
                    )}
                    {note.mandatoryReportRequired && note.mandatoryReportNotes && (
                      <div className="space-y-1 md:col-span-2 bg-destructive/5 border border-destructive/20 rounded p-2">
                        <p className="text-xs font-medium text-destructive uppercase tracking-wide">Mandatory Report Notes</p>
                        <p className="leading-relaxed">{note.mandatoryReportNotes}</p>
                      </div>
                    )}
                    {note.cissThresholdMet && note.cissNotes && (
                      <div className="space-y-1 bg-amber-50 border border-amber-200 rounded p-2">
                        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">CISS Notes</p>
                        <p className="leading-relaxed">{note.cissNotes}</p>
                      </div>
                    )}
                    {note.fvissThresholdMet && note.fvissNotes && (
                      <div className="space-y-1 bg-orange-50 border border-orange-200 rounded p-2">
                        <p className="text-xs font-medium text-orange-700 uppercase tracking-wide">FVISS Notes</p>
                        <p className="leading-relaxed">{note.fvissNotes}</p>
                      </div>
                    )}
                    {note.confidentialNotes && (
                      <div className="space-y-1 md:col-span-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded p-2">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <Lock className="h-3 w-3" />Confidential Notes
                        </p>
                        <p className="leading-relaxed">{note.confidentialNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidential Notes */}
      <Card className="border-slate-300 dark:border-slate-600">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-600" />
              Confidential Notes
            </CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-700 dark:text-slate-300 font-medium">
                Admin &amp; Educational Leader only
              </span>
              <span>— role restriction will be enforced once authentication is added</span>
            </p>
          </div>
          <Button size="sm" onClick={() => { setConfNoteText(""); setConfNoteStaffId(""); setConfAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Add Note
          </Button>
        </CardHeader>
        <CardContent>
          {confidentialLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !confidentialNotes || confidentialNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Lock className="h-7 w-7 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No confidential notes recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...confidentialNotes].reverse().map((note) => (
                <div key={note.id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                  {editingConfNote?.id === note.id ? (
                    <form onSubmit={handleUpdateConfidentialNote} className="space-y-3">
                      <Textarea
                        value={editingConfNote.content}
                        onChange={(e) => setEditingConfNote({ ...editingConfNote, content: e.target.value })}
                        rows={3}
                        autoFocus
                        required
                      />
                      <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingConfNote(null)}>Cancel</Button>
                        <Button type="submit" size="sm" disabled={updateConfidentialMutation.isPending}>Save</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          <span>{safeDate(note.createdAt, "d MMM yyyy, h:mm a")}</span>
                          {note.staffName && <><span>·</span><span>{note.staffName}</span></>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingConfNote({ id: note.id, content: note.content })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete confidential note?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove this note. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteConfidentialNote(note.id)}
                              >Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* ── Child's Data ── */}
        <TabsContent value="childdata" className="space-y-6">
          {(() => {
            const childJottings = (allJottings ?? []).filter((j) => j.childId === child.id);
            const childPlanningExps = (allPlanningExperiences ?? []).filter((p) => (p.childIds ?? []).includes(child.id));
            const childPosts = (allPosts ?? []).filter((p) => (p.childIds ?? []).includes(child.id));

            return (
              <>
                {/* Jottings */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <StickyNote className="h-5 w-5" />Jottings
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {childJottings.filter((j) => !j.archivedAt).length} unactioned · {childJottings.filter((j) => j.archivedAt).length} actioned
                    </span>
                  </CardHeader>
                  <CardContent>
                    {childJottings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">No jottings recorded for this child</div>
                    ) : (
                      <div className="space-y-2">
                        {[...childJottings].reverse().map((j) => (
                          <div key={j.id} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${j.archivedAt ? "bg-muted/40 opacity-70" : "bg-green-50"}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="leading-relaxed line-clamp-2 flex-1">{j.content}</p>
                                {j.archivedAt && <Badge variant="secondary" className="text-xs shrink-0">Actioned</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{safeDate(j.createdAt, "d MMM yyyy")}{j.staffName ? ` · ${j.staffName}` : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Observations */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-5 w-5" />Observations
                    </CardTitle>
                    <Link href={`/observations/new?childId=${child.id}`}>
                      <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />New</Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {obsLoading ? (
                      <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
                    ) : !observations || observations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">No observations recorded yet</div>
                    ) : (
                      <div className="flex flex-col divide-y">
                        {observations.map((obs) => (
                          <Link key={obs.id} href={`/observations/${obs.id}`}>
                            <div className="py-2.5 px-2 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center bg-green-50 hover:bg-green-100 rounded transition-colors cursor-pointer">
                              <p className="text-sm line-clamp-1 leading-relaxed">{obs.description}</p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">{obs.staffName ?? "—"}</p>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground whitespace-nowrap">{safeDate(obs.observationDate, "d MMM yyyy")}</p>
                                <p className="text-xs text-muted-foreground whitespace-nowrap">Edited {safeDate(obs.updatedAt, "d MMM yyyy")}</p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Programmed Experiences */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />Programmed Experiences
                    </CardTitle>
                    <Link href="/planning"><Button size="sm" variant="outline">View all</Button></Link>
                  </CardHeader>
                  <CardContent>
                    {childPlanningExps.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">
                        No planning cycles linked to this child
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {childPlanningExps.map((p) => (
                          <Link key={p.id} href={`/planning/${p.id}`}>
                            <div className="px-3 py-2.5 rounded-lg border bg-green-50 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium truncate flex-1">{p.title}</span>
                              <Badge variant="outline" className="text-xs capitalize shrink-0">{p.stage}</Badge>
                              {p.startDate && <span className="text-xs text-muted-foreground shrink-0">{safeDate(p.startDate, "d MMM yyyy")}</span>}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Posts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Newspaper className="h-5 w-5" />Posts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {childPosts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg text-sm">No posts for this child</div>
                    ) : (
                      <div className="space-y-0">
                        <div className="divide-y">
                          {[...childPosts].reverse().slice(0, 3).map((p) => (
                            <Link key={p.id} href={`/posts/${p.id}`}>
                              <div className="py-3 flex items-center justify-between gap-4 bg-green-50 hover:bg-green-100 px-2 rounded cursor-pointer">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.date ? safeDate(p.date.slice(0, 10) + "T00:00:00", "d MMM yyyy") : safeDate(p.createdAt, "d MMM yyyy")}
                                    {p.staffName ? ` · ${p.staffName}` : ""}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                        {childPosts.length > 3 && (
                          <div className="pt-3">
                            <Link href={`/posts?childId=${child.id}`}>
                              <Button variant="outline" size="sm" className="w-full">
                                Show more ({childPosts.length - 3} more)
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
                Documents
              </CardTitle>
              <label className={`inline-flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground ${isUploadingDoc ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="h-3.5 w-3.5" />
                {isUploadingDoc ? "Uploading…" : "Upload Document"}
                <input
                  type="file"
                  className="hidden"
                  disabled={isUploadingDoc}
                  onChange={handleDocUpload}
                />
              </label>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !childDocuments || childDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                  <FolderOpen className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm font-medium">No documents uploaded yet</p>
                  <p className="text-xs mt-1">Use the Upload Document button to add files for this child.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {childDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 py-2.5 group">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={`/api/storage/objects/${doc.documentPath.replace(/^\/?(objects\/)?/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm font-medium text-primary hover:underline underline-offset-4 truncate"
                      >
                        {doc.documentName ?? doc.documentPath.split("/").pop()}
                      </a>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                        {format(new Date(doc.uploadedAt), "d MMM yyyy")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDocDelete(doc.id, doc.documentName)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Add Confidential Note Dialog */}
      <Dialog open={confAddOpen} onOpenChange={setConfAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-slate-600" />
              Add Confidential Note
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateConfidentialNote} className="space-y-4">
            <div className="rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
              This note is marked confidential and will be restricted to Admin and Educational Leader roles once authentication is configured.
            </div>
            <div className="space-y-1">
              <Label>Staff Member <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={confNoteStaffId || "none"} onValueChange={(v) => setConfNoteStaffId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Note <span className="text-destructive">*</span></Label>
              <Textarea
                value={confNoteText}
                onChange={(e) => setConfNoteText(e.target.value)}
                rows={5}
                placeholder="Enter confidential note..."
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t">
              <Button type="button" variant="outline" onClick={() => setConfAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createConfidentialMutation.isPending}>
                {createConfidentialMutation.isPending ? "Saving…" : "Save Note"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Child Profile</DialogTitle></DialogHeader>
          <form onSubmit={handleSave}>
            <Tabs defaultValue="details">
              <TabsList className="mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="guardian">Guardian</TabsTrigger>
                <TabsTrigger value="profile">Profile Info</TabsTrigger>
                <TabsTrigger value="childdata">Child's Data</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
                  <div className="space-y-1"><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
                </div>
                <div className="space-y-1"><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="waitlist">Waitlist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Site</Label>
                  <Select value={form.siteId || "none"} onValueChange={(v) => setForm({ ...form, siteId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="No site assigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No site</SelectItem>
                      {sites?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Medical Notes</Label><Textarea value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} rows={3} placeholder="Allergies, conditions, medications..." /></div>
              </TabsContent>

              <TabsContent value="guardian" className="space-y-4">
                <div className="space-y-1"><Label>Guardian Name</Label><Input value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Guardian Email</Label><Input type="email" value={form.guardianEmail} onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })} required /></div>
                <div className="space-y-1"><Label>Guardian Phone</Label><Input type="text" autoComplete="tel" placeholder="e.g. 0400 000 000" value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} required /></div>
              </TabsContent>

              <TabsContent value="profile" className="space-y-4">
                <p className="text-sm text-muted-foreground">This information helps educators understand and support the child's learning and wellbeing.</p>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Smile className="h-4 w-4" />Temperament</Label>
                  <Textarea value={form.temperament} onChange={(e) => setForm({ ...form, temperament: e.target.value })} rows={3} placeholder="e.g. Calm and observant, takes time to warm up, energetic and social..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Background</Label>
                  <Textarea value={form.background} onChange={(e) => setForm({ ...form, background: e.target.value })} rows={3} placeholder="Cultural background, family structure, languages spoken at home, prior care experience..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><Heart className="h-4 w-4 text-rose-500" />Likes</Label>
                  <Textarea value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value })} rows={3} placeholder="e.g. Dinosaurs, painting, outdoor play, listening to stories..." />
                </div>
                <div className="space-y-1">
                  <Label className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-slate-400" />Dislikes</Label>
                  <Textarea value={form.dislikes} onChange={(e) => setForm({ ...form, dislikes: e.target.value })} rows={3} placeholder="e.g. Loud noises, sand textures, transitions between activities..." />
                </div>
              </TabsContent>

              <TabsContent value="childdata" className="space-y-4">
                <p className="text-sm text-muted-foreground">Enrollment and placement details for this child.</p>
                <div className="space-y-1">
                  <Label>Enrollment Date</Label>
                  <Input type="date" value={form.enrollmentDate} onChange={(e) => setForm({ ...form, enrollmentDate: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label>Age Group / Room</Label>
                  <Select value={form.ageGroup} onValueChange={(v) => setForm({ ...form, ageGroup: v })}>
                    <SelectTrigger><SelectValue placeholder="Select age group" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="infant">Infant (0–12 months)</SelectItem>
                      <SelectItem value="toddler">Toddler (1–2 years)</SelectItem>
                      <SelectItem value="twos">Twos (2–3 years)</SelectItem>
                      <SelectItem value="preschool">Preschool (3–5 years)</SelectItem>
                      <SelectItem value="schoolage">School Age (5+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Welfare Note Dialog */}
      <Dialog open={welfareOpen} onOpenChange={(open) => { if (!open) closeWelfareDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {editingWelfareNoteId !== null ? "Edit Welfare Note" : "Record Welfare Notification"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleWelfareNoteSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date &amp; Time of Concern</Label>
                <Input
                  type="datetime-local"
                  value={welfareForm.occurredAt}
                  onChange={(e) => setWelfareForm({ ...welfareForm, occurredAt: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Recorded By (Staff)</Label>
                <Select value={welfareForm.staffId || "none"} onValueChange={(v) => setWelfareForm({ ...welfareForm, staffId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {staff?.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Concerns <span className="text-destructive">*</span></Label>
              <Textarea
                value={welfareForm.concerns}
                onChange={(e) => setWelfareForm({ ...welfareForm, concerns: e.target.value })}
                rows={3}
                placeholder="Describe the specific welfare concerns observed..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Risk Factors <span className="text-destructive">*</span></Label>
              <Textarea
                value={welfareForm.riskFactors}
                onChange={(e) => setWelfareForm({ ...welfareForm, riskFactors: e.target.value })}
                rows={3}
                placeholder="List the risk factors identified..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Evidence File <span className="text-muted-foreground text-xs">(optional — photo, document, etc.)</span></Label>
              {evidenceFileName ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{evidenceFileName}</span>
                  <button
                    type="button"
                    onClick={() => { setEvidenceObjectPath(null); setEvidenceFileName(null); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary ${isUploadingEvidence ? "opacity-50 pointer-events-none" : ""}`}>
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span>{isUploadingEvidence ? "Uploading…" : "Click to attach a file"}</span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploadingEvidence}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const result = await uploadFile(file);
                      if (result) {
                        setEvidenceObjectPath(result.objectPath);
                        setEvidenceFileName(file.name);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Threshold Assessments</p>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="mandatory-report"
                    checked={welfareForm.mandatoryReportRequired}
                    onCheckedChange={(v) => setWelfareForm({ ...welfareForm, mandatoryReportRequired: !!v })}
                  />
                  <Label htmlFor="mandatory-report" className="font-medium cursor-pointer">
                    Mandatory Report Required
                  </Label>
                </div>
                {welfareForm.mandatoryReportRequired && (
                  <div className="ml-7 space-y-1">
                    <Label className="text-xs text-muted-foreground">Mandatory Report Notes</Label>
                    <Textarea
                      value={welfareForm.mandatoryReportNotes}
                      onChange={(e) => setWelfareForm({ ...welfareForm, mandatoryReportNotes: e.target.value })}
                      rows={2}
                      placeholder="Details of mandatory reporting action taken..."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="ciss"
                    checked={welfareForm.cissThresholdMet}
                    onCheckedChange={(v) => setWelfareForm({ ...welfareForm, cissThresholdMet: !!v })}
                  />
                  <Label htmlFor="ciss" className="font-medium cursor-pointer">
                    CISS Threshold Met
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(Child Information Sharing Scheme)</span>
                  </Label>
                </div>
                {welfareForm.cissThresholdMet && (
                  <div className="ml-7 space-y-1">
                    <Label className="text-xs text-muted-foreground">CISS Notes</Label>
                    <Textarea
                      value={welfareForm.cissNotes}
                      onChange={(e) => setWelfareForm({ ...welfareForm, cissNotes: e.target.value })}
                      rows={2}
                      placeholder="Information sharing actions and rationale..."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="fviss"
                    checked={welfareForm.fvissThresholdMet}
                    onCheckedChange={(v) => setWelfareForm({ ...welfareForm, fvissThresholdMet: !!v })}
                  />
                  <Label htmlFor="fviss" className="font-medium cursor-pointer">
                    FVISS Threshold Met
                    <span className="ml-2 text-xs text-muted-foreground font-normal">(Family Violence Information Sharing Scheme)</span>
                  </Label>
                </div>
                {welfareForm.fvissThresholdMet && (
                  <div className="ml-7 space-y-1">
                    <Label className="text-xs text-muted-foreground">FVISS Notes</Label>
                    <Textarea
                      value={welfareForm.fvissNotes}
                      onChange={(e) => setWelfareForm({ ...welfareForm, fvissNotes: e.target.value })}
                      rows={2}
                      placeholder="Family violence information sharing actions and rationale..."
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Confidential Notes</p>
                  <p className="text-xs text-muted-foreground">Admin &amp; Educational Leader only — restriction enforced when authentication is added</p>
                </div>
              </div>
              <Textarea
                value={welfareForm.confidentialNotes}
                onChange={(e) => setWelfareForm({ ...welfareForm, confidentialNotes: e.target.value })}
                rows={3}
                placeholder="Notes restricted to Admin and Educational Leader roles only..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeWelfareDialog}>Cancel</Button>
              <Button type="submit" disabled={createWelfareMutation.isPending || updateWelfareMutation.isPending}>
                {createWelfareMutation.isPending || updateWelfareMutation.isPending
                  ? "Saving…"
                  : editingWelfareNoteId !== null ? "Save Changes" : "Save Welfare Note"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
