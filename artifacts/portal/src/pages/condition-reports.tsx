import { useRef, useState } from "react";
import {
  useListConditionReports,
  useCreateConditionReport,
  useUpdateConditionReport,
  useDeleteConditionReport,
  useListStaff,
  useListSites,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ClipboardX, Plus, Paperclip, X, Upload, ShieldCheck, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";
import { melbourneDateStr } from "@/lib/timezone";

function statusBadge(s: string) {
  if (s === "resolved") return <Badge className="bg-green-100 text-green-800 border-0">Resolved</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-0">Open</Badge>;
}

function safeDate(val: string | null | undefined, fmt: string) {
  if (!val) return "—";
  try {
    const iso = val.length === 10 ? val + "T00:00:00" : val;
    return format(parseISO(iso), fmt);
  } catch {
    return "—";
  }
}

const EMPTY_FORM = {
  reportedDate: melbourneDateStr(),
  staffId: "",
  siteId: "",
  description: "",
  immediateActionRequired: false,
  actionTaken: "",
  evidenceDocumentPath: "",
  evidenceDocumentName: "",
  status: "open",
};

export default function ConditionReports() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { upload, uploading } = useUpload();

  const { data: reports, isLoading } = useListConditionReports();
  const { data: staffList } = useListStaff();
  const { data: sites } = useListSites();
  const createMutation = useCreateConditionReport();
  const updateMutation = useUpdateConditionReport();
  const deleteMutation = useDeleteConditionReport();

  const [showForm, setShowForm] = useState(false);
  const [editingExistingId, setEditingExistingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [leadershipNotes, setLeadershipNotes] = useState("");
  const [editingLeadership, setEditingLeadership] = useState(false);

  const filteredReports = (reports ?? []).filter((r) =>
    siteFilter === "all" || String(r.siteId) === siteFilter
  );

  const selectedReport = (reports ?? []).find((r) => r.id === selectedId);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
  }

  function removeFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setForm((f) => ({ ...f, evidenceDocumentPath: "", evidenceDocumentName: "" }));
  }

  function openNewReport() {
    setForm({ ...EMPTY_FORM });
    setSelectedFile(null);
    setEditingExistingId(null);
    setShowForm(true);
  }

  function openEdit(r: NonNullable<typeof selectedReport>) {
    setForm({
      reportedDate: (r.reportedDate ?? new Date().toISOString()).slice(0, 10),
      staffId: String(r.staffId),
      siteId: r.siteId ? String(r.siteId) : "",
      description: r.description,
      immediateActionRequired: r.immediateActionRequired,
      actionTaken: r.actionTaken ?? "",
      evidenceDocumentPath: r.evidenceDocumentPath ?? "",
      evidenceDocumentName: r.evidenceDocumentName ?? "",
      status: r.status,
    });
    setSelectedFile(null);
    setEditingExistingId(r.id);
    setSelectedId(null);
    setShowForm(true);
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.staffId) { toast({ title: "Please select a staff member", variant: "destructive" }); return; }

    let docPath = form.evidenceDocumentPath;
    let docName = form.evidenceDocumentName;

    if (selectedFile) {
      try {
        const path = await upload(selectedFile, { prefix: "condition-evidence/" });
        docPath = path;
        docName = selectedFile.name;
      } catch {
        toast({ title: "File upload failed", variant: "destructive" });
        return;
      }
    }

    const payload = {
      reportedDate: form.reportedDate,
      staffId: Number(form.staffId),
      siteId: form.siteId ? Number(form.siteId) : undefined,
      description: form.description,
      immediateActionRequired: form.immediateActionRequired,
      ...(editingExistingId !== null ? { status: form.status } : {}),
      ...(form.actionTaken ? { actionTaken: form.actionTaken } : {}),
      ...(docPath ? { evidenceDocumentPath: docPath, evidenceDocumentName: docName } : {}),
    };

    if (editingExistingId !== null) {
      updateMutation.mutate({ id: editingExistingId, data: payload as any }, {
        onSuccess: () => {
          setShowForm(false);
          setEditingExistingId(null);
          queryClient.invalidateQueries({ queryKey: ["/api/condition-reports"] });
          toast({ title: "Report updated" });
        },
        onError: () => toast({ title: "Failed to update report", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload as any }, {
        onSuccess: (data) => {
          setShowForm(false);
          setForm({ ...EMPTY_FORM });
          setSelectedFile(null);
          queryClient.invalidateQueries({ queryKey: ["/api/condition-reports"] });
          toast({ title: "Condition report submitted" });
          setSelectedId((data as any).id);
        },
        onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
      });
    }
  }

  function handleSaveLeadershipNotes() {
    if (!selectedId) return;
    updateMutation.mutate({ id: selectedId, data: { leadershipNotes } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/condition-reports"] });
        setEditingLeadership(false);
        toast({ title: "Leadership notes saved" });
      },
      onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
    });
  }

  function handleResolve() {
    if (!selectedId) return;
    updateMutation.mutate({ id: selectedId, data: { status: "resolved" } as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/condition-reports"] });
        toast({ title: "Report marked as resolved" });
      },
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        setSelectedId(null);
        queryClient.invalidateQueries({ queryKey: ["/api/condition-reports"] });
        toast({ title: "Report deleted" });
      },
      onError: () => toast({ title: "Failed to delete report", variant: "destructive" }),
    });
  }

  function openDetail(id: number) {
    const r = (reports ?? []).find((r) => r.id === id);
    setSelectedId(id);
    setLeadershipNotes(r?.leadershipNotes ?? "");
    setEditingLeadership(false);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending || uploading;

  // ── Form view (create or edit) ──────────────────────────────────────────────
  if (showForm) {
    const isEditing = editingExistingId !== null;
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setEditingExistingId(null); }}>← Back</Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Edit Condition Report" : "New Condition Report"}</h1>
            <p className="text-muted-foreground text-sm">Document a hazard, unsafe condition, or equipment issue.</p>
          </div>
        </div>

        <form onSubmit={handleSubmitForm} className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Report Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reportedDate">Date <span className="text-destructive">*</span></Label>
                  <input
                    id="reportedDate"
                    type="date"
                    value={form.reportedDate}
                    onChange={(e) => setForm({ ...form, reportedDate: e.target.value })}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Staff Member <span className="text-destructive">*</span></Label>
                  <Select value={form.staffId} onValueChange={(v) => setForm({ ...form, staffId: v })} required>
                    <SelectTrigger><SelectValue placeholder="Select staff…" /></SelectTrigger>
                    <SelectContent>
                      {(staffList ?? []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Location (Site)</Label>
                <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select site…" /></SelectTrigger>
                  <SelectContent>
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description of Condition / Hazard <span className="text-destructive">*</span></Label>
                <Textarea
                  id="description"
                  placeholder="Describe the hazard, unsafe condition, or equipment issue…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  required
                />
              </div>

              {isEditing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Immediate Action Required?</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, immediateActionRequired: true })}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${form.immediateActionRequired ? "bg-red-50 border-red-400 text-red-700" : "bg-background border-input text-muted-foreground hover:bg-muted"}`}
                  >Yes</button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, immediateActionRequired: false })}
                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${!form.immediateActionRequired ? "bg-green-50 border-green-400 text-green-700" : "bg-background border-input text-muted-foreground hover:bg-muted"}`}
                  >No</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="actionTaken">Action Taken to Reduce Risk</Label>
                <Textarea
                  id="actionTaken"
                  placeholder="Describe any immediate steps taken to address the hazard…"
                  value={form.actionTaken}
                  onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Upload Evidence</Label>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
                {selectedFile ? (
                  <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/40 text-sm">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{selectedFile.name}</span>
                    <button type="button" onClick={removeFile} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                  </div>
                ) : form.evidenceDocumentName ? (
                  <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/40 text-sm">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-muted-foreground">{form.evidenceDocumentName} (existing)</span>
                    <button type="button" onClick={removeFile} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 w-full p-3 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Click to attach a document or photo
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="p-4 rounded-lg border border-dashed bg-muted/30 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Leadership Notes</p>
              <p className="text-xs text-muted-foreground mt-0.5">This section is completed by Admin or Educational Leader after the report is submitted.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingExistingId(null); }}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {uploading ? "Uploading…" : isSaving ? "Saving…" : isEditing ? "Save Changes" : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Condition Reports</h1>
          <p className="text-muted-foreground mt-1">Report and track hazards, damaged equipment, or unsafe conditions.</p>
        </div>
        <Button onClick={openNewReport}><Plus className="h-4 w-4 mr-2" />New Report</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            {(sites ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {siteFilter !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setSiteFilter("all")}>
            <X className="h-3.5 w-3.5 mr-1" />Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <ClipboardX className="h-10 w-10 mb-2 text-muted-foreground/50" />
            {siteFilter !== "all" ? (
              <>
                <p className="font-medium">No reports for this site</p>
                <p className="text-sm">Try selecting a different site or clear the filter.</p>
              </>
            ) : (
              <>
                <p className="font-medium">No condition reports yet</p>
                <p className="text-sm">Use the button above to report a hazard or unsafe condition.</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            <div className="px-4 py-2 grid grid-cols-[1fr_160px_120px_100px] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Description</span>
              <span>Staff</span>
              <span>Site</span>
              <span className="text-right">Date</span>
            </div>
            {filteredReports.map((r) => (
              <div
                key={r.id}
                className="px-4 py-3 grid grid-cols-[1fr_160px_120px_100px] gap-4 items-center hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => openDetail(r.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{r.description}</span>
                  {r.immediateActionRequired && <Badge className="bg-red-100 text-red-700 border-0 shrink-0 text-[10px] px-1.5">Immediate</Badge>}
                  {statusBadge(r.status)}
                </div>
                <span className="text-sm text-muted-foreground truncate">{r.staffName ?? "—"}</span>
                <span className="text-sm text-muted-foreground truncate">{r.siteName ?? "—"}</span>
                <span className="text-sm text-muted-foreground text-right whitespace-nowrap">{safeDate(r.reportedDate, "d MMM yyyy")}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detail sheet */}
      <Sheet open={selectedId !== null} onOpenChange={(o) => { if (!o) { setSelectedId(null); setEditingLeadership(false); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedReport && (
            <div className="space-y-5">
              <SheetHeader>
                <div className="flex items-start justify-between gap-2 pr-8">
                  <SheetTitle className="text-lg leading-snug">{selectedReport.description}</SheetTitle>
                  <div className="flex gap-1 shrink-0 mt-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Edit report"
                      onClick={() => openEdit(selectedReport)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Delete report"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete condition report?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this report and cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(selectedReport.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {statusBadge(selectedReport.status)}
                  {selectedReport.immediateActionRequired && <Badge className="bg-red-100 text-red-700 border-0">Immediate Action Required</Badge>}
                </div>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Date</p>
                  <p>{safeDate(selectedReport.reportedDate, "d MMMM yyyy")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Reported By</p>
                  <p>{selectedReport.staffName ?? "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Location</p>
                  <p>{selectedReport.siteName ?? "—"}</p>
                </div>
              </div>

              <Separator />

              <div className="text-sm space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Action Taken to Reduce Risk</p>
                  <p className={selectedReport.actionTaken ? "" : "italic text-muted-foreground"}>
                    {selectedReport.actionTaken ?? "No action recorded"}
                  </p>
                </div>
                {selectedReport.evidenceDocumentPath && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Evidence</p>
                    <a
                      href={`/api/objects/${selectedReport.evidenceDocumentPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {selectedReport.evidenceDocumentName ?? "View attachment"}
                    </a>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Leadership Notes</p>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Admin / Ed. Leader</Badge>
                </div>
                {editingLeadership ? (
                  <div className="space-y-2">
                    <Textarea
                      value={leadershipNotes}
                      onChange={(e) => setLeadershipNotes(e.target.value)}
                      placeholder="Add leadership review notes, follow-up actions, or risk assessment…"
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveLeadershipNotes} disabled={updateMutation.isPending}>Save Notes</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingLeadership(false); setLeadershipNotes(selectedReport.leadershipNotes ?? ""); }}>Cancel</Button>
                    </div>
                  </div>
                ) : selectedReport.leadershipNotes ? (
                  <div className="space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{selectedReport.leadershipNotes}</p>
                    <Button size="sm" variant="outline" onClick={() => setEditingLeadership(true)}>Edit Notes</Button>
                  </div>
                ) : (
                  <div className="p-3 rounded-md border border-dashed text-sm text-muted-foreground space-y-2">
                    <p className="italic">No leadership notes added yet.</p>
                    <Button size="sm" variant="outline" onClick={() => setEditingLeadership(true)}>Add Notes</Button>
                  </div>
                )}
              </div>

              {selectedReport.status === "open" && (
                <>
                  <Separator />
                  <Button className="w-full" variant="outline" onClick={handleResolve} disabled={updateMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Resolved
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
