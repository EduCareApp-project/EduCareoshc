import { useState } from "react";
import { useParams, Link, useLocation, Redirect } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useGetStaff, getGetStaffQueryKey,
  useUpdateStaff,
  useDeleteStaff,
  useListSites,
  useGetStaffProfessionalDevelopment, getGetStaffProfessionalDevelopmentQueryKey,
  useCreateProfessionalDevelopment,
  useDeleteProfessionalDevelopment,
  useGetStaffQualifications, getGetStaffQualificationsQueryKey,
  useCreateStaffQualification,
  useUpdateStaffQualification,
  useDeleteStaffQualification,
  useDeleteQualificationDocument,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, GraduationCap, User, Award, Paperclip, X, Pencil, FileText, AlertTriangle, Camera, Check, ClipboardList, FolderDown } from "lucide-react";
import AppraisalsTab from "./appraisals-tab";
import { format, parseISO, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  type QualItem,
  type QualLevel,
  computeQualLevel,
  QUAL_LEVEL_LABELS,
  QUAL_LEVEL_STYLES,
  RP_QUALS,
  EDUCATOR_QUALS,
  CANNOT_WORK_QUALS,
} from "@/lib/qual-level";

const ROLE_LABELS: Record<string, string> = { admin: "Admin", educational_leader: "Educational Leader", coordinator: "Coordinator", educator: "Educator" };

function safePdDate(completedAt: string | null | undefined): string {
  if (!completedAt) return "—";
  try {
    const d = parseISO(completedAt);
    return isValid(d) ? format(d, "dd/MM/yyyy") : "—";
  } catch {
    return "—";
  }
}

function storageUrl(objectPath: string): string {
  const id = objectPath.replace(/^\/objects\//, "");
  return `/api/storage/objects/${id}`;
}

const STATUS_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "working_towards", label: "Working Towards" },
  { value: "pending", label: "Pending Renewal" },
  { value: "expired", label: "Expired" },
];

const STATUS_STYLES: Record<string, string> = {
  current: "bg-green-100 text-green-800 border-green-200",
  working_towards: "bg-blue-100 text-blue-800 border-blue-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  expired: "bg-red-100 text-red-800 border-red-200",
};

const QUALIFICATION_NAMES = [
  "Child Safety - Foundation Child Safety Training (GECCKO)",
  "Child Safety - Mandatory Reporting and Other Obligations",
  "Child Wellbeing",
  "CPR Renewal",
  "Education Qualifications",
  "First Aid",
  "Food Safety",
  "History & Compliance",
  "Managing Challenging Behaviour (DET)",
  "National Police Check",
  "Responsible Person Declaration",
  "Resume",
  "Risk Management (DET)",
  "Staff Details (DET)",
  "WWCC",
];

const EMPTY_QUAL_FORM = { name: "", status: "current", referenceNumber: "", expiryDate: "" };

