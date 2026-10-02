import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListPolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy, getListPoliciesQueryKey,
} from "@workspace/api-client-react";
import type { Policy, PolicyInput, PolicyUpdate } from "@workspace/api-client-react";
import { PolicyRow, NOTIFY_ROLE_OPTIONS } from "@/components/policies/policy-row";
import { usePermissions } from "@/hooks/use-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveStaff } from "@/hooks/use-active-staff";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck, Plus, FileText, Paperclip, Upload, X, ChevronDown, ChevronUp, ArrowLeft, RefreshCw, UserCircle2, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";

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
  isActive: true,
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PoliciesList() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isAdminOrEL: canManage, ownId } = usePermissions();
  const { data: policies, isLoading, isError, refetch } = useListPolicies({
    query: { queryKey: getListPoliciesQueryKey(), staleTime: 30_000, refetchInterval: 60_000 },
  });
  const [showInactive, setShowInactive] = useState(false);
  const { data: staff } = useActiveStaff();
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
    if (!canManage) return null;
    const stored = localStorage.getItem("edu_selected_staff_id");
    return stored ? parseInt(stored, 10) : null;
  });

  function selectStaff(id: number | null) {
    setSelectedStaffId(id);
    setShowInactive(false);
    if (!canManage) return;
    if (id != null) localStorage.setItem("edu_selected_staff_id", String(id));
    else localStorage.removeItem("edu_selected_staff_id");
  }

  // Validate that stored staffId still exists in the staff list
  useEffect(() => {
    if (canManage && staff && selectedStaffId) {
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
      lastReviewedAt: p.lastReviewedAt ? p.lastReviewedAt.slice(0, 10) : "",
      description: p.description ?? "",
      contentMode: p.documentPath ? "pdf" : "text",
      content: p.content ?? "",
      notifyRoles: p.notifyRoles ? p.notifyRoles.split(",").map((r) => r.trim()).filter(Boolean) : [],
      isActive: p.isActive,
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

    const payload: PolicyInput & Pick<PolicyUpdate, "bumpVersion"> = {
      title: form.title,
      category: form.category,
      ...(form.policyNumber ? { policyNumber: parseInt(form.policyNumber) } : {}),
      ...(form.version ? { version: form.version } : {}),
      ...(form.lastReviewedAt ? { lastReviewedAt: form.lastReviewedAt } : {}),
      ...(form.description ? { description: form.description } : {}),
      notifyRoles: form.notifyRoles.join(","),
      isActive: form.isActive,
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
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() });
          toast({ title: bumpVersion ? "Policy updated — staff will need to re-acknowledge" : "Policy saved" });
        },
        onError: () => toast({ title: "Failed to save policy", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() });
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
              <p className="text-xs text-muted-foreground">Selected current staff in these roles are added to this policy's saved distribution list. New hires are added later, individually.</p>
              <div className="flex flex-wrap gap-2">
                {NOTIFY_ROLE_OPTIONS.map((role) => (
                  <button key={role.value} type="button" onClick={() => toggleRole(role.value)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${form.notifyRoles.includes(role.value) ? "bg-primary/10 border-primary/40 text-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                    {role.label}
                  </button>
                ))}
              </div>
              {form.notifyRoles.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No roles selected — {editingId !== null
                    ? "existing recipients are retained. Add new staff individually from the policy list."
                    : "the distribution starts empty. You can add staff individually from the policy list."}
                </p>
              )}
            </CardContent>
          </Card>

          <label className="flex items-start gap-3 p-4 rounded-lg border cursor-pointer">
            <input type="checkbox" data-testid="input-is-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">Active policy</p>
              <p className="text-xs text-muted-foreground mt-0.5">Inactive policies keep their history but cannot receive new acknowledgements or distribution.</p>
            </div>
          </label>

          {editingId !== null && (
            <label className="flex items-start gap-3 p-4 rounded-lg border border-dashed cursor-pointer hover:bg-muted/30 transition-colors">
              <input type="checkbox" checked={bumpVersion} onChange={(e) => setBumpVersion(e.target.checked)} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />This is a version update
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Incrementing the version will require everyone on the saved distribution to re-acknowledge this policy.</p>
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

  const viewerId = canManage ? selectedStaffId : ownId;
  const selectedStaffMember = staff?.find((s) => s.id === selectedStaffId);
  const activePolicies = sortedPolicies.filter((p) => p.isActive);
  const inactivePolicies = sortedPolicies.filter((p) =>
    !p.isActive && (canManage && selectedStaffId == null ? true : viewerId != null && p.acknowledgedStaffIds.includes(viewerId)));
  const allStaff = staff ?? [];

  function renderRow(p: Policy) {
    return (
      <PolicyRow key={p.id} policy={p} viewerId={viewerId} allStaff={allStaff} canManage={canManage}
        onEdit={() => openEdit(p)}
        onDelete={() => deleteMutation.mutate({ id: p.id }, {
          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPoliciesQueryKey() }); toast({ title: "Policy deleted" }); },
          onError: () => toast({ title: "Failed to delete policy", variant: "destructive" }),
        })} />
    );
  }

  const groupedActive: Record<string, Policy[]> = {};
  for (const p of activePolicies) (groupedActive[p.category || "Uncategorised"] ??= []).push(p);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/policies")}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Service policies and procedures.</p>
          </div>
        </div>
        {canManage && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Policy</Button>}
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border bg-card">
          <UserCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">Viewing as</span>
          <Select value={selectedStaffId ? String(selectedStaffId) : "__none__"} onValueChange={(v) => selectStaff(v === "__none__" ? null : parseInt(v, 10))}>
            <SelectTrigger className="flex-1 max-w-xs h-8 text-sm" data-testid="select-viewing-as"><SelectValue placeholder="Select staff member…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Not selected —</SelectItem>
              {allStaff.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {selectedStaffMember ? "All active policies shown; add this person to a policy's distribution where needed." : "Select a staff member to see their status."}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Showing your own acknowledgement status.</p>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : isError ? (
        <Card><CardContent className="py-12 text-center flex flex-col items-center gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="font-medium">Policies could not be loaded</p>
          <Button variant="outline" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      ) : sortedPolicies.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
          <ShieldCheck className="h-10 w-10 mb-2 text-muted-foreground/50" />
          <p className="font-medium">No policies added yet</p>
          {canManage && <p className="text-sm">Use the button above to add your first service policy.</p>}
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {activePolicies.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-no-active">No active policies.</p>}
          {Object.entries(groupedActive).map(([category, list]) => (
            <div key={category} className="space-y-1">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">{category}</h2>
              <Card className="overflow-hidden divide-y divide-border p-0">{list.map(renderRow)}</Card>
            </div>
          ))}

          {inactivePolicies.length > 0 && (
            <div className="space-y-2" data-testid="section-inactive">
              <button type="button" data-testid="button-toggle-inactive" aria-expanded={showInactive}
                onClick={() => setShowInactive((v) => !v)}
                className="w-full flex items-center justify-between rounded-lg border border-dashed px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40">
                <span>
                  Inactive policies ({inactivePolicies.length})
                  {canManage && selectedStaffMember
                    ? ` signed by ${selectedStaffMember.firstName} ${selectedStaffMember.lastName}`
                    : !canManage ? " you have signed" : ""}
                </span>
                {showInactive ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showInactive && <Card className="overflow-hidden p-0">{inactivePolicies.map(renderRow)}</Card>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
