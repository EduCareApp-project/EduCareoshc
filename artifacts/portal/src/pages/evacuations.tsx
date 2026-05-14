import { useRef, useState } from "react";
import { useListEvacuations, useCreateEvacuation, useListSites } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ShieldAlert, Plus, AlertCircle, CheckCircle, Clock, Paperclip, Upload, X, FileText, Users,
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
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <AlertCircle className="h-3 w-3" />
        Expired {Math.abs(days)}d ago
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <AlertCircle className="h-3 w-3" />
        Expires today
      </span>
    );
  }
  if (days <= 14) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        <Clock className="h-3 w-3" />
        {days}d remaining
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
      <CheckCircle className="h-3 w-3" />
      {days}d remaining
    </span>
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

const EMPTY_FORM = {
  drillType: "evacuation",
  conductedDate: melbourneDateStr(),
  conductedTime: "09:00",
  notes: "",
  conductedBy: "",
  siteId: "",
};

export default function Evacuations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { upload, uploading } = useUpload();

  const { data: evacuations, isLoading } = useListEvacuations();
  const { data: sites } = useListSites();
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
        evacDocPath = await upload(evacFile, { prefix: "evacuation-records/" });
        evacDocName = evacFile.name;
      }
      if (attendFile) {
        attendDocPath = await upload(attendFile, { prefix: "evacuation-records/" });
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

  // Split into current (nextDueAt in future or null) and expired, each newest-first
  const now = new Date();
  const current = filtered
    .filter((e) => !e.nextDueAt || new Date(e.nextDueAt) >= now)
    .sort((a, b) => new Date(b.conductedAt).getTime() - new Date(a.conductedAt).getTime());
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
                <Input value={form.conductedBy} onChange={(e) => setForm({ ...form, conductedBy: e.target.value })} />
              </div>

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
        <div className="space-y-6">
          {/* Current records */}
          {current.length > 0 && (
            <div className="space-y-3">
              {expired.length > 0 && (
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Current</h2>
              )}
              {current.map((evac) => <DrillCard key={evac.id} evac={evac} />)}
            </div>
          )}
          {/* Expired records */}
          {expired.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Expired</h2>
              {expired.map((evac) => <DrillCard key={evac.id} evac={evac} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrillCard({ evac }: { evac: NonNullable<ReturnType<typeof useListEvacuations>["data"]>[number] }) {
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
          <ExpiryBadge nextDueAt={evac.nextDueAt} />
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
