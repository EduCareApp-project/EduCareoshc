import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListPolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy,
  useAcknowledgePolicy, useGetPolicyAcknowledgments, getGetPolicyAcknowledgmentsQueryKey, useListStaff,
} from "@workspace/api-client-react";
import type { Policy } from "@workspace/api-client-react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck, Plus, FileText, Paperclip, Upload, X, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Pencil, Trash2, Users, ArrowLeft, RefreshCw, UserCircle2,
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

// ── Per-policy row with its own ack fetch ─────────────────────────────────────
function PolicyRow({
  policy,
  selectedStaffId,
  allStaff,
  onEdit,
  onDelete,
}: {
  policy: {
    id: number; title: string; policyNumber?: number | null; category: string;
    versionNumber: number; version?: string | null; content?: string | null;
    documentPath?: string | null; documentName?: string | null;
    description?: string | null; lastReviewedAt?: string | null;
    notifyRoles?: string | null;
  };
  selectedStaffId: number | null;
  allStaff: Array<{ id: number; firstName: string; lastName: string; role: string }>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const acknowledgeMutation = useAcknowledgePolicy();
  const [expanded, setExpanded] = useState(false);

  const { data: acks } = useGetPolicyAcknowledgments(policy.id, {
    query: { queryKey: getGetPolicyAcknowledgmentsQueryKey(policy.id), enabled: expanded || !!selectedStaffId },
  });

  const notifyRoles = policy.notifyRoles ? policy.notifyRoles.split(",").map((r) => r.trim()).filter(Boolean) : [];
  const selectedStaff = selectedStaffId ? allStaff.find((s) => s.id === selectedStaffId) : null;
  const isRequired = !!selectedStaff && notifyRoles.length > 0 && notifyRoles.includes(selectedStaff.role);
  const myAck = selectedStaffId ? (acks ?? []).find(
    (a) => a.staffId === selectedStaffId && a.policyVersion === policy.versionNumber
  ) : null;

  function handleAcknowledge(staffId: number) {
    acknowledgeMutation.mutate({ id: policy.id, data: { staffId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/policies/${policy.id}/acknowledgments`] });
        toast({ title: "Acknowledgement recorded" });
      },
      onError: () => toast({ title: "Failed to record acknowledgement", variant: "destructive" }),
    });
  }

  const currentAcks = (acks ?? []).filter((a) => a.policyVersion === policy.versionNumber);
  const relevantStaff = notifyRoles.length > 0 ? allStaff.filter((s) => notifyRoles.includes(s.role)) : [];
  const ackedCount = relevantStaff.filter((s) => currentAcks.some((a) => a.staffId === s.id)).length;

  return (
    <div className="border-b last:border-b-0">
      {/* ── Compact single-line row ── */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Policy number */}
        {policy.policyNumber != null && (
          <span className="text-xs font-bold text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0 tabular-nums min-w-[2.2rem] text-center">
            {String(policy.policyNumber).padStart(2, "0")}
          </span>
        )}

        {/* Title */}
        <span className="flex-1 text-sm font-medium truncate">{policy.title}</span>

        {/* Version */}
        <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">v{policy.versionNumber}</Badge>

        {/* PDF indicator */}
        {policy.documentPath && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}

        {/* Personal ack status */}
        {selectedStaffId && isRequired && (
          myAck ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5 shrink-0">
              <CheckCircle2 className="h-3 w-3" />Acknowledged
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 shrink-0">
              <Clock className="h-3 w-3" />Pending
            </span>
          )
        )}

        {/* Admin actions */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete policy?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{policy.title}" and all acknowledgement records.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button onClick={() => setExpanded((v) => !v)} className="text-muted-foreground hover:text-foreground p-1 ml-0.5">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t bg-muted/10 px-5 py-5 space-y-5">
          {/* Description */}
          {policy.description && (
            <p className="text-sm text-muted-foreground">{policy.description}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {policy.version && <span>Version label: {policy.version}</span>}
            {policy.lastReviewedAt && <span>Last reviewed: {(policy.lastReviewedAt as string).slice(0, 10)}</span>}
            {notifyRoles.length > 0 && <span>Required for: {notifyRoles.map(roleLabel).join(", ")}</span>}
          </div>

          {/* Personal acknowledgement CTA */}
          {selectedStaffId && isRequired && !myAck && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-800 font-medium">You haven't acknowledged this policy yet.</span>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                onClick={() => handleAcknowledge(selectedStaffId)}
                disabled={acknowledgeMutation.isPending}
              >
                Acknowledge
              </Button>
            </div>
          )}

          {selectedStaffId && isRequired && myAck && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>You acknowledged this policy on {format(new Date(myAck.acknowledgedAt), "dd/MM/yyyy")}.</span>
            </div>
          )}

          {/* Policy content */}
          {policy.content ? (
            <div
              className="prose prose-sm max-w-none text-sm leading-relaxed border rounded-lg p-4 bg-background"
              dangerouslySetInnerHTML={{ __html: policy.content }}
            />
          ) : policy.documentPath ? (
            <a
              href={`/api/storage${policy.documentPath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4 bg-primary/5 border border-primary/20 rounded-md px-3 py-2"
            >
              <Paperclip className="h-4 w-4" />
              {policy.documentName ?? "Open document"}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground italic">No content added yet.</p>
          )}

          {/* Admin acknowledgement panel */}
          {relevantStaff.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Staff acknowledgements — {ackedCount} of {relevantStaff.length} for v{policy.versionNumber}
                </div>
                <div className="grid gap-1">
                  {relevantStaff.map((s) => {
                    const ack = currentAcks.find((a) => a.staffId === s.id);
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-md bg-muted/30 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {ack ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" /> : <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          <span className="truncate">{s.firstName} {s.lastName}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{roleLabel(s.role)}</span>
                        </div>
                        {ack ? (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(ack.acknowledgedAt), "dd/MM/yyyy")}</span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-6 text-xs px-2"
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
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PoliciesList() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
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

  // Staff "who are you?" picker — persisted to localStorage
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(() => {
    const stored = localStorage.getItem("edu_selected_staff_id");
    return stored ? parseInt(stored, 10) : null;
  });

  function selectStaff(id: number | null) {
    setSelectedStaffId(id);
    if (id != null) localStorage.setItem("edu_selected_staff_id", String(id));
    else localStorage.removeItem("edu_selected_staff_id");
  }

  // Validate that stored staffId still exists in the staff list
  useEffect(() => {
    if (staff && selectedStaffId) {
      const exists = staff.some((s) => s.id === selectedStaffId);
      if (!exists) selectStaff(null);
    }
  }, [staff, selectedStaffId]);

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

  function openEdit(p: Policy) {
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
      const result = await uploadFile(selectedFile);
      if (!result) {
        toast({ title: "File upload failed", variant: "destructive" });
        return;
      }
      docPath = result.objectPath;
      docName = selectedFile.name;
    }

    const payload: Record<string, unknown> = {
      title: form.title,
      category: form.category,
      ...(form.policyNumber ? { policyNumber: parseInt(form.policyNumber) } : {}),
      ...(form.version ? { version: form.version } : {}),
      ...(form.lastReviewedAt ? { lastReviewedAt: form.lastReviewedAt } : {}),
      ...(form.description ? { description: form.description } : {}),
      notifyRoles: form.notifyRoles.join(","),
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

  const isSaving = createMutation.isPending || updateMutation.isPending || isUploading;

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
                  <Input id="policyNumber" type="number" min="1" value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} placeholder="e.g. 1" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="version">Version Label</Label>
                  <Input id="version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 2.1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Category <span className="text-destructive">*</span></Label>
                <Input id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Health & Safety" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastReviewedAt">Last Reviewed</Label>
                <input id="lastReviewedAt" type="date" value={form.lastReviewedAt} onChange={(e) => setForm({ ...form, lastReviewedAt: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Summary / Description</Label>
                <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Brief overview of this policy…" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-2">
                <Label>Policy Content</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({ ...form, contentMode: "text" })}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${form.contentMode === "text" ? "bg-primary/10 border-primary/40 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                    <FileText className="h-3.5 w-3.5 inline mr-1.5" />HTML Text
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, contentMode: "pdf" })}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${form.contentMode === "pdf" ? "bg-primary/10 border-primary/40 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                    <Paperclip className="h-3.5 w-3.5 inline mr-1.5" />PDF Upload
                  </button>
                </div>
              </div>
              {form.contentMode === "text" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="content">Content (HTML)</Label>
                  <Textarea id="content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10}
                    placeholder="Enter policy content. You may use HTML tags for formatting (e.g. <h2>, <p>, <ul>, <li>, <strong>)."
                    className="font-mono text-sm" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>PDF Document</Label>
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
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
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 w-full p-3 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition-colors">
                      <Upload className="h-4 w-4" />Click to upload PDF or document
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
                  <button key={role.value} type="button" onClick={() => toggleRole(role.value)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${form.notifyRoles.includes(role.value) ? "bg-primary/10 border-primary/40 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
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
              <input type="checkbox" checked={bumpVersion} onChange={(e) => setBumpVersion(e.target.checked)} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />This is a version update
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Incrementing the version will require all staff with matching roles to re-acknowledge this policy.</p>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isUploading ? "Uploading…" : isSaving ? "Saving…" : editingId ? "Save Changes" : "Add Policy"}
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

  const selectedStaffMember = staff?.find((s) => s.id === selectedStaffId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/policies")}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Service policies and procedures.</p>
          </div>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Policy</Button>
      </div>

      {/* Staff "who are you?" picker */}
      <div className="flex items-center gap-3 p-3 rounded-xl border bg-card">
        <UserCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">Viewing as</span>
        <Select
          value={selectedStaffId ? String(selectedStaffId) : "__none__"}
          onValueChange={(v) => selectStaff(v === "__none__" ? null : parseInt(v, 10))}
        >
          <SelectTrigger className="flex-1 max-w-xs h-8 text-sm">
            <SelectValue placeholder="Select your name…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Not selected —</SelectItem>
            {(staff ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.firstName} {s.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedStaffMember && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Showing your acknowledgement status below.
          </span>
        )}
        {!selectedStaffMember && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Select your name to see your acknowledgement status.
          </span>
        )}
      </div>

      {/* Policy list */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : sortedPolicies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <ShieldCheck className="h-10 w-10 mb-2 text-muted-foreground/50" />
            <p className="font-medium">No policies added yet</p>
            <p className="text-sm">Use the button above to add your first service policy.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, catPolicies]) => (
            <div key={category} className="space-y-1">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">{category}</h2>
              <Card className="overflow-hidden divide-y divide-border p-0">
                {catPolicies.map((p) => (
                  <PolicyRow
                    key={p.id}
                    policy={p as any}
                    selectedStaffId={selectedStaffId}
                    allStaff={(staff ?? []) as any}
                    onEdit={() => openEdit(p)}
                    onDelete={() => {
                      deleteMutation.mutate({ id: p.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: ["/api/policies"] });
                          toast({ title: "Policy deleted" });
                        },
                      });
                    }}
                  />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