export default function StaffProfile() {
  const { id } = useParams<{ id: string }>();
  const staffId = parseInt(id ?? "0");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isEducatorRole, canManageQualifications, isAdminOrEL, ownId } = usePermissions();

  const { data: staff, isLoading: loadingStaff } = useGetStaff(staffId, { query: { queryKey: getGetStaffQueryKey(staffId), enabled: !!staffId } });
  const { data: pdList, isLoading: loadingPd } = useGetStaffProfessionalDevelopment(staffId, { query: { queryKey: getGetStaffProfessionalDevelopmentQueryKey(staffId), enabled: !!staffId } });
  const { data: qualifications, isLoading: loadingQuals } = useGetStaffQualifications(staffId, { query: { queryKey: getGetStaffQualificationsQueryKey(staffId), enabled: !!staffId } });

  const [, navigate] = useLocation();
  const { data: sites } = useListSites();
  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();
  const createPdMutation = useCreateProfessionalDevelopment();
  const deletePdMutation = useDeleteProfessionalDevelopment();
  const createQualMutation = useCreateStaffQualification();
  const updateQualMutation = useUpdateStaffQualification();
  const deleteQualMutation = useDeleteStaffQualification();
  const deleteQualDocMutation = useDeleteQualificationDocument();

  const [pdOpen, setPdOpen] = useState(false);
  const [pdForm, setPdForm] = useState({ title: "", provider: "", completedAt: "", hoursEarned: "", notes: "" });

  const [qualOpen, setQualOpen] = useState(false);
  const [qualForm, setQualForm] = useState(EMPTY_QUAL_FORM);
  const [editingQualId, setEditingQualId] = useState<number | null>(null);
  const [qualDocPath, setQualDocPath] = useState<string | null>(null);
  const [qualDocName, setQualDocName] = useState<string | null>(null);
  const [originalDocPath, setOriginalDocPath] = useState<string | null>(null);

  const [bioText, setBioText] = useState<string>("");
  const [bioEditing, setBioEditing] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);

  const [notesText, setNotesText] = useState<string>("");
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [deletingNoteIndex, setDeletingNoteIndex] = useState<number | null>(null);

  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "", status: "", qualifications: "", wwccNumber: "", siteId: "" });
  const [profileEditSaving, setProfileEditSaving] = useState(false);

  function openProfileEdit() {
    if (!staff) return;
    setProfileEditForm({
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.email,
      phone: staff.phone ?? "",
      role: staff.role,
      status: staff.status,
      qualifications: staff.qualifications,
      wwccNumber: staff.wwccNumber ?? "",
      siteId: staff.siteId != null ? String(staff.siteId) : "",
    });
    setProfileEditOpen(true);
  }

  async function saveProfile() {
    setProfileEditSaving(true);
    try {
      await updateStaffMutation.mutateAsync({
        id: staffId,
        data: {
          firstName: profileEditForm.firstName,
          lastName: profileEditForm.lastName,
          email: profileEditForm.email,
          phone: profileEditForm.phone || undefined,
          role: profileEditForm.role as "admin" | "educational_leader" | "coordinator" | "educator",
          status: profileEditForm.status as "active" | "inactive",
          qualifications: profileEditForm.qualifications,
          wwccNumber: profileEditForm.wwccNumber || undefined,
          siteId: profileEditForm.siteId ? parseInt(profileEditForm.siteId) : null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}`] });
      setProfileEditOpen(false);
      toast({ title: "Profile updated" });
    } finally {
      setProfileEditSaving(false);
    }
  }

  const { uploadFile, isUploading } = useUpload({
    onError: () => toast({ title: "File upload failed", variant: "destructive" }),
  });
  const { uploadFile: uploadProfilePic, isUploading: isUploadingPic } = useUpload({
    onError: () => toast({ title: "Photo upload failed", variant: "destructive" }),
  });

  if (isEducatorRole && ownId && staffId !== ownId) {
    return <Redirect to={`/staff/${ownId}`} />;
  }

  async function handleDocUpload(file: File) {
    const response = await uploadFile(file);
    if (response) {
      setQualDocPath(response.objectPath);
      setQualDocName(file.name);
    }
  }

  async function handleProfilePicUpload(file: File) {
    const response = await uploadProfilePic(file);
    if (!response) return;
    await updateStaffMutation.mutateAsync({ id: staffId, data: { profilePicturePath: response.objectPath } });
    await queryClient.invalidateQueries({ queryKey: ["getStaff", staffId] });
    toast({ title: "Profile photo updated" });
  }

  function startAddNote() {
    setNotesText("");
    setNotesEditing(true);
  }

  async function deleteNote(index: number) {
    const rawEntries = (staff?.employmentNotes ?? "").split("\n\n---\n\n");
    rawEntries.splice(index, 1);
    const combined = rawEntries.join("\n\n---\n\n") || null;
    setDeletingNoteIndex(index);
    try {
      await updateStaffMutation.mutateAsync({ id: staffId, data: { employmentNotes: combined ?? "" } });
      await queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}`] });
      setDeletingNoteIndex(null);
    } catch {
      toast({ title: "Failed to delete note", variant: "destructive" });
      setDeletingNoteIndex(null);
    }
  }

  async function saveNotes() {
    if (!notesText.trim()) return;
    setNotesSaving(true);
    try {
      const timestamp = new Date().toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const newEntry = `[${timestamp}]\n${notesText.trim()}`;
      const existing = staff?.employmentNotes?.trim();
      const combined = existing ? `${newEntry}\n\n---\n\n${existing}` : newEntry;
      await updateStaffMutation.mutateAsync({ id: staffId, data: { employmentNotes: combined } });
      await queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}`] });
      setNotesEditing(false);
      toast({ title: "Note added" });
    } finally {
      setNotesSaving(false);
    }
  }

  function startEditBio() {
    setBioText(staff?.bio ?? "");
    setBioEditing(true);
  }

  async function saveBio() {
    setBioSaving(true);
    try {
      await updateStaffMutation.mutateAsync({ id: staffId, data: { bio: bioText } });
      await queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}`] });
      setBioEditing(false);
      toast({ title: "Profile saved" });
    } finally {
      setBioSaving(false);
    }
  }

  function openAddQual() {
    setQualForm(EMPTY_QUAL_FORM);
    setQualDocPath(null);
    setQualDocName(null);
    setEditingQualId(null);
    setQualOpen(true);
  }

  function downloadAllDocuments() {
    type QualDoc = { id: number; documentPath: string; documentName: string | null; active: boolean };
    const docs = (qualifications ?? []).flatMap((q) => {
      const allDocs = (q as any).documents as QualDoc[] | undefined;
      const activeDoc = allDocs?.find((d) => d.active);
      const docPath = activeDoc?.documentPath ?? q.documentPath ?? null;
      if (!docPath) return [];
      const docName = activeDoc?.documentName ?? q.name ?? docPath.split("/").pop() ?? "document";
      return [{ url: storageUrl(docPath), name: docName }];
    });

    if (docs.length === 0) {
      toast({ title: "No documents", description: "This staff member has no uploaded documents." });
      return;
    }

    toast({ title: `Downloading ${docs.length} document${docs.length === 1 ? "" : "s"}` });
    docs.forEach(({ url, name }, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 350);
    });
  }

  function openEditQual(q: NonNullable<typeof qualifications>[number]) {
    let expiryStr = "";
    if (q.expiryDate) {
      const d = q.expiryDate ? new Date(String(q.expiryDate)) : null;
      if (d && !isNaN(d.getTime())) expiryStr = format(d, "yyyy-MM-dd");
    }
    const activeDoc = (q as any).documents?.find((d: any) => d.active) ?? null;
    setQualForm({
      name: q.name,
      status: q.status,
      referenceNumber: q.referenceNumber ?? "",
      expiryDate: expiryStr,
    });
    setQualDocPath(q.documentPath ?? null);
    setQualDocName(activeDoc?.documentName ?? (q.documentPath ? q.documentPath.split("/").pop() ?? null : null));
    setOriginalDocPath(q.documentPath ?? null);
    setEditingQualId(q.id);
    setQualOpen(true);
  }

  function closeQualDialog() {
    setQualOpen(false);
    setQualForm(EMPTY_QUAL_FORM);
    setQualDocPath(null);
    setQualDocName(null);
    setOriginalDocPath(null);
    setEditingQualId(null);
  }

  function handleQualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      staffId,
      name: qualForm.name,
      status: qualForm.status,
    };
    if (qualForm.referenceNumber) body.referenceNumber = qualForm.referenceNumber;
    if (qualForm.expiryDate) body.expiryDate = qualForm.expiryDate;
    if (qualDocPath) {
      body.documentPath = qualDocPath;
      if (qualDocName) body.documentName = qualDocName;
    }

    const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] });

    if (editingQualId !== null) {
      updateQualMutation.mutate({ id: editingQualId, data: body as any }, {
        onSuccess: () => { closeQualDialog(); invalidate(); toast({ title: "Qualification updated" }); },
        onError: () => toast({ title: "Failed to update qualification", variant: "destructive" }),
      });
    } else {
      createQualMutation.mutate({ id: staffId, data: body as any }, {
        onSuccess: () => { closeQualDialog(); invalidate(); toast({ title: "Qualification added" }); },
        onError: () => toast({ title: "Failed to add qualification", variant: "destructive" }),
      });
    }
  }

  function handleDeleteQual(qualId: number) {
    deleteQualMutation.mutate({ id: qualId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] });
        toast({ title: "Qualification removed" });
      },
      onError: () => toast({ title: "Failed to remove qualification", variant: "destructive" }),
    });
  }

  function handleDeleteArchivedDoc(docId: number) {
    deleteQualDocMutation.mutate({ id: docId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/qualifications`] });
        toast({ title: "Archived document deleted" });
      },
      onError: () => toast({ title: "Failed to delete document", variant: "destructive" }),
    });
  }

  function handleCreatePd(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, unknown> = { staffId, title: pdForm.title, completedAt: pdForm.completedAt };
    if (pdForm.provider) data.provider = pdForm.provider;
    if (pdForm.hoursEarned) data.hoursEarned = parseInt(pdForm.hoursEarned);
    if (pdForm.notes) data.notes = pdForm.notes;
    createPdMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setPdOpen(false);
        setPdForm({ title: "", provider: "", completedAt: "", hoursEarned: "", notes: "" });
        queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/professional-development`] });
        toast({ title: "PD entry added" });
      },
      onError: () => toast({ title: "Failed to add PD entry", variant: "destructive" }),
    });
  }

  function handleDeletePd(pdId: number) {
    deletePdMutation.mutate({ id: pdId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/staff/${staffId}/professional-development`] }),
    });
  }

  const currentYear = new Date().getFullYear();
  const pdThisYear = (pdList ?? []).filter((p) => {
    if (!p.completedAt) return false;
    try { return isValid(parseISO(p.completedAt)) && parseISO(p.completedAt).getFullYear() === currentYear; }
    catch { return false; }
  });
  const totalHoursThisYear = pdThisYear.reduce((s, p) => s + (p.hoursEarned ?? 0), 0);
  const recordedQualNames = new Set((qualifications ?? []).map((q) => q.name));
  const missingQualNames = QUALIFICATION_NAMES.filter((n) => !recordedQualNames.has(n));

  if (loadingStaff) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!staff) {
    return <div className="text-center py-12 text-muted-foreground">Staff member not found.</div>;
  }

  function handleDeleteStaff() {
    deleteStaffMutation.mutate({ id: staffId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listStaff"] });
        toast({ title: "Staff member deleted" });
        navigate("/staff");
      },
      onError: () => toast({ title: "Failed to delete staff member", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/staff">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back to Staff</Button>
        </Link>
        {!isEducatorRole && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1" />Delete Staff Record
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {staff.firstName} {staff.lastName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this staff member and all their qualifications and professional development records. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={handleDeleteStaff}
                  disabled={deleteStaffMutation.isPending}
                >
                  {deleteStaffMutation.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xl text-primary overflow-hidden">
          {staff.profilePicturePath ? (
            <img
              src={storageUrl(staff.profilePicturePath)}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <>{staff.firstName[0]}{staff.lastName[0]}</>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{staff.firstName} {staff.lastName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge>{ROLE_LABELS[staff.role] || staff.role}</Badge>
            <Badge variant={staff.status === "active" ? "default" : "secondary"}>{staff.status}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="qualifications">Qualifications</TabsTrigger>
          <TabsTrigger value="pd">Professional Development</TabsTrigger>
          <TabsTrigger value="appraisals" className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />Appraisals
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          {/* Details */}
          {(() => {
            const wwccRef = qualifications?.find((q) => q.name === "WWCC")?.referenceNumber ?? null;
            const qualLevel = qualifications ? computeQualLevel(qualifications as QualItem[]) : null;
            const assignedSite = staff.siteId != null ? (sites ?? []).find((s) => s.id === staff.siteId) : null;
            return (
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Details</CardTitle>
                  <Button variant="outline" size="sm" onClick={openProfileEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Edit Profile
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Row 1: 3-column contact details */}
                  <div className="grid gap-4 grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                      <p className="font-medium">{staff.phone || <span className="text-muted-foreground italic">Not set</span>}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Email</p>
                      <p className="font-medium break-all">{staff.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">WWCC Number</p>
                      {wwccRef ? (
                        <p className="font-medium">{wwccRef}</p>
                      ) : (
                        <p className="font-medium text-red-600">Not on file</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Site + Qualification level */}
                  <div className="flex items-center justify-between pt-1 border-t">
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">Qualification Level</p>
                      {loadingQuals ? (
                        <span className="text-xs text-muted-foreground italic">Loading…</span>
                      ) : qualLevel ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${QUAL_LEVEL_STYLES[qualLevel]}`}>
                          {QUAL_LEVEL_LABELS[qualLevel]}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Home Site:</span>
                      <span className="font-medium text-foreground">
                        {assignedSite ? assignedSite.name : <span className="italic text-muted-foreground">Not assigned</span>}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Picture + Bio row */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-6 items-start">
                {/* Profile picture tile */}
                <div className="flex-shrink-0">
                  <div className="relative group w-28 h-28 rounded-xl overflow-hidden bg-primary/10 flex items-center justify-center">
                    {staff.profilePicturePath ? (
                      <img
                        src={storageUrl(staff.profilePicturePath)}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-primary">{staff.firstName[0]}{staff.lastName[0]}</span>
                    )}
                    <label className={`absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ${isUploadingPic ? "opacity-100" : ""}`}>
                      {isUploadingPic ? (
                        <span className="text-xs">Uploading…</span>
                      ) : (
                        <>
                          <Camera className="h-5 w-5 mb-1" />
                          <span className="text-xs">Change photo</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={isUploadingPic}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProfilePicUpload(f); e.target.value = ""; }}
                      />
                    </label>
                  </div>
                </div>

                {/* Bio */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">About</Label>
                    {!bioEditing && (
                      <Button variant="ghost" size="sm" onClick={startEditBio}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                      </Button>
                    )}
                  </div>
                  {bioEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={bioText}
                        onChange={(e) => setBioText(e.target.value)}
                        placeholder="Add a short bio or notes about this staff member…"
                        rows={4}
                        className="resize-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveBio} disabled={bioSaving}>
                          <Check className="h-3.5 w-3.5 mr-1" />{bioSaving ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setBioEditing(false)} disabled={bioSaving}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {staff.bio || <span className="italic">No bio added yet.</span>}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Notes — hidden for educator/coordinator roles */}
          {!isEducatorRole && <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Employment Notes</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Internal notes — access will be restricted by role in a future update.</p>
              </div>
              {!notesEditing && (
                <Button variant="outline" size="sm" onClick={startAddNote}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Note
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {notesEditing && (
                <div className="space-y-2 pb-3 border-b">
                  <Textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Add a new note…"
                    rows={4}
                    className="resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveNotes} disabled={notesSaving || !notesText.trim()}>
                      <Check className="h-3.5 w-3.5 mr-1" />{notesSaving ? "Saving…" : "Save Note"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNotesEditing(false)} disabled={notesSaving}>Cancel</Button>
                  </div>
                </div>
              )}
              {(() => {
                const entries = staff.employmentNotes
                  ? staff.employmentNotes.split("\n\n---\n\n").map((entry) => {
                      const match = entry.match(/^\[(.+?)\]\n([\s\S]*)$/);
                      return match
                        ? { timestamp: match[1], body: match[2].trim() }
                        : { timestamp: null, body: entry.trim() };
                    })
                  : [];
                if (entries.length === 0) {
                  return <p className="text-sm italic text-muted-foreground">No employment notes recorded.</p>;
                }
                return entries.map((entry, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        {entry.timestamp && (
                          <p className="text-xs font-medium text-muted-foreground">{entry.timestamp}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{entry.body}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={deletingNoteIndex === i}
                            title="Delete note (Admin only)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This note will be permanently removed and cannot be recovered.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => deleteNote(i)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {i < entries.length - 1 && <hr className="mt-3" />}
                  </div>
                ));
              })()}
            </CardContent>
          </Card>}
        </TabsContent>

        {/* Qualifications Tab */}
        <TabsContent value="qualifications" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Qualifications &amp; Certifications</h2>
              <p className="text-sm text-muted-foreground">Licences, certifications, and compliance documents.</p>
            </div>
            <div className="flex items-center gap-2">
              {isAdminOrEL && !loadingQuals && (qualifications ?? []).length > 0 && (
                <Button size="sm" variant="outline" onClick={downloadAllDocuments}>
                  <FolderDown className="h-4 w-4 mr-1" />Download All
                </Button>
              )}
              {canManageQualifications && (
                <Button size="sm" onClick={openAddQual}>
                  <Plus className="h-4 w-4 mr-1" />Add Qualification
                </Button>
              )}
            </div>
          </div>

          {loadingQuals ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (qualifications ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Award className="h-10 w-10 mb-2 opacity-20" />
                <p>No qualifications recorded yet.</p>
                {canManageQualifications && (
                  <Button variant="outline" size="sm" onClick={openAddQual} className="mt-2">
                    <Plus className="h-4 w-4 mr-1" />Add first qualification
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...(qualifications ?? [])].sort((a, b) => {
                const now = new Date();
                const isExpired = (q: typeof a) => {
                  const d = q.expiryDate ? new Date(String(q.expiryDate)) : null;
                  return (d && !isNaN(d.getTime()) && d < now) || q.status === "expired";
                };
                if (isExpired(a) && !isExpired(b)) return -1;
                if (!isExpired(a) && isExpired(b)) return 1;
                return QUALIFICATION_NAMES.indexOf(a.name) - QUALIFICATION_NAMES.indexOf(b.name);
              }).map((q) => {
                const expiry = q.expiryDate ? new Date(String(q.expiryDate)) : null;
                const expiryValid = expiry && !isNaN(expiry.getTime());
                const isDateExpired = expiryValid && expiry! < new Date();
                const effectiveStatus = isDateExpired ? "expired" : q.status;

                return <Card key={q.id}>
                  <CardContent className="py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="font-medium">{q.name}</p>
                        <Badge className={`text-xs border ${STATUS_STYLES[effectiveStatus] ?? ""}`} variant="outline">
                          {STATUS_OPTIONS.find((s) => s.value === effectiveStatus)?.label ?? effectiveStatus}
                        </Badge>
                        {effectiveStatus === "expired" && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="h-3 w-3" />{isDateExpired ? "Date passed" : "Expired"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {q.referenceNumber && (
                          <span>Ref: <span className="font-mono text-foreground">{q.referenceNumber}</span></span>
                        )}
                        {expiryValid && (
                          <span>Expires: <span className={`font-medium ${isDateExpired ? "text-red-600" : "text-foreground"}`}>
                            {format(expiry!, "dd/MM/yyyy")}
                          </span></span>
                        )}
                        {(() => {
                          const docs = (q as any).documents as Array<{ id: number; documentPath: string; documentName: string | null; active: boolean; uploadedAt: string }> | undefined;
                          const activeDoc = docs?.find((d) => d.active);
                          const inactiveDocs = docs?.filter((d) => !d.active) ?? [];
                          if (!activeDoc && !q.documentPath) return null;
                          const docPath = activeDoc?.documentPath ?? q.documentPath!;
                          const docName = activeDoc?.documentName ?? docPath.split("/").pop() ?? "View document";
                          return (
                            <>
                              <a
                                href={storageUrl(docPath)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText className="h-3 w-3" />{docName}
                              </a>
                              {inactiveDocs.length > 0 && (
                                <details className="mt-1">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                                    {inactiveDocs.length} previous {inactiveDocs.length === 1 ? "version" : "versions"}
                                  </summary>
                                  <div className="mt-1 pl-2 border-l space-y-1">
                                    {[...inactiveDocs].reverse().map((d) => (
                                      <div key={d.id} className="flex items-center gap-1 group">
                                        <a
                                          href={storageUrl(d.documentPath)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline line-through decoration-muted-foreground/40 flex-1 min-w-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <FileText className="h-3 w-3 shrink-0" />
                                          <span className="truncate">{d.documentName ?? d.documentPath.split("/").pop() ?? "Document"}</span>
                                        </a>
                                        <button
                                          type="button"
                                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-destructive shrink-0"
                                          title="Delete archived document"
                                          onClick={(e) => { e.stopPropagation(); handleDeleteArchivedDoc(d.id); }}
                                          disabled={deleteQualDocMutation.isPending}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    {canManageQualifications && <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditQual(q)}>
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
                            <AlertDialogTitle>Remove qualification?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove "{q.name}" from this staff member's record.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteQual(q.id)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>}
                  </CardContent>
                </Card>;
              })}
            </div>
          )}

          {!loadingQuals && missingQualNames.length > 0 && (() => {
            const statusDependentNames = new Set([...RP_QUALS, ...EDUCATOR_QUALS, ...CANNOT_WORK_QUALS]);
            return (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Not yet recorded</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingQualNames.map((name) => (
                    statusDependentNames.has(name) ? (
                      <span
                        key={name}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs border border-dashed border-orange-300 text-orange-700 bg-orange-50"
                      >
                        {name}
                      </span>
                    ) : (
                      <span
                        key={name}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs border border-dashed border-muted-foreground/30 text-muted-foreground/70 bg-muted/20"
                      >
                        {name}
                      </span>
                    )
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Status logic legend */}
          <Card className="border-dashed bg-muted/30">
            <CardContent className="py-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How Qualification Status is Calculated</p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Badge className="bg-red-100 text-red-800 border-red-200 shrink-0 mt-0.5" variant="outline">Cannot Work</Badge>
                  <span>Any of the following are <span className="font-medium text-foreground">expired</span>: WWCC, CPR Renewal, First Aid</span>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0 mt-0.5" variant="outline">Responsible Person</Badge>
                  <span>All required qualifications are current — includes Education Qualifications, First Aid, CPR Renewal, Food Safety, Responsible Person Declaration, Risk Management (DET), Staff Details (DET), History &amp; Compliance, WWCC, and Child Safety — Mandatory Reporting</span>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 shrink-0 mt-0.5" variant="outline">Educator</Badge>
                  <span>All three core documents are current — Staff Details (DET), WWCC, and Child Safety - Mandatory Reporting and Other Obligations</span>
                </div>
                <div className="flex items-start gap-3">
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 shrink-0 mt-0.5" variant="outline">Incomplete</Badge>
                  <span>One or more of the following are missing or not yet recorded: Staff Details (DET), WWCC, Child Safety - Mandatory Reporting and Other Obligations</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Professional Development Tab */}
        <TabsContent value="pd" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-primary">{totalHoursThisYear}h</p>
                <p className="text-xs text-muted-foreground">PD hours in {currentYear}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setPdOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add PD
            </Button>
          </div>

          {loadingPd ? (
            <div className="space-y-2">{[1, 2, 3].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (pdList ?? []).length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
              <GraduationCap className="h-8 w-8 mb-2" />
              <p>No professional development entries yet.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {[...(pdList ?? [])].reverse().map((p) => (
                <Card key={p.id}>
                  <CardContent className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{safePdDate(p.completedAt)}</span>
                        {p.provider && <><span>•</span><span>{p.provider}</span></>}
                        {p.hoursEarned != null && <><span>•</span><span className="font-medium text-foreground/70">{p.hoursEarned}h</span></>}
                      </div>
                      {p.notes && <p className="text-xs text-muted-foreground italic mt-1">{p.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeletePd(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Appraisals Tab */}
        <TabsContent value="appraisals" className="mt-4">
          <AppraisalsTab staffId={staffId} />
        </TabsContent>
      </Tabs>

      {/* Edit Profile Dialog */}
      <Dialog open={profileEditOpen} onOpenChange={setProfileEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />Edit Profile
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={profileEditForm.firstName} onChange={(e) => setProfileEditForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={profileEditForm.lastName} onChange={(e) => setProfileEditForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={profileEditForm.email} onChange={(e) => setProfileEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="text" autoComplete="tel" value={profileEditForm.phone} onChange={(e) => setProfileEditForm((f) => ({ ...f, phone: e.target.value }))} placeholder="e.g. 0412 345 678" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={profileEditForm.role} onValueChange={(v) => setProfileEditForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="educational_leader">Educational Leader</SelectItem>
                    <SelectItem value="coordinator">Coordinator</SelectItem>
                    <SelectItem value="educator">Educator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={profileEditForm.status} onValueChange={(v) => setProfileEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Education Qualifications</Label>
              <Input value={profileEditForm.qualifications} onChange={(e) => setProfileEditForm((f) => ({ ...f, qualifications: e.target.value }))} placeholder="e.g. Bachelor of Education (Early Childhood)" />
            </div>
            <div className="space-y-1.5">
              <Label>WWCC Number</Label>
              <Input value={profileEditForm.wwccNumber} onChange={(e) => setProfileEditForm((f) => ({ ...f, wwccNumber: e.target.value }))} placeholder="e.g. WWC1234567A" />
            </div>
            {!isEducatorRole && (
              <div className="space-y-1.5">
                <Label>Site / Location</Label>
                <Select
                  value={profileEditForm.siteId || "none"}
                  onValueChange={(v) => setProfileEditForm((f) => ({ ...f, siteId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No site assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No site assigned</SelectItem>
                    {(sites ?? []).map((site) => (
                      <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProfileEditOpen(false)} disabled={profileEditSaving}>Cancel</Button>
              <Button onClick={saveProfile} disabled={profileEditSaving || !profileEditForm.firstName || !profileEditForm.lastName || !profileEditForm.email}>
                {profileEditSaving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Qualification Dialog */}
      <Dialog open={qualOpen} onOpenChange={(open) => { if (!open) closeQualDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              {editingQualId !== null ? "Edit Qualification" : "Add Qualification"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQualSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Select
                value={qualForm.name}
                onValueChange={(v) => setQualForm((f) => ({ ...f, name: v }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select qualification type..." />
                </SelectTrigger>
                <SelectContent>
                  {QUALIFICATION_NAMES.filter((n) => {
                    const usedNames = (qualifications ?? [])
                      .filter((q) => q.id !== editingQualId)
                      .map((q) => q.name);
                    return !usedNames.includes(n);
                  }).map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status <span className="text-destructive">*</span></Label>
                <Select value={qualForm.status} onValueChange={(v) => setQualForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Expiry Date <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <div className="flex gap-1.5">
                  <Input
                    type="date"
                    value={qualForm.expiryDate}
                    autoComplete="off"
                    onChange={(e) => setQualForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  />
                  {qualForm.expiryDate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={() => setQualForm((f) => ({ ...f, expiryDate: "" }))}
                      title="Clear expiry date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input
                placeholder="Licence or certificate number"
                value={qualForm.referenceNumber}
                onChange={(e) => setQualForm((f) => ({ ...f, referenceNumber: e.target.value }))}
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Document</Label>
              {qualDocName ? (
                <div className="flex items-center gap-2 rounded-md border p-2.5 bg-muted/40">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{qualDocName}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => { setQualDocPath(null); setQualDocName(null); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center gap-2 rounded-md border border-dashed p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {isUploading ? "Uploading..." : "Attach certificate or document..."}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); }}
                  />
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={closeQualDialog}>Cancel</Button>
              <Button type="submit" disabled={createQualMutation.isPending || updateQualMutation.isPending || isUploading}>
                {createQualMutation.isPending || updateQualMutation.isPending ? "Saving..." : editingQualId !== null ? "Save Changes" : "Add Qualification"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add PD Dialog */}
      <Dialog open={pdOpen} onOpenChange={setPdOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Professional Development</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePd} className="space-y-4">
            <div className="space-y-1"><Label>Title / Course Name</Label><Input value={pdForm.title} onChange={(e) => setPdForm({ ...pdForm, title: e.target.value })} required /></div>
            <div className="space-y-1"><Label>Provider</Label><Input value={pdForm.provider} onChange={(e) => setPdForm({ ...pdForm, provider: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Completion Date</Label><Input type="date" value={pdForm.completedAt} onChange={(e) => setPdForm({ ...pdForm, completedAt: e.target.value })} required /></div>
              <div className="space-y-1"><Label>Hours Earned</Label><Input type="number" min="0" value={pdForm.hoursEarned} onChange={(e) => setPdForm({ ...pdForm, hoursEarned: e.target.value })} /></div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={pdForm.notes} onChange={(e) => setPdForm({ ...pdForm, notes: e.target.value })} rows={3} /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPdOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createPdMutation.isPending}>Add Entry</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
