import { useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  useListPolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy,
  useAcknowledgePolicy, useGetPolicyAcknowledgments, useListStaff,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck, Plus, FileText, Paperclip, Upload, X, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Pencil, Trash2, Users, ArrowLeft, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

const NOTIFY_ROLE_OPTIONS = [
  { value: "educational_leader", label: "Educational Leader" },
  { value: "coordinator", label: "Coordinator" },
  { value: "educator", label: "Educator" },
];

function roleLabel(role: string) {
  return NOTIFY_ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

const EMPTY_FORM = {
  policyNumber: "",
  title: "",
  category: "",
  version: "",
  lastReviewedAt: "",
  description: "",
  contentMode: "text" as "text" | "pdf",
  content: "",
  notifyRoles: [] as string[],
};

function AcknowledgementPanel({ policy, staff }: {
  policy: { id: number; versionNumber: number; notifyRoles?: string | null };
  staff: Array<{ id: number; firstName: string; lastName: string; role: string }>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const acknowledgeMutation = useAcknowledgePolicy();
  const { data: acks, isLoading } = useGetPolicyAcknowledgments({ id: policy.id });

  const notifyRoles = policy.notifyRoles ? policy.notifyRoles.split(",").map((r) => r.trim()) : [];
  const relevantStaff = notifyRoles.length > 0
    ? staff.filter((s) => notifyRoles.includes(s.role))
    : staff;

  const currentAcks = (acks ?? []).filter((a) => a.policyVersion === policy.versionNumber);
  const ackedStaffIds = new Set(currentAcks.map((a) => a.staffId));

  function handleAcknowledge(staffId: number) {
    acknowledgeMutation.mutate({ id: policy.id, data: { staffId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/policies/${policy.id}/acknowledgments`] });
        toast({ title: "Acknowledgement recorded" });
      },
      onError: () => toast({ title: "Failed to record acknowledgement", variant: "destructive" }),
    });
  }

  if (isLoading) return <div className="py-2"><Skeleton className="h-8 w-full" /></div>;

  const ackedCount = relevantStaff.filter((s) => ackedStaffIds.has(s.id)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          Acknowledgements — Version {policy.versionNumber}
        </span>
        <Badge variant="outline" className="text-xs">
          {ackedCount} / {relevantStaff.length}
        </Badge>
      </div>

      {relevantStaff.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No notify roles set — select roles in policy settings to track acknowledgements.
        </p>
      ) : (
        <div className="grid gap-1.5">
          {relevantStaff.map((s) => {
            const ack = currentAcks.find((a) => a.staffId === s.id);
            return (
              <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-muted/30 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {ack ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate">{s.firstName} {s.lastName}</span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal shrink-0">
                    {roleLabel(s.role)}
                  </Badge>
                </div>
                {ack ? (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(ack.acknowledgedAt), "d MMM yyyy")}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => handleAcknowledge(s.id)}
                    disabled={acknowledgeMutation.isPending}
                  >
                    Record
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PoliciesList() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { upload, uploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: policies, isLoading } = useListPolicies();
  const { data: staff } = useListStaff();
  const createMutation = useCreatePolicy();
  const updateMutation = useUpdatePolicy();
  const deleteMutation = useDeletePolicy();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingDocPath, setExistingDocPath] = useState("");
  const [existingDocName, setExistingDocName] = useState("");
  const [bumpVersion, setBumpVersion] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editSheetId, setEditSheetId] = useState<number | null>(null);

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      notifyRoles: f.notifyRoles.includes(role)
        ? f.notifyRoles.filter((r) => r !== role)
        : [...f.notifyRoles, role],
    }));
  }

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setSelectedFile(null);
    setExistingDocPath("");
    setExistingDocName("");
    setBumpVersion(false);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(p: NonNullable<ReturnType<typeof useListPolicies>["data"]>[number]) {
    setForm({
      policyNumber: p.policyNumber != null ? String(p.policyNumber) : "",
      title: p.title,
      category: p.category,
      version: p.version ?? "",
      lastReviewedAt: p.lastReviewedAt ? (p.lastReviewedAt as string).slice(0, 10) : "",
      description: p.description ?? "",
      contentMode: p.documentPath ? "pdf" : "text",
      content: p.content ?? "",
      notifyRoles: p.notifyRoles ? p.notifyRoles.split(",").map((r) => r.trim()).filter(Boolean) : [],
    });
    setExistingDocPath(p.documentPath ?? "");
    setExistingDocName(p.documentName ?? "");
    setSelectedFile(null);
    setBumpVersion(false);
    setEditingId(p.id);
    setEditSheetId(null);
    setShowForm(true);
  }

  function removeFile() {
    setSelectedFile(null);
    setExistingDocPath("");
    setExistingDocName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.category) {
      toast({ title: "Title and category are required", variant: "destructive" });
      return;
    }

    let docPath = existingDocPath;
    let docName = existingDocName;
    if (selectedFile) {
      try {
        docPath = await upload(selectedFile, { prefix: "policy-docs/" });
        docName = selectedFile.name;
      } catch {
        toast({ title: "File upload failed", variant: "destructive" });
        return;
      }
    }

    const payload: Record<string, unknown> = {
      title: form.title,
      category: form.category,
      ...(form.policyNumber ? { policyNumber: parseInt(form.policyNumber) } : {}),
      ...(form.version ? { version: form.version } : {}),
      ...(form.lastReviewedAt ? { lastReviewedAt: form.lastReviewedAt } : {}),
      ...(form.description ? { description: form.description } : {}),
      ...(form.notifyRoles.length > 0 ? { notifyRoles: form.notifyRoles.join(",") } : { notifyRoles: "" }),
    };

    if (form.contentMode === "text") {
      payload.content = form.content;
      payload.documentPath = "";
      payload.documentName = "";
    } else {
      payload.content = "";
      if (docPath) { payload.documentPath = docPath; payload.documentName = docName; }
    }

    if (editingId !== null) {
      if (bumpVersion) payload.bumpVersion = true;
      updateMutation.mutate({ id: editingId, data: payload as any }, {
        onSuccess: () => {
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
          toast({ title: bumpVersion ? "Policy updated — staff will need to re-acknowledge" : "Policy saved" });
        },
        onError: () => toast({ title: "Failed to save policy", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload as any }, {
        onSuccess: () => {
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
          toast({ title: "Policy added" });
        },
        onError: () => toast({ title: "Failed to add policy", variant: "destructive" }),
      });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || uploading;

  // ── Form view ────────────────────────────────────────────────────────────────
  if (showForm) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingId(null); }}>← Back</Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{editingId ? "Edit Policy" : "Add Policy"}</h1>
            <p className="text-muted-foreground text-sm">Service policies and procedures.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="policyNumber">Policy Number</Label>
                  <Input
                    id="policyNumber"
                    type="number"
                    min="1"
                    value={form.policyNumber}
                    onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="version">Version Label</Label>
                  <Input
                    id="version"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="e.g. 2.1"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Health & Safety"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lastReviewedAt">Last Reviewed</Label>
                <input
                  id="lastReviewedAt"
                  type="date"
                  value={form.lastReviewedAt}
                  onChange={(e) => setForm({ ...form, lastReviewedAt: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Summary / Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Brief overview of this policy…"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-2">
                <Label>Policy Content</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, contentMode: "text" })}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${form.contentMode === "text" ? "bg-primary/10 border-primary/40 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
                  >
                    <FileText className="h-3.5 w-3.5 inline mr-1.5" />
                    HTML Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, contentMode: "pdf" })}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${form.contentMode === "pdf" ? "bg-primary/10 border-primary/40 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}
                  >
                    <Paperclip className="h-3.5 w-3.5 inline mr-1.5" />
                    PDF Upload
                  </button>
                </div>
              </div>

              {form.contentMode === "text" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="content">Content (HTML)</Label>
                  <Textarea
                    id="content"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    rows={10}
                    placeholder="Enter policy content. You may use HTML tags for formatting (e.g. <h2>, <p>, <ul>, <li>, <strong>)."
                    className="font-mono text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>PDF Document</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/40 text-sm">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{selectedFile.name}</span>
                      <button type="button" onClick={removeFile} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                    </div>
                  ) : existingDocName ? (
                    <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/40 text-sm">
                      <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-muted-foreground">{existingDocName} (current)</span>
                      <button type="button" onClick={removeFile} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 w-full p-3 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Click to upload PDF or document
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 space-y-3">
              <Label>Notify Roles (staff who must acknowledge this policy)</Label>
              <div className="flex flex-wrap gap-2">
                {NOTIFY_ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => toggleRole(role.value)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                      form.notifyRoles.includes(role.value)
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "border-input text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              {form.notifyRoles.length === 0 && (
                <p className="text-xs text-muted-foreground">No roles selected — acknowledgement tracking is disabled for this policy.</p>
              )}
            </CardContent>
          </Card>

          {editingId !== null && (
            <label className="flex items-start gap-3 p-4 rounded-lg border border-dashed cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={bumpVersion}
                onChange={(e) => setBumpVersion(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  This is a version update
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Incrementing the version will require all staff with matching roles to re-acknowledge this policy.
                </p>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {uploading ? "Uploading…" : isSaving ? "Saving…" : editingId ? "Save Changes" : "Add Policy"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  const sortedPolicies = [...(policies ?? [])].sort((a, b) => {
    const an = a.policyNumber ?? 9999;
    const bn = b.policyNumber ?? 9999;
    if (an !== bn) return an - bn;
    return a.title.localeCompare(b.title);
  });

  const grouped: Record<string, typeof sortedPolicies> = {};
  for (const p of sortedPolicies) {
    const cat = p.category || "Uncategorised";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  const editingPolicy = editSheetId !== null ? (policies ?? []).find((p) => p.id === editSheetId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/policies")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Service policies and procedures with staff acknowledgements.</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Policy</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : sortedPolicies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <ShieldCheck className="h-10 w-10 mb-2 text-muted-foreground/50" />
            <p className="font-medium">No policies added yet</p>
            <p className="text-sm">Use the button above to add your first service policy.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([category, catPolicies]) => (
            <div key={category} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">{category}</h2>
              <div className="space-y-2">
                {catPolicies.map((p) => {
                  const isExpanded = expandedId === p.id;
                  const notifyRoles = p.notifyRoles ? p.notifyRoles.split(",").filter(Boolean) : [];
                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <div
                        className="px-5 py-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          {p.policyNumber != null && (
                            <span className="text-xs font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0 mt-0.5 tabular-nums min-w-[2rem] text-center">
                              {String(p.policyNumber).padStart(2, "0")}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{p.title}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5">v{p.versionNumber}</Badge>
                              {p.version && <Badge variant="outline" className="text-[10px] px-1.5">{p.version}</Badge>}
                              {p.documentPath && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                            </div>
                            {p.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {notifyRoles.map((r) => (
                                <span key={r} className="text-[10px] bg-primary/8 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-medium">
                                  {roleLabel(r)}
                                </span>
                              ))}
                              {p.lastReviewedAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  Reviewed: {(p.lastReviewedAt as string).slice(0, 10)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(p)}
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
                                <AlertDialogTitle>Delete policy?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{p.title}" and all associated acknowledgement records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => {
                                    deleteMutation.mutate({ id: p.id }, {
                                      onSuccess: () => {
                                        queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
                                        toast({ title: "Policy deleted" });
                                      },
                                    });
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : p.id)}
                            className="text-muted-foreground hover:text-foreground p-1"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-5 py-4 space-y-5 bg-muted/10">
                          {/* Content */}
                          {p.content ? (
                            <div
                              className="prose prose-sm max-w-none text-sm leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: p.content }}
                            />
                          ) : p.documentPath ? (
                            <a
                              href={`/api/objects/${p.documentPath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4 bg-primary/5 border border-primary/20 rounded-md px-3 py-2"
                            >
                              <Paperclip className="h-4 w-4" />
                              {p.documentName ?? "Open document"}
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No content added yet.</p>
                          )}

                          <Separator />

                          {/* Acknowledgements */}
                          <AcknowledgementPanel
                            policy={{ id: p.id, versionNumber: p.versionNumber, notifyRoles: p.notifyRoles }}
                            staff={(staff ?? []) as any}
                          />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
