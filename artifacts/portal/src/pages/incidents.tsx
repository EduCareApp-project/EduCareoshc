import { useState } from "react";
import {
  useListIncidents, useCreateIncident, useUpdateIncident,
  useListChildren, useListStaff, useListSites,
  getListIncidentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle, Plus, Edit, CheckCircle2, Circle, Building2, User, Calendar,
  ClipboardList, Shield, BookOpen, Paperclip, ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(inc: any) {
  if (inc.archived) return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Archived</Badge>;
  const hasReview = inc.reviewNotes || inc.checkInFamily;
  const hasRegulatory = inc.regulatoryNotifyRequired !== null && inc.regulatoryNotifyRequired !== undefined;
  const hasHeadOffice = inc.reportMadeAt;
  if (hasReview) return <Badge className="bg-green-100 text-green-800 border-green-200">Reviewed</Badge>;
  if (hasRegulatory) return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Regulatory Done</Badge>;
  if (hasHeadOffice) return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Reported</Badge>;
  return <Badge className="bg-red-100 text-red-800 border-red-200">Open</Badge>;
}

function fmt(dt: string | null | undefined) {
  if (!dt) return "—";
  try { return format(new Date(dt), "d MMM yyyy, h:mm a"); } catch { return dt; }
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d.slice(0, 10) + "T00:00:00"), "d MMM yyyy"); } catch { return d; }
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function TierSection({
  icon, title, badge, children, editButton, defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  editButton?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="font-semibold text-sm flex-1">{title}</span>
        {badge}
        {editButton && <span onClick={(e) => e.stopPropagation()}>{editButton}</span>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 text-sm">{children}</div>}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={value ? "leading-relaxed" : "text-muted-foreground italic"}>{value ?? "Not provided"}</p>
    </div>
  );
}

// ── Log Incident form ────────────────────────────────────────────────────────
function LogIncidentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateIncident();
  const { data: children } = useListChildren();
  const { data: staff } = useListStaff();
  const { data: sites } = useListSites();

  const [form, setForm] = useState({
    incidentDatetime: "", siteId: "none", childId: "none",
    respondentId: "none", description: "", firstAidProvided: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      data: {
        childId: parseInt(form.childId),
        incidentDatetime: form.incidentDatetime || undefined,
        siteId: form.siteId !== "none" ? parseInt(form.siteId) : null,
        respondentId: form.respondentId !== "none" ? parseInt(form.respondentId) : null,
        description: form.description,
        firstAidProvided: form.firstAidProvided || null,
      } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
        toast({ title: "Incident logged" });
        onOpenChange(false);
        setForm({ incidentDatetime: "", siteId: "none", childId: "none", respondentId: "none", description: "", firstAidProvided: "" });
      },
      onError: () => toast({ title: "Failed to log incident", variant: "destructive" }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Log Incident</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Date &amp; Time of Incident</Label>
              <Input type="datetime-local" value={form.incidentDatetime} onChange={(e) => setForm({ ...form, incidentDatetime: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Site</Label>
              <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No site</SelectItem>
                  {(sites ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Child <span className="text-destructive">*</span></Label>
              <Select value={form.childId} onValueChange={(v) => setForm({ ...form, childId: v })} required>
                <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                <SelectContent>
                  {(children ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Respondent (First Aid Provider)</Label>
              <Select value={form.respondentId} onValueChange={(v) => setForm({ ...form, respondentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {(staff ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description <span className="text-destructive">*</span></Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} required placeholder="Describe what happened..." />
          </div>
          <div className="space-y-1">
            <Label>First Aid Provided</Label>
            <Textarea value={form.firstAidProvided} onChange={(e) => setForm({ ...form, firstAidProvided: e.target.value })} rows={2} placeholder="Describe any first aid given..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || form.childId === "none"}>Log Incident</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Head Office edit form ───────────────────────────────────────────────────
function HeadOfficeForm({ incident, onDone }: { incident: any; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateIncident();
  const { data: staff } = useListStaff();

  const [reportPersonId, setReportPersonId] = useState(incident.reportPersonId ? String(incident.reportPersonId) : "none");
  const [reportMethod, setReportMethod] = useState(incident.reportMethod ?? "");
  const [reportMadeAt, setReportMadeAt] = useState(
    incident.reportMadeAt ? incident.reportMadeAt.slice(0, 16) : ""
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      id: incident.id,
      data: {
        reportPersonId: reportPersonId !== "none" ? parseInt(reportPersonId) : null,
        reportMethod: reportMethod || null,
        reportMadeAt: reportMadeAt || null,
      } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
        toast({ title: "Head Office report saved" });
        onDone();
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>Person Making Report</Label>
        <Select value={reportPersonId} onValueChange={setReportPersonId}>
          <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Not specified</SelectItem>
            {(staff ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Method</Label>
        <Input value={reportMethod} onChange={(e) => setReportMethod(e.target.value)} placeholder="e.g. Phone, Email, In person" />
      </div>
      <div className="space-y-1">
        <Label>Date &amp; Time Report Made</Label>
        <Input type="datetime-local" value={reportMadeAt} onChange={(e) => setReportMadeAt(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={updateMutation.isPending}>Save</Button>
      </div>
    </form>
  );
}

// ── Regulatory edit form ─────────────────────────────────────────────────────
function RegulatoryForm({ incident, onDone }: { incident: any; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateIncident();

  const [required, setRequired] = useState<boolean>(incident.regulatoryNotifyRequired ?? false);
  const [notifiedAt, setNotifiedAt] = useState(incident.regulatoryNotifiedAt ? String(incident.regulatoryNotifiedAt).slice(0, 10) : "");
  const [notifId, setNotifId] = useState(incident.notificationId ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      id: incident.id,
      data: {
        regulatoryNotifyRequired: required,
        regulatoryNotifiedAt: required && notifiedAt ? notifiedAt : null,
        notificationId: required && notifId ? notifId : null,
      } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
        toast({ title: "Regulatory details saved" });
        onDone();
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Regulatory Authority Notification Required</p>
        </div>
        <Switch checked={required} onCheckedChange={setRequired} />
      </div>
      {required && (
        <>
          <div className="space-y-1">
            <Label>Date Notified</Label>
            <Input type="date" value={notifiedAt} onChange={(e) => setNotifiedAt(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Notification ID (NOT ID)</Label>
            <Input value={notifId} onChange={(e) => setNotifId(e.target.value)} placeholder="Enter notification ID" />
          </div>
        </>
      )}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={updateMutation.isPending}>Save</Button>
      </div>
    </form>
  );
}

// ── Review edit form ─────────────────────────────────────────────────────────
function ReviewForm({ incident, onDone }: { incident: any; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateIncident();

  const [reviewNotes, setReviewNotes] = useState(incident.reviewNotes ?? "");
  const [checkInFamily, setCheckInFamily] = useState(incident.checkInFamily ?? "");
  const [archived, setArchived] = useState(incident.archived ?? false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate({
      id: incident.id,
      data: { reviewNotes: reviewNotes || null, checkInFamily: checkInFamily || null, archived } as any,
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
        toast({ title: "Review saved" });
        onDone();
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>Internal Review Notes</Label>
        <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} placeholder="Internal notes about this incident..." />
      </div>
      <div className="space-y-1">
        <Label>Check In with Family</Label>
        <Textarea value={checkInFamily} onChange={(e) => setCheckInFamily(e.target.value)} rows={2} placeholder="Notes about family communication..." />
      </div>
      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <p className="text-sm font-medium">Archive this incident</p>
        <Switch checked={archived} onCheckedChange={setArchived} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancel</Button>
        <Button type="submit" size="sm" disabled={updateMutation.isPending}>Save</Button>
      </div>
    </form>
  );
}

// ── Incident detail panel ────────────────────────────────────────────────────
function IncidentDetail({ incident }: { incident: any }) {
  const [editingHeadOffice, setEditingHeadOffice] = useState(false);
  const [editingRegulatory, setEditingRegulatory] = useState(false);
  const [editingReview, setEditingReview] = useState(false);

  const hasHeadOffice = !!(incident.reportMadeAt || incident.reportMethod || incident.reportPersonId);
  const hasRegulatory = incident.regulatoryNotifyRequired !== null && incident.regulatoryNotifyRequired !== undefined;
  const hasReview = !!(incident.reviewNotes || incident.checkInFamily);

  const editBtn = (label: string, onClick: () => void) => (
    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2" onClick={onClick}>
      <Edit className="h-3 w-3" />{label}
    </Button>
  );

  return (
    <div className="space-y-3">
      {/* Tier 1 — Incident */}
      <TierSection
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Incident Details"
        badge={statusBadge(incident)}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date & Time" value={incident.incidentDatetime ? fmt(incident.incidentDatetime) : undefined} />
          <Field label="Site" value={incident.siteName} />
          <Field label="Child" value={incident.childName} />
          <Field label="Respondent" value={incident.respondentName} />
        </div>
        <Separator />
        <Field label="Description" value={incident.description} />
        {incident.firstAidProvided && <Field label="First Aid Provided" value={incident.firstAidProvided} />}
        {incident.attachmentPath && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Attachment</p>
            <a href={incident.attachmentPath} target="_blank" rel="noopener noreferrer" className="text-primary text-sm flex items-center gap-1 underline">
              <Paperclip className="h-3.5 w-3.5" />View file
            </a>
          </div>
        )}
      </TierSection>

      {/* Tier 2 — Head Office */}
      <TierSection
        icon={<ClipboardList className="h-4 w-4" />}
        title="Head Office Report"
        defaultOpen={hasHeadOffice || editingHeadOffice}
        editButton={!editingHeadOffice ? editBtn(hasHeadOffice ? "Edit" : "Add Report", () => setEditingHeadOffice(true)) : undefined}
        badge={hasHeadOffice ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      >
        {editingHeadOffice ? (
          <HeadOfficeForm incident={incident} onDone={() => setEditingHeadOffice(false)} />
        ) : hasHeadOffice ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Person Making Report" value={incident.reportPersonName} />
            <Field label="Method" value={incident.reportMethod} />
            <Field label="Date Report Made" value={incident.reportMadeAt ? fmt(incident.reportMadeAt) : undefined} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">No head office report recorded yet.</p>
        )}
      </TierSection>

      {/* Tier 3 — Regulatory */}
      <TierSection
        icon={<Shield className="h-4 w-4" />}
        title="Regulatory Authority"
        defaultOpen={hasRegulatory || editingRegulatory}
        editButton={!editingRegulatory ? editBtn(hasRegulatory ? "Edit" : "Add", () => setEditingRegulatory(true)) : undefined}
        badge={hasRegulatory ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      >
        {editingRegulatory ? (
          <RegulatoryForm incident={incident} onDone={() => setEditingRegulatory(false)} />
        ) : hasRegulatory ? (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Notification Required"
              value={incident.regulatoryNotifyRequired ? "Yes" : "No"}
            />
            {incident.regulatoryNotifyRequired && (
              <>
                <Field label="Date Notified" value={fmtDate(incident.regulatoryNotifiedAt)} />
                <Field label="NOT ID" value={incident.notificationId} />
              </>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">Regulatory notification status not recorded.</p>
        )}
      </TierSection>

      {/* Tier 4 — Review */}
      <TierSection
        icon={<BookOpen className="h-4 w-4" />}
        title="Review"
        defaultOpen={hasReview || editingReview}
        editButton={!editingReview ? editBtn(hasReview ? "Edit" : "Add Review", () => setEditingReview(true)) : undefined}
        badge={hasReview ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      >
        {editingReview ? (
          <ReviewForm incident={incident} onDone={() => setEditingReview(false)} />
        ) : hasReview ? (
          <>
            {incident.reviewNotes && <Field label="Internal Review Notes" value={incident.reviewNotes} />}
            {incident.checkInFamily && <Field label="Check In with Family" value={incident.checkInFamily} />}
            {incident.archived && <Badge className="bg-gray-100 text-gray-700">Archived</Badge>}
          </>
        ) : (
          <p className="text-muted-foreground text-sm italic">No review completed yet.</p>
        )}
      </TierSection>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Incidents() {
  const { data: incidents, isLoading } = useListIncidents();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const selectedIncident = (incidents ?? []).find((i) => i.id === selected);
  const active = (incidents ?? []).filter((i) => !i.archived);
  const archived = (incidents ?? []).filter((i) => i.archived);
  const [showArchived, setShowArchived] = useState(false);

  const displayed = showArchived ? [...active, ...archived] : active;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Incident Log</h1>
          <p className="text-muted-foreground mt-1">Record, manage, and review incidents across all stages.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Log Incident
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (incidents ?? []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p>No incidents recorded. Use the button above to log one.</p>
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <div className="divide-y">
              {displayed.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 flex items-center gap-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelected(inc.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium text-sm">{inc.childName ?? "Unknown child"}</span>
                      {statusBadge(inc)}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {inc.incidentDatetime && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />{fmt(inc.incidentDatetime)}
                        </span>
                      )}
                      {inc.siteName && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{inc.siteName}
                        </span>
                      )}
                      {inc.respondentName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{inc.respondentName}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Tier completion indicators */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {[
                      { done: !!(inc.reportMadeAt), label: "HO" },
                      { done: inc.regulatoryNotifyRequired !== null && inc.regulatoryNotifyRequired !== undefined, label: "RA" },
                      { done: !!(inc.reviewNotes || inc.checkInFamily), label: "RV" },
                    ].map(({ done, label }) => (
                      <span key={label} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {archived.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)} className="text-muted-foreground">
              {showArchived ? "Hide" : "Show"} {archived.length} archived incident{archived.length !== 1 ? "s" : ""}
            </Button>
          )}
        </>
      )}

      <LogIncidentDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedIncident && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selectedIncident.childName ?? "Incident"}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Logged {format(new Date(selectedIncident.createdAt), "d MMM yyyy 'at' h:mm a")}
                </p>
              </SheetHeader>
              <IncidentDetail key={selectedIncident.id} incident={selectedIncident} />
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
