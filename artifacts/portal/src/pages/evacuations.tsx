import { useRef, useState } from "react";
import { useListEvacuations, useCreateEvacuation, useUpdateEvacuation, useListSites, useListStaff } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ShieldAlert, Plus, AlertCircle, CheckCircle, Clock, Paperclip, Upload, X, FileText, Users, Pencil,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";
import { melbourneDateStr } from "@/lib/timezone";

const DRILL_LABELS: Record<string, string> = {
  evacuation: "Evacuation",
  lockdown: "Lockdown",
  shelter_in_place: "Shelter in Place",
  other: "Other",
};

function ExpiryBadge({ nextDueAt }: { nextDueAt: string | null | undefined }) {
  if (!nextDueAt) return null;
  const days = differenceInDays(new Date(nextDueAt), new Date());

  if (days < 0) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 min-w-[110px]">
        <span className="text-4xl font-bold leading-none text-red-700">{Math.abs(days)}</span>
        <div className="flex flex-col leading-tight text-red-600">
          <span className="text-xs font-semibold">days</span>
          <span className="text-xs font-semibold">overdue</span>
        </div>
      </div>
    );
  }
  if (days === 0) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 min-w-[110px]">
        <AlertCircle className="h-7 w-7 text-red-600 shrink-0" />
        <div className="flex flex-col leading-tight text-red-600">
          <span className="text-xs font-semibold">expires</span>
          <span className="text-xs font-semibold">today</span>
        </div>
      </div>
    );
  }
  if (days <= 14) {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 min-w-[110px]">
        <span className="text-4xl font-bold leading-none text-amber-700">{days}</span>
        <div className="flex flex-col leading-tight text-amber-600">
          <span className="text-xs font-semibold">days</span>
          <span className="text-xs font-semibold">remaining</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 min-w-[110px]">
      <span className="text-4xl font-bold leading-none text-green-700">{days}</span>
      <div className="flex flex-col leading-tight text-green-600">
        <span className="text-xs font-semibold">days</span>
        <span className="text-xs font-semibold">remaining</span>
      </div>
    </div>
  );
}

function FileUploadField({
  label,
  icon: Icon,
  file,
  existingName,
  inputRef,
  onSelect,
  onRemove,
}: {
  label: string;
  icon: React.ElementType;
  file: File | null;
  existingName?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (f: File) => void;
  onRemove: () => void;
}) {
  const display = file?.name ?? existingName ?? null;
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </Label>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f); }}
      />
      {display ? (
        <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/40 text-sm">
          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate">{display}</span>
          <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 w-full p-3 rounded-md border border-dashed text-sm text-muted-foreground hover:bg-muted/40 hover:border-primary/40 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Click to upload
        </button>
      )}
    </div>
  );
}

const VALID_DAYS_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "6 months (180 days)", value: 180 },
  { label: "12 months (365 days)", value: 365 },
  { label: "2 years (730 days)", value: 730 },
];

const EMPTY_FORM = {
  drillType: "evacuation",
  conductedDate: melbourneDateStr(),
  conductedTime: "09:00",
  notes: "",
  conductedBy: "",
  siteId: "",
  validDays: 365,
};

