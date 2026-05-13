import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetStaff,
  useGetStaffProfessionalDevelopment,
  useCreateProfessionalDevelopment,
  useDeleteProfessionalDevelopment,
  useGetStaffQualifications,
  useCreateStaffQualification,
  useUpdateStaffQualification,
  useDeleteStaffQualification,
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
import { ArrowLeft, Plus, Trash2, GraduationCap, User, Award, Paperclip, X, Pencil, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = { admin: "Admin", educational_leader: "Educational Leader", coordinator: "Coordinator", educator: "Educator" };

const STATUS_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending Renewal" },
];

const STATUS_STYLES: Record<string, string> = {
  current: "bg-green-100 text-green-800 border-green-200",
  expired: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
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

  const { data: staff, isLoading: loadingStaff } = useGetStaff(staffId, { query: { enabled: !!staffId } });
  const { data: pdList, isLoading: loadingPd } = useGetStaffProfessionalDevelopment(staffId, { query: { enabled: !!staffId } });
  const { data: qualifications, isLoading: loadingQuals } = useGetStaffQualifications(staffId, { query: { enabled: !!staffId } });

  const createPdMutation = useCreateProfessionalDevelopment();
  const deletePdMutation = useDeleteProfessionalDevelopment();
  const createQualMutation = useCreateStaffQualification();
  const updateQualMutation = useUpdateStaffQualification();
  const deleteQualMutation = useDeleteStaffQualification();

  const [pdOpen, setPdOpen] = useState(false);
  const [pdForm, setPdForm] = useState({ title: "", provider: "", completedAt: "", hoursEarned: "", notes: "" });

  const [qualOpen, setQualOpen] = useState(false);
  const [qualForm, setQualForm] = useState(EMPTY_QUAL_FORM);
  const [editingQualId, setEditingQualId] = useState<number | null>(null);
  const [qualDocPath, setQualDocPath] = useState<string | null>(null);
  const [qualDocName, setQualDocName] = useState<string | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: () => toast({ title: "File upload failed", variant: "destructive" }),
  });

  async function handleDocUpload(file: File) {
    const response = await uploadFile(file);
    if (response) {
      setQualDocPath(response.objectPath);
      setQualDocName(file.name);
    }
  }

  function openAddQual() {
    setQualForm(EMPTY_QUAL_FORM);
    setQualDocPath(null);
    setQualDocName(null);
    setEditingQualId(null);
    setQualOpen(true);
  }

  function openEditQual(q: NonNullable<typeof qualifications>[number]) {
    let expiryStr = "";
    if (q.expiryDate) {
      const d = q.expiryDate instanceof Date ? q.expiryDate : new Date(String(q.expiryDate));
      if (!isNaN(d.getTime())) expiryStr = format(d, "yyyy-MM-dd");
    }
    setQualForm({
      name: q.name,
      status: q.status,
      referenceNumber: q.referenceNumber ?? "",
      expiryDate: expiryStr,
    });
    setQualDocPath(q.documentPath ?? null);
    setQualDocName(q.documentPath ? q.documentPath.split("/").pop() ?? null : null);
    setEditingQualId(q.id);
    setQualOpen(true);
  }

  function closeQualDialog() {
    setQualOpen(false);
    setQualForm(EMPTY_QUAL_FORM);
    setQualDocPath(null);
    setQualDocName(null);
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
    if (qualDocPath) body.documentPath = qualDocPath;

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
  const pdThisYear = (pdList ?? []).filter((p) => new Date(p.completedAt + "T00:00:00").getFullYear() === currentYear);
  const totalHoursThisYear = pdThisYear.reduce((s, p) => s + (p.hoursEarned ?? 0), 0);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/staff">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back to Staff</Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xl text-primary">
          {staff.firstName[0]}{staff.lastName[0]}
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
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-xs text-muted-foreground mb-1">Email</p><p className="font-medium">{staff.email}</p></div>
                {staff.phone && <div><p className="text-xs text-muted-foreground mb-1">Phone</p><p className="font-medium">{staff.phone}</p></div>}
                <div><p className="text-xs text-muted-foreground mb-1">Qualifications</p><p className="font-medium">{staff.qualifications}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">WWCC Number</p>
                  <p className={`font-medium ${!staff.wwccNumber ? "text-amber-600" : ""}`}>{staff.wwccNumber || "Not on file"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Qualifications Tab */}
        <TabsContent value="qualifications" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Qualifications &amp; Certifications</h2>
              <p className="text-sm text-muted-foreground">Licences, certifications, and compliance documents.</p>
            </div>
            <Button size="sm" onClick={openAddQual}>
              <Plus className="h-4 w-4 mr-1" />Add Qualification
            </Button>
          </div>

          {loadingQuals ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (qualifications ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Award className="h-10 w-10 mb-2 opacity-20" />
                <p>No qualifications recorded yet.</p>
                <Button variant="outline" size="sm" onClick={openAddQual} className="mt-2">
                  <Plus className="h-4 w-4 mr-1" />Add first qualification
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...(qualifications ?? [])].sort((a, b) => {
                const now = new Date();
                const isExpired = (q: typeof a) => {
                  const d = q.expiryDate instanceof Date ? q.expiryDate : q.expiryDate ? new Date(String(q.expiryDate)) : null;
                  return (d && !isNaN(d.getTime()) && d < now) || q.status === "expired";
                };
                if (isExpired(a) && !isExpired(b)) return -1;
                if (!isExpired(a) && isExpired(b)) return 1;
                return QUALIFICATION_NAMES.indexOf(a.name) - QUALIFICATION_NAMES.indexOf(b.name);
              }).map((q) => {
                const expiry = q.expiryDate instanceof Date ? q.expiryDate : q.expiryDate ? new Date(String(q.expiryDate)) : null;
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
                            {format(expiry!, "d MMM yyyy")}
                          </span></span>
                        )}
                        {q.documentPath && (
                          <a
                            href={`/api/storage/object/${encodeURIComponent(q.documentPath)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="h-3 w-3" />View document
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
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
                    </div>
                  </CardContent>
                </Card>;
              })}
            </div>
          )}
        </TabsContent>

        {/* Professional Development Tab */}
        <TabsContent value="pd" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg px-4 py-2 text-center">
                <p className="text-2xl font-bold text-primary">{totalHoursThisYear}h</p>
                <p className="text-xs text-muted-foreground">PD hours in {currentYear}</p>
              </div>
              {totalHoursThisYear >= 8
                ? <Badge className="bg-green-100 text-green-800">Meeting requirements</Badge>
                : <Badge className="bg-amber-100 text-amber-800">{8 - totalHoursThisYear}h remaining</Badge>}
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
                        <span>{format(new Date(p.completedAt + "T00:00:00"), "MMM d, yyyy")}</span>
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
      </Tabs>

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
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={qualForm.expiryDate}
                  onChange={(e) => setQualForm((f) => ({ ...f, expiryDate: e.target.value }))}
                />
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