export default function Evacuations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { uploadFile, isUploading: uploading } = useUpload();

  const { data: evacuations, isLoading } = useListEvacuations();
  const { data: sites } = useListSites();
  const { data: staff } = useListStaff();
  const createMutation = useCreateEvacuation();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filterSiteId, setFilterSiteId] = useState<string>("__all__");

  const evacFileRef = useRef<HTMLInputElement>(null);
  const attendFileRef = useRef<HTMLInputElement>(null);
  const [evacFile, setEvacFile] = useState<File | null>(null);
  const [attendFile, setAttendFile] = useState<File | null>(null);

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEvacFile(null);
    setAttendFile(null);
    if (evacFileRef.current) evacFileRef.current.value = "";
    if (attendFileRef.current) attendFileRef.current.value = "";
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    // Upload documents first
    let evacDocPath = "";
    let evacDocName = "";
    let attendDocPath = "";
    let attendDocName = "";

    try {
      if (evacFile) {
        const res = await uploadFile(evacFile);
        if (!res) throw new Error("Upload returned null");
        evacDocPath = res.objectPath;
        evacDocName = evacFile.name;
      }
      if (attendFile) {
        const res = await uploadFile(attendFile);
        if (!res) throw new Error("Upload returned null");
        attendDocPath = res.objectPath;
        attendDocName = attendFile.name;
      }
    } catch {
      toast({ title: "File upload failed", variant: "destructive" });
      return;
    }

    const conductedAt = new Date(`${form.conductedDate}T${form.conductedTime}`).toISOString();

    const data: Record<string, unknown> = {
      drillType: form.drillType,
      conductedAt,
    };
    if (form.siteId) data.siteId = Number(form.siteId);
    if (form.notes) data.notes = form.notes;
    if (form.conductedBy) data.conductedBy = form.conductedBy;
    if (form.drillType !== "evacuation") data.validDays = form.validDays;
    if (evacDocPath) { data.evacuationDocPath = evacDocPath; data.evacuationDocName = evacDocName; }
    if (attendDocPath) { data.attendanceDocPath = attendDocPath; data.attendanceDocName = attendDocName; }

    createMutation.mutate({ data: data as any }, {
      onSuccess: () => {
        setOpen(false);
        resetForm();
        queryClient.invalidateQueries({ queryKey: ["/api/evacuations"] });
        toast({ title: "Drill record saved" });
      },
      onError: () => toast({ title: "Failed to save drill record", variant: "destructive" }),
    });
  }

  // Filtered list
  const filtered = (evacuations ?? []).filter((e) =>
    filterSiteId === "__all__" || String(e.siteId) === filterSiteId
  );

  // Split into current (nextDueAt in future or null) and expired
  // Evacuation drills always sort to the top; within same type, newest-first
  const now = new Date();
  const current = filtered
    .filter((e) => !e.nextDueAt || new Date(e.nextDueAt) >= now)
    .sort((a, b) => {
      const aIsEvac = a.drillType === "evacuation" ? 0 : 1;
      const bIsEvac = b.drillType === "evacuation" ? 0 : 1;
      if (aIsEvac !== bIsEvac) return aIsEvac - bIsEvac;
      return new Date(b.conductedAt).getTime() - new Date(a.conductedAt).getTime();
    });
  const expired = filtered
    .filter((e) => e.nextDueAt && new Date(e.nextDueAt) < now)
    .sort((a, b) => new Date(b.conductedAt).getTime() - new Date(a.conductedAt).getTime());

  // Status banner: most recent evacuation drill in current filter
  const mostRecent = filtered.find((e) => e.drillType === "evacuation");
  const nextDue = mostRecent?.nextDueAt ? new Date(mostRecent.nextDueAt) : null;
  const daysUntilDue = nextDue ? differenceInDays(nextDue, now) : null;

  const bannerColor = daysUntilDue === null
    ? "bg-slate-100 border-slate-200 text-slate-700"
    : daysUntilDue < 0 ? "bg-red-50 border-red-200 text-red-800"
    : daysUntilDue < 30 ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-green-50 border-green-200 text-green-800";
  const BannerIcon = daysUntilDue === null ? Clock : daysUntilDue < 0 ? AlertCircle : CheckCircle;

  const isSaving = createMutation.isPending || uploading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety Evacuation</h1>
          <p className="text-muted-foreground mt-1">Track evacuation drills and upload required records. Evacuation drills are required every 90 days.</p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Log Drill</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log Safety Drill</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pb-2">

              <div className="space-y-1.5">
                <Label>Drill Type</Label>
                <Select value={form.drillType} onValueChange={(v) => setForm({ ...form, drillType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evacuation">Evacuation</SelectItem>
                    <SelectItem value="lockdown">Lockdown</SelectItem>
                    <SelectItem value="shelter_in_place">Shelter in Place</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Site <span className="text-destructive">*</span></Label>
                <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v })} required>
                  <SelectTrigger><SelectValue placeholder="Select site…" /></SelectTrigger>
                  <SelectContent>
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date Conducted <span className="text-destructive">*</span></Label>
                  <input
                    type="date"
                    value={form.conductedDate}
                    onChange={(e) => setForm({ ...form, conductedDate: e.target.value })}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <input
                    type="time"
                    value={form.conductedTime}
                    onChange={(e) => setForm({ ...form, conductedTime: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Conducted By</Label>
                <Select value={form.conductedBy || "__none__"} onValueChange={(v) => setForm({ ...form, conductedBy: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Not specified —</SelectItem>
                    {(staff ?? [])
                      .filter((s) => s.status === "active")
                      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                      .map((s) => (
                        <SelectItem key={s.id} value={`${s.firstName} ${s.lastName}`}>
                          {s.firstName} {s.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {form.drillType !== "evacuation" && (
                <div className="space-y-1.5">
                  <Label>Valid for <span className="text-destructive">*</span></Label>
                  <Select value={String(form.validDays)} onValueChange={(v) => setForm({ ...form, validDays: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VALID_DAYS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">How long this drill record remains active before being archived.</p>
                </div>
              )}
              {form.drillType === "evacuation" && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                  Evacuation drills are automatically valid for <strong>90 days</strong> per the National Law requirement.
                </p>
              )}

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Upload Records</p>
                <FileUploadField
                  label="Record of Evacuation"
                  icon={FileText}
                  file={evacFile}
                  inputRef={evacFileRef}
                  onSelect={setEvacFile}
                  onRemove={() => { setEvacFile(null); if (evacFileRef.current) evacFileRef.current.value = ""; }}
                />
                <FileUploadField
                  label="Record of Children's Attendance"
                  icon={Users}
                  file={attendFile}
                  inputRef={attendFileRef}
                  onSelect={setAttendFile}
                  onRemove={() => { setAttendFile(null); if (attendFileRef.current) attendFileRef.current.value = ""; }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" disabled={isSaving || !form.siteId}>
                  {uploading ? "Uploading…" : isSaving ? "Saving…" : "Save Record"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status banner */}
      <div className={`border rounded-lg p-4 flex items-center gap-4 ${bannerColor}`}>
        <BannerIcon className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">
            {daysUntilDue === null ? "No evacuation drills recorded yet"
              : daysUntilDue < 0 ? `Evacuation drill overdue by ${Math.abs(daysUntilDue)} days`
              : daysUntilDue === 0 ? "Evacuation drill due today"
              : `Next evacuation drill due in ${daysUntilDue} days`}
          </p>
          <p className="text-sm opacity-80">
            {mostRecent
              ? `Last conducted: ${format(new Date(mostRecent.conductedAt), "d MMM yyyy")}${mostRecent.siteName ? ` at ${mostRecent.siteName}` : ""}`
              : "Log your first drill to start tracking"}
            {nextDue ? ` • Records expire: ${format(nextDue, "d MMM yyyy")}` : ""}
          </p>
        </div>
      </div>

      {/* Site filter */}
      {(sites ?? []).length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filter by site</span>
          <Select value={filterSiteId} onValueChange={setFilterSiteId}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Sites</SelectItem>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Record list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground flex flex-col items-center gap-2">
            <ShieldAlert className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p className="font-medium">No drills recorded yet</p>
            <p className="text-sm">Use the button above to log a drill and upload the required records.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active records */}
          {current.length > 0 && (
            <div className="space-y-3">
              {expired.length > 0 && (
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Active Drills</h2>
              )}
              {current.map((evac) => <DrillCard key={evac.id} evac={evac} sites={sites ?? []} staff={staff ?? []} />)}
            </div>
          )}
          {/* Archived records */}
          {expired.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Archived</h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{expired.length} record{expired.length !== 1 ? "s" : ""}</span>
              </div>
              {expired.map((evac) => <DrillCard key={evac.id} evac={evac} sites={sites ?? []} staff={staff ?? []} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type EvacRecord = NonNullable<ReturnType<typeof useListEvacuations>["data"]>[number];
type SiteItem = NonNullable<ReturnType<typeof useListSites>["data"]>[number];
type StaffItem = NonNullable<ReturnType<typeof useListStaff>["data"]>[number];

function DrillCard({ evac, sites, staff }: { evac: EvacRecord; sites: SiteItem[]; staff: StaffItem[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { uploadFile, isUploading: uploading } = useUpload();
  const updateMutation = useUpdateEvacuation();

  const { canEditAfterSubmit } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);

  const conductedDate = evac.conductedAt ? format(new Date(evac.conductedAt), "yyyy-MM-dd") : melbourneDateStr();
  const conductedTime = evac.conductedAt ? format(new Date(evac.conductedAt), "HH:mm") : "09:00";

  const [form, setForm] = useState({
    drillType: evac.drillType ?? "evacuation",
    conductedDate,
    conductedTime,
    siteId: evac.siteId ? String(evac.siteId) : "",
    conductedBy: evac.conductedBy ?? "",
    notes: evac.notes ?? "",
    validDays: 365,
  });

  const evacFileRef = useRef<HTMLInputElement>(null);
  const attendFileRef = useRef<HTMLInputElement>(null);
  const [evacFile, setEvacFile] = useState<File | null>(null);
  const [attendFile, setAttendFile] = useState<File | null>(null);

  function openEdit() {
    setForm({
      drillType: evac.drillType ?? "evacuation",
      conductedDate,
      conductedTime,
      siteId: evac.siteId ? String(evac.siteId) : "",
      conductedBy: evac.conductedBy ?? "",
      notes: evac.notes ?? "",
      validDays: 365,
    });
    setEvacFile(null);
    setAttendFile(null);
    setEditOpen(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    let evacDocPath = evac.evacuationDocPath ?? "";
    let evacDocName = evac.evacuationDocName ?? "";
    let attendDocPath = evac.attendanceDocPath ?? "";
    let attendDocName = evac.attendanceDocName ?? "";

    try {
      if (evacFile) {
        const res = await uploadFile(evacFile);
        if (!res) throw new Error("Upload returned null");
        evacDocPath = res.objectPath; evacDocName = evacFile.name;
      }
      if (attendFile) {
        const res = await uploadFile(attendFile);
        if (!res) throw new Error("Upload returned null");
        attendDocPath = res.objectPath; attendDocName = attendFile.name;
      }
    } catch {
      toast({ title: "File upload failed", variant: "destructive" }); return;
    }

    const conductedAt = new Date(`${form.conductedDate}T${form.conductedTime}`).toISOString();
    const data: Record<string, unknown> = { drillType: form.drillType, conductedAt };
    if (form.siteId) data.siteId = Number(form.siteId);
    if (form.notes) data.notes = form.notes;
    if (form.conductedBy) data.conductedBy = form.conductedBy;
    if (form.drillType !== "evacuation") data.validDays = form.validDays;
    if (evacDocPath) { data.evacuationDocPath = evacDocPath; data.evacuationDocName = evacDocName; }
    if (attendDocPath) { data.attendanceDocPath = attendDocPath; data.attendanceDocName = attendDocName; }

    updateMutation.mutate({ id: evac.id, data: data as any }, {
      onSuccess: () => {
        setEditOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/evacuations"] });
        toast({ title: "Record updated" });
      },
      onError: () => toast({ title: "Failed to update record", variant: "destructive" }),
    });
  }

  const isSaving = updateMutation.isPending || uploading;
  const hasEvacDoc = !!evac.evacuationDocPath;
  const hasAttendDoc = !!evac.attendanceDocPath;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{DRILL_LABELS[evac.drillType] ?? evac.drillType}</span>
              {evac.siteName && (
                <Badge variant="outline" className="text-xs font-normal">{evac.siteName}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(evac.conductedAt), "d MMMM yyyy 'at' h:mm a")}
              {evac.conductedBy && ` • ${evac.conductedBy}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEditAfterSubmit && <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={openEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Drill Record</DialogTitle></DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4 pb-2">
                  <div className="space-y-1.5">
                    <Label>Drill Type</Label>
                    <Select value={form.drillType} onValueChange={(v) => setForm({ ...form, drillType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="evacuation">Evacuation</SelectItem>
                        <SelectItem value="lockdown">Lockdown</SelectItem>
                        <SelectItem value="shelter_in_place">Shelter in Place</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Site</Label>
                    <Select value={form.siteId || "__none__"} onValueChange={(v) => setForm({ ...form, siteId: v === "__none__" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select site…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Not specified —</SelectItem>
                        {sites.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date Conducted</Label>
                      <input type="date" value={form.conductedDate} onChange={(e) => setForm({ ...form, conductedDate: e.target.value })} required
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Time</Label>
                      <input type="time" value={form.conductedTime} onChange={(e) => setForm({ ...form, conductedTime: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Conducted By</Label>
                    <Select value={form.conductedBy || "__none__"} onValueChange={(v) => setForm({ ...form, conductedBy: v === "__none__" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Not specified —</SelectItem>
                        {staff.filter((s) => s.status === "active").sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)).map((s) => (
                          <SelectItem key={s.id} value={`${s.firstName} ${s.lastName}`}>{s.firstName} {s.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.drillType !== "evacuation" && (
                    <div className="space-y-1.5">
                      <Label>Valid for</Label>
                      <Select value={String(form.validDays)} onValueChange={(v) => setForm({ ...form, validDays: Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VALID_DAYS_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {form.drillType === "evacuation" && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2">
                      Evacuation drills are automatically valid for <strong>90 days</strong>.
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Upload Records</p>
                    <FileUploadField label="Record of Evacuation" icon={FileText} file={evacFile} existingName={evac.evacuationDocName ?? undefined}
                      inputRef={evacFileRef} onSelect={setEvacFile} onRemove={() => { setEvacFile(null); if (evacFileRef.current) evacFileRef.current.value = ""; }} />
                    <FileUploadField label="Record of Children's Attendance" icon={Users} file={attendFile} existingName={evac.attendanceDocName ?? undefined}
                      inputRef={attendFileRef} onSelect={setAttendFile} onRemove={() => { setAttendFile(null); if (attendFileRef.current) attendFileRef.current.value = ""; }} />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSaving}>
                      {uploading ? "Uploading…" : isSaving ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>}
            <ExpiryBadge nextDueAt={evac.nextDueAt} />
          </div>
        </div>

        {evac.notes && <p className="text-xs text-muted-foreground italic">{evac.notes}</p>}

        {(hasEvacDoc || hasAttendDoc) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {hasEvacDoc && (
              <a href={`/api/objects/${evac.evacuationDocPath}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-4 bg-primary/5 border border-primary/20 rounded-md px-2.5 py-1.5">
                <FileText className="h-3.5 w-3.5" />{evac.evacuationDocName ?? "Evacuation Record"}
              </a>
            )}
            {hasAttendDoc && (
              <a href={`/api/objects/${evac.attendanceDocPath}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-4 bg-primary/5 border border-primary/20 rounded-md px-2.5 py-1.5">
                <Users className="h-3.5 w-3.5" />{evac.attendanceDocName ?? "Attendance Record"}
              </a>
            )}
          </div>
        )}

        {(!hasEvacDoc || !hasAttendDoc) && (
          <div className="flex flex-wrap gap-2">
            {!hasEvacDoc && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                <Paperclip className="h-3 w-3" />Evacuation record not uploaded
              </span>
            )}
            {!hasAttendDoc && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                <Paperclip className="h-3 w-3" />Attendance record not uploaded
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
