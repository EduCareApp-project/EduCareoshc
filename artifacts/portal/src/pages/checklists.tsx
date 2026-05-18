import { useState, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/contexts/auth";
import { melbourneDate, melbourneDateStr } from "@/lib/timezone";
import {
  useListChecklistTemplates, useCreateChecklistTemplate, useUpdateChecklistTemplate, useDeleteChecklistTemplate,
  useListChecklistRoutines, useCreateChecklistRoutine, useUpdateChecklistRoutine, useDeleteChecklistRoutine,
  useListRoutineItemCompletions, useCreateRoutineItemCompletion, useDeleteRoutineItemCompletion,
  useListStaff, useListSites,
  getListChecklistTemplatesQueryKey, getListChecklistRoutinesQueryKey, getListRoutineItemCompletionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CheckSquare, Plus, Trash2, Edit, CalendarClock, X, GripVertical, RefreshCw,
  ChevronLeft, ChevronRight, Play, User,
} from "lucide-react";
import {
  format, addDays, addWeeks, addMonths, addYears,
  startOfISOWeek, endOfISOWeek,
} from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_TYPES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "term", label: "Term" },
  { value: "annual", label: "Annual" },
] as const;

type TemplateType = "daily" | "weekly" | "monthly" | "term" | "annual";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
];

const MONTHS = [
  { value: 1, label: "Jan" }, { value: 2, label: "Feb" }, { value: 3, label: "Mar" },
  { value: 4, label: "Apr" }, { value: 5, label: "May" }, { value: 6, label: "Jun" },
  { value: 7, label: "Jul" }, { value: 8, label: "Aug" }, { value: 9, label: "Sep" },
  { value: 10, label: "Oct" }, { value: 11, label: "Nov" }, { value: 12, label: "Dec" },
];

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "term", label: "Each Term" },
  { value: "annual", label: "Annual" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Period helpers
// ─────────────────────────────────────────────────────────────────────────────

function getPeriodKey(date: Date, frequency: string): string {
  switch (frequency) {
    case "daily": return format(date, "yyyy-MM-dd");
    case "weekly": return format(date, "RRRR-'W'II");
    case "fortnightly": {
      const wn = parseInt(format(date, "II"), 10);
      return `${format(date, "RRRR")}-FN${Math.ceil(wn / 2)}`;
    }
    case "monthly": return format(date, "yyyy-MM");
    case "term": {
      const m = date.getMonth() + 1;
      const t = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
      return `${date.getFullYear()}-T${t}`;
    }
    case "annual": return String(date.getFullYear());
    default: return format(date, "yyyy-MM-dd");
  }
}

function getPeriodLabel(date: Date, frequency: string): string {
  switch (frequency) {
    case "daily": return format(date, "EEEE, d MMMM yyyy");
    case "weekly": {
      const s = startOfISOWeek(date);
      const e = endOfISOWeek(date);
      return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
    }
    case "fortnightly": {
      const s = startOfISOWeek(date);
      const e = addDays(s, 13);
      return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")} (Fortnight)`;
    }
    case "monthly": return format(date, "MMMM yyyy");
    case "term": {
      const m = date.getMonth() + 1;
      const t = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
      return `Term ${t}, ${date.getFullYear()}`;
    }
    case "annual": return String(date.getFullYear());
    default: return format(date, "d MMMM yyyy");
  }
}

function navigatePeriod(date: Date, frequency: string, dir: 1 | -1): Date {
  switch (frequency) {
    case "daily": return addDays(date, dir);
    case "weekly": return addWeeks(date, dir);
    case "fortnightly": return addWeeks(date, dir * 2);
    case "monthly": return addMonths(date, dir);
    case "term": return addMonths(date, dir * 3);
    case "annual": return addYears(date, dir);
    default: return addDays(date, dir);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ChecklistItemDraft {
  title: string;
  days: number[];
  months: number[];
}

interface ChecklistSectionDraft {
  title: string;
  items: ChecklistItemDraft[];
}

function emptyItem(): ChecklistItemDraft {
  return { title: "", days: [], months: [] };
}

function emptySection(): ChecklistSectionDraft {
  return { title: "", items: [emptyItem()] };
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    daily: "bg-blue-100 text-blue-800",
    weekly: "bg-purple-100 text-purple-800",
    monthly: "bg-orange-100 text-orange-800",
    term: "bg-green-100 text-green-800",
    annual: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] ?? "bg-gray-100 text-gray-800"}`}>
      {TEMPLATE_TYPES.find((t) => t.value === type)?.label ?? FREQUENCIES.find((f) => f.value === type)?.label ?? type}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template form helpers
// ─────────────────────────────────────────────────────────────────────────────

function ItemRow({
  item, type, onChange, onRemove, canRemove,
}: {
  item: ChecklistItemDraft;
  type: TemplateType;
  onChange: (u: ChecklistItemDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function toggleDay(d: number) {
    const days = item.days.includes(d) ? item.days.filter((x) => x !== d) : [...item.days, d];
    onChange({ ...item, days });
  }
  function toggleMonth(m: number) {
    const months = item.months.includes(m) ? item.months.filter((x) => x !== m) : [...item.months, m];
    onChange({ ...item, months });
  }

  return (
    <div className="space-y-1.5 py-2 border-b last:border-b-0">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          placeholder="Item title"
          className="flex-1 h-8 text-sm"
        />
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {type === "weekly" && (
        <div className="flex gap-2 pl-6 flex-wrap">
          {DAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox checked={item.days.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} className="h-3.5 w-3.5" />
              {d.label}
            </label>
          ))}
        </div>
      )}
      {type === "monthly" && (
        <div className="flex gap-2 pl-6 flex-wrap">
          {MONTHS.map((m) => (
            <label key={m.value} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox checked={item.months.includes(m.value)} onCheckedChange={() => toggleMonth(m.value)} className="h-3.5 w-3.5" />
              {m.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionEditor({
  section, index, type, onChange, onRemove, canRemove,
}: {
  section: ChecklistSectionDraft;
  index: number;
  type: TemplateType;
  onChange: (u: ChecklistSectionDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function updateItem(i: number, u: ChecklistItemDraft) {
    const items = [...section.items]; items[i] = u; onChange({ ...section, items });
  }
  function removeItem(i: number) { onChange({ ...section, items: section.items.filter((_, idx) => idx !== i) }); }
  function addItem() { onChange({ ...section, items: [...section.items, emptyItem()] }); }

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16 shrink-0">
          Heading {index + 1}
        </span>
        <Input
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          placeholder="Section heading"
          className="flex-1 h-8 text-sm font-medium"
        />
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="pl-2">
        {section.items.map((item, i) => (
          <ItemRow key={i} item={item} type={type} onChange={(u) => updateItem(i, u)} onRemove={() => removeItem(i)} canRemove={section.items.length > 1} />
        ))}
        <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs gap-1" onClick={addItem}>
          <Plus className="h-3 w-3" />Add item
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template form dialog
// ─────────────────────────────────────────────────────────────────────────────

function TemplateFormDialog({
  open, onOpenChange, editTemplate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editTemplate?: { id: number; title: string; type: string; commencementMonth?: number | null; sections: any[] } | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateChecklistTemplate();
  const updateMutation = useUpdateChecklistTemplate();

  const [title, setTitle] = useState(editTemplate?.title ?? "");
  const [type, setType] = useState<TemplateType>((editTemplate?.type as TemplateType) ?? "daily");
  const [commencementMonth, setCommencementMonth] = useState<string>(
    editTemplate?.commencementMonth ? String(editTemplate.commencementMonth) : ""
  );
  const [sections, setSections] = useState<ChecklistSectionDraft[]>(
    editTemplate?.sections?.length
      ? editTemplate.sections.map((s: any) => ({
          title: s.title,
          items: s.items.map((it: any) => ({ title: it.title, days: it.days ?? [], months: it.months ?? [] })),
        }))
      : [emptySection()]
  );

  function addSection() { setSections([...sections, emptySection()]); }
  function removeSection(i: number) { setSections(sections.filter((_, idx) => idx !== i)); }
  function updateSection(i: number, u: ChecklistSectionDraft) { const next = [...sections]; next[i] = u; setSections(next); }

  function buildPayload() {
    return {
      title: title.trim(),
      type,
      commencementMonth: type === "annual" && commencementMonth ? parseInt(commencementMonth) : null,
      sections: sections.map((s) => ({
        title: s.title.trim(),
        items: s.items.filter((it) => it.title.trim()).map((it) => ({
          title: it.title.trim(),
          days: type === "weekly" ? it.days : null,
          months: type === "monthly" ? it.months : null,
        })),
      })).filter((s) => s.title || s.items.length),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (editTemplate) {
      updateMutation.mutate({ id: editTemplate.id, data: payload as any }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() }); toast({ title: "Template updated" }); onOpenChange(false); },
        onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload as any }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() }); toast({ title: "Template created" }); onOpenChange(false); },
        onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTemplate ? "Edit Template" : "New Checklist Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <Label>Template Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning Routine" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TemplateType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {type === "annual" && (
              <div className="space-y-1">
                <Label>Commencement Month</Label>
                <Select value={commencementMonth} onValueChange={setCommencementMonth}>
                  <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {type === "weekly" && <p className="text-xs text-muted-foreground bg-purple-50 rounded px-3 py-2">For each item, tick the days of the week it applies to.</p>}
          {type === "monthly" && <p className="text-xs text-muted-foreground bg-orange-50 rounded px-3 py-2">For each item, tick the months of the year it applies to.</p>}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Sections &amp; Items</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addSection}>
                <Plus className="h-3 w-3" />Add section
              </Button>
            </div>
            {sections.map((s, i) => (
              <SectionEditor key={i} section={s} index={i} type={type} onChange={(u) => updateSection(i, u)} onRemove={() => removeSection(i)} canRemove={sections.length > 1} />
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Routine dialog (create)
// ─────────────────────────────────────────────────────────────────────────────

function RoutineDialog({
  open, onOpenChange, template,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  template: { id: number; title: string; sections: any[] } | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateChecklistRoutine();
  const { data: sites } = useListSites();
  const { data: staff } = useListStaff();

  const [targetDate, setTargetDate] = useState(melbourneDateStr());
  const [isRepeating, setIsRepeating] = useState(false);
  const [frequency, setFrequency] = useState("none");
  const [siteId, setSiteId] = useState("none");
  const [staffId, setStaffId] = useState("none");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!template) return;
    createMutation.mutate({
      data: {
        templateId: template.id,
        title: template.title,
        siteId: siteId !== "none" ? parseInt(siteId) : null,
        staffId: staffId !== "none" ? parseInt(staffId) : null,
        targetDate,
        isRepeating,
        frequency: isRepeating && frequency !== "none" ? frequency : null,
        sectionsSnapshot: template.sections as any,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChecklistRoutinesQueryKey() });
        toast({ title: "Routine created" });
        onOpenChange(false);
        setTargetDate(""); setIsRepeating(false); setFrequency("none"); setSiteId("none"); setStaffId("none");
      },
      onError: () => toast({ title: "Failed to create routine", variant: "destructive" }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Routine — {template?.title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Target Date</Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Repeating Routine</p>
              <p className="text-xs text-muted-foreground">Recurs from the target date</p>
            </div>
            <Switch checked={isRepeating} onCheckedChange={setIsRepeating} />
          </div>
          {isRepeating && (
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Separator />
          <div className="space-y-1">
            <Label>Assign to Site (optional)</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Any site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any site</SelectItem>
                {(sites ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assign to Staff (optional)</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Any staff" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any staff</SelectItem>
                {(staff ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>Save Routine</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit routine dialog
// ─────────────────────────────────────────────────────────────────────────────

function EditRoutineDialog({
  open, onOpenChange, routine,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  routine: any | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateChecklistRoutine();
  const { data: sites } = useListSites();
  const { data: staff } = useListStaff();

  const [targetDate, setTargetDate] = useState(routine?.targetDate ?? "");
  const [isRepeating, setIsRepeating] = useState(routine?.isRepeating ?? false);
  const [frequency, setFrequency] = useState(routine?.frequency ?? "none");
  const [siteId, setSiteId] = useState(routine?.siteId ? String(routine.siteId) : "none");
  const [staffId, setStaffId] = useState(routine?.staffId ? String(routine.staffId) : "none");

  useState(() => {
    if (routine) {
      setTargetDate(routine.targetDate ?? ""); setIsRepeating(routine.isRepeating ?? false);
      setFrequency(routine.frequency ?? "none");
      setSiteId(routine.siteId ? String(routine.siteId) : "none");
      setStaffId(routine.staffId ? String(routine.staffId) : "none");
    }
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!routine) return;
    updateMutation.mutate({
      id: routine.id,
      data: {
        siteId: siteId !== "none" ? parseInt(siteId) : null,
        staffId: staffId !== "none" ? parseInt(staffId) : null,
        targetDate,
        isRepeating,
        frequency: isRepeating && frequency !== "none" ? frequency : null,
      },
    }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChecklistRoutinesQueryKey() }); toast({ title: "Routine updated" }); onOpenChange(false); },
      onError: () => toast({ title: "Failed to update routine", variant: "destructive" }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Routine — {routine?.title}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Target Date</Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Repeating Routine</p>
              <p className="text-xs text-muted-foreground">Recurs from the target date</p>
            </div>
            <Switch checked={isRepeating} onCheckedChange={setIsRepeating} />
          </div>
          {isRepeating && (
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Separator />
          <div className="space-y-1">
            <Label>Assign to Site (optional)</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue placeholder="Any site" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any site</SelectItem>
                {(sites ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assign to Staff (optional)</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger><SelectValue placeholder="Any staff" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any staff</SelectItem>
                {(staff ?? []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Checklist "Do" dialog — complete items with period navigation
// ─────────────────────────────────────────────────────────────────────────────

function ChecklistDoDialog({
  routine, open, onOpenChange,
}: {
  routine: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: staff } = useListStaff();

  const [currentDate, setCurrentDate] = useState(melbourneDate());
  const [completingAsId, setCompletingAsId] = useState<string>(() => {
    try { return localStorage.getItem("checklist_completing_as") ?? "none"; } catch { return "none"; }
  });

  useEffect(() => {
    if (!open) return;
    setCurrentDate(melbourneDate());
  }, [open]);

  function handleCompletingAsChange(v: string) {
    setCompletingAsId(v);
    try { localStorage.setItem("checklist_completing_as", v); } catch {}
  }

  const freq = routine.frequency ?? "daily";
  const periodKey = getPeriodKey(currentDate, freq);
  const periodLabel = getPeriodLabel(currentDate, freq);

  const { data: completions, isLoading } = useListRoutineItemCompletions(
    { routineId: routine.id, periodKey },
    { query: { enabled: open } }
  );
  const createMutation = useCreateRoutineItemCompletion();
  const deleteMutation = useDeleteRoutineItemCompletion();

  const qKey = getListRoutineItemCompletionsQueryKey({ routineId: routine.id, periodKey });

  function getCompletion(si: number, ii: number) {
    return completions?.find((c) => c.sectionIndex === si && c.itemIndex === ii);
  }

  function toggleItem(si: number, ii: number) {
    const existing = getCompletion(si, ii);
    if (existing) {
      deleteMutation.mutate({ id: existing.id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
      });
    } else {
      createMutation.mutate({
        data: {
          routineId: routine.id,
          periodKey,
          sectionIndex: si,
          itemIndex: ii,
          completedByStaffId: completingAsId !== "none" ? parseInt(completingAsId) : null,
        },
      }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
      });
    }
  }

  const sections: any[] = routine.sectionsSnapshot ?? [];
  const totalItems = sections.reduce((n: number, s: any) => n + (s.items?.length ?? 0), 0);
  const doneCount = new Set((completions ?? []).map((c) => `${c.sectionIndex}:${c.itemIndex}`)).size;
  const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;

  const isPending = createMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine.title}</DialogTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={freq} />
            {routine.siteName && <span className="text-xs text-muted-foreground">{routine.siteName}</span>}
          </div>
        </DialogHeader>

        {/* Completing as */}
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Completing as</span>
          <Select value={completingAsId} onValueChange={handleCompletingAsChange}>
            <SelectTrigger className="flex-1 h-8 text-sm border-0 shadow-none px-1">
              <SelectValue placeholder="Select staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {(staff ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setCurrentDate((d) => navigatePeriod(d, freq, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center">
            <p className="text-sm font-medium">{periodLabel}</p>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => setCurrentDate((d) => navigatePeriod(d, freq, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{doneCount} of {totalItems} items completed</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <Separator />

        {/* Checklist items */}
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : sections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No items in this checklist.</p>
        ) : (
          <div className="space-y-4">
            {sections.map((section: any, si: number) => (
              <div key={si}>
                {section.title && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{section.title}</p>
                )}
                <div className="space-y-1">
                  {(section.items ?? []).map((item: any, ii: number) => {
                    const completion = getCompletion(si, ii);
                    const done = !!completion;
                    return (
                      <label
                        key={ii}
                        className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${done ? "bg-green-50" : "hover:bg-muted/40"} ${isPending ? "pointer-events-none opacity-70" : ""}`}
                        onClick={() => toggleItem(si, ii)}
                      >
                        <Checkbox
                          checked={done}
                          onCheckedChange={() => toggleItem(si, ii)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{item.title}</p>
                          {done && completion.completedByStaffName && (
                            <p className="text-xs text-green-700 mt-0.5">Completed by {completion.completedByStaffName}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active checklist tile
// ─────────────────────────────────────────────────────────────────────────────

function ActiveChecklistTile({
  routine, onOpen,
}: {
  routine: any;
  onOpen: () => void;
}) {
  const freq = routine.frequency ?? "daily";
  const periodKey = getPeriodKey(melbourneDate(), freq);
  const periodLabel = getPeriodLabel(melbourneDate(), freq);

  const { data: completions } = useListRoutineItemCompletions({ routineId: routine.id, periodKey });

  const totalItems = (routine.sectionsSnapshot ?? []).reduce((n: number, s: any) => n + (s.items?.length ?? 0), 0);
  const doneCount = new Set((completions ?? []).map((c) => `${c.sectionIndex}:${c.itemIndex}`)).size;
  const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
  const allDone = totalItems > 0 && doneCount >= totalItems;

  return (
    <Card className={`flex flex-col transition-shadow hover:shadow-md cursor-pointer ${allDone ? "border-green-200 bg-green-50/30" : ""}`} onClick={onOpen}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-snug">{routine.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <TypeBadge type={freq} />
              {routine.siteName && <span className="text-xs text-muted-foreground">{routine.siteName}</span>}
              {routine.staffName && <span className="text-xs text-muted-foreground">{routine.staffName}</span>}
            </div>
          </div>
          {allDone && (
            <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0 text-xs">Done</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-3 space-y-3">
        <p className="text-xs text-muted-foreground">{periodLabel}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{doneCount}/{totalItems} items</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          <Play className="h-3.5 w-3.5" />
          {allDone ? "Review" : "Open Checklist"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template tile
// ─────────────────────────────────────────────────────────────────────────────

function TemplateTile({
  template, onRoutine, onEdit, onDelete,
}: {
  template: any;
  onRoutine: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const itemCount = template.sections.reduce((n: number, s: any) => n + s.items.length, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base leading-snug">{template.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1.5">
              <TypeBadge type={template.type} />
              {template.commencementMonth && (
                <span className="text-xs text-muted-foreground">
                  from {MONTHS.find((m) => m.value === template.commencementMonth)?.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-2 pb-3">
        <p className="text-xs text-muted-foreground">
          {template.sections.length} section{template.sections.length !== 1 ? "s" : ""} · {itemCount} item{itemCount !== 1 ? "s" : ""}
        </p>
        <div className="space-y-1">
          {template.sections.slice(0, 3).map((s: any, i: number) => (
            <p key={i} className="text-xs text-muted-foreground truncate">• {s.title}</p>
          ))}
          {template.sections.length > 3 && (
            <p className="text-xs text-muted-foreground">+{template.sections.length - 3} more</p>
          )}
        </div>
        <div className="flex gap-1.5 pt-1">
          <Button size="sm" variant="default" className="flex-1 h-8 text-xs gap-1" onClick={onRoutine}>
            <CalendarClock className="h-3.5 w-3.5" />Routine
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Routine row
// ─────────────────────────────────────────────────────────────────────────────

function RoutineRow({
  routine, currentTemplateSections, onEdit, onDelete, onSync, isSyncing,
}: {
  routine: any;
  currentTemplateSections: any[] | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const itemCount = routine.sectionsSnapshot.reduce((n: number, s: any) => n + s.items.length, 0);

  const isOutOfSync = currentTemplateSections !== undefined &&
    JSON.stringify(currentTemplateSections) !== JSON.stringify(routine.sectionsSnapshot);

  return (
    <div className={`flex items-center gap-4 py-3 px-4 border rounded-lg hover:bg-muted/30 group ${isOutOfSync ? "border-amber-200 bg-amber-50/40" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{routine.title}</p>
          {isOutOfSync && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              <RefreshCw className="h-2.5 w-2.5" />Template updated
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span className="text-xs text-muted-foreground">
            Target: {String(routine.targetDate).slice(0, 10)}
          </span>
          {routine.isRepeating && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <RefreshCw className="h-3 w-3" />
              {FREQUENCIES.find((f) => f.value === routine.frequency)?.label ?? routine.frequency}
            </span>
          )}
          {routine.siteName && <span className="text-xs text-muted-foreground">Site: {routine.siteName}</span>}
          {routine.staffName && <span className="text-xs text-muted-foreground">Staff: {routine.staffName}</span>}
          <span className="text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
        {isOutOfSync && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 border-amber-300 text-amber-800 hover:bg-amber-50"
            onClick={onSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function Checklists() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const search = useSearch();
  const { isEducatorRole, ownSiteId } = usePermissions();
  const { user } = useAuth();

  const { data: templates, isLoading: templatesLoading } = useListChecklistTemplates();
  const { data: routines, isLoading: routinesLoading } = useListChecklistRoutines();
  const deleteTmplMutation = useDeleteChecklistTemplate();
  const deleteRoutineMutation = useDeleteChecklistRoutine();
  const updateRoutineMutation = useUpdateChecklistRoutine();

  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any | null>(null);
  const [routineTemplate, setRoutineTemplate] = useState<any | null>(null);
  const [editRoutine, setEditRoutine] = useState<any | null>(null);
  const [activeRoutine, setActiveRoutine] = useState<any | null>(null);
  const [syncingRoutineId, setSyncingRoutineId] = useState<number | null>(null);

  // Auto-open a routine when navigated here with ?open=<id>
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const openId = new URLSearchParams(search).get("open");
    if (!openId || !routines || autoOpenedRef.current === openId) return;
    const target = routines.find((r) => r.id === Number(openId));
    if (target) {
      autoOpenedRef.current = openId;
      setActiveRoutine(target);
    }
  }, [routines, search]);

  function openCreate() { setEditTemplate(null); setFormOpen(true); }
  function openEdit(t: any) { setEditTemplate(t); setFormOpen(true); }
  function openRoutine(t: any) { setRoutineTemplate(t); }
  function openEditRoutine(r: any) { setEditRoutine(r); }

  function handleDeleteTemplate(id: number) {
    if (!confirm("Delete this template and all its routines?")) return;
    deleteTmplMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListChecklistRoutinesQueryKey() });
        toast({ title: "Template deleted" });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  }

  function handleDeleteRoutine(id: number) {
    if (!confirm("Remove this routine?")) return;
    deleteRoutineMutation.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListChecklistRoutinesQueryKey() }); toast({ title: "Routine removed" }); },
      onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
    });
  }

  function handleSyncRoutine(routine: any) {
    const template = (templates ?? []).find((t) => t.id === routine.templateId);
    if (!template) {
      toast({ title: "Original template not found", variant: "destructive" });
      return;
    }
    setSyncingRoutineId(routine.id);
    updateRoutineMutation.mutate({
      id: routine.id,
      data: {
        siteId: routine.siteId ?? null,
        staffId: routine.staffId ?? null,
        targetDate: String(routine.targetDate).slice(0, 10),
        isRepeating: routine.isRepeating,
        frequency: routine.frequency ?? null,
        sectionsSnapshot: template.sections as any,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChecklistRoutinesQueryKey() });
        toast({ title: "Routine synced from template" });
      },
      onError: () => toast({ title: "Failed to sync routine", variant: "destructive" }),
      onSettled: () => setSyncingRoutineId(null),
    });
  }

  // Only show routines that have a frequency (repeating) or are due
  const activeRoutines = (routines ?? []).filter((r) => r.isRepeating || r.frequency);
  const nonRepeatingRoutines = (routines ?? []).filter((r) => !r.isRepeating && !r.frequency);
  const allRoutines = routines ?? [];

  // For educators/coordinators: only show checklists for their site or assigned to them
  const visibleActiveChecklists = isEducatorRole
    ? allRoutines.filter((r) =>
        (ownSiteId && r.siteId === ownSiteId) || (user?.id && r.staffId === user.id)
      )
    : allRoutines;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
          <p className="text-muted-foreground mt-1">
            {isEducatorRole
              ? "Active checklists assigned to your site or to you."
              : "Build reusable templates and schedule them as routines."}
          </p>
        </div>
        {!isEducatorRole && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />New Template
          </Button>
        )}
      </div>

      {/* Templates — admins only */}
      {!isEducatorRole && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Templates</h2>
          {templatesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
            </div>
          ) : (templates ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <CheckSquare className="h-8 w-8 mb-2" />
                <p>No templates yet. Create your first checklist template to get started.</p>
                <Button variant="outline" size="sm" onClick={openCreate} className="mt-2">
                  <Plus className="h-4 w-4 mr-1" />New Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(templates ?? []).map((t) => (
                <TemplateTile
                  key={t.id}
                  template={t}
                  onRoutine={() => openRoutine(t)}
                  onEdit={() => openEdit(t)}
                  onDelete={() => handleDeleteTemplate(t.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Routines — admins only */}
      {!isEducatorRole && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Routines</h2>
          {routinesLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : allRoutines.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No routines yet. Use the <strong>Routine</strong> button on a template tile to schedule one.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allRoutines.map((r) => {
                const currentTemplate = (templates ?? []).find((t) => t.id === r.templateId);
                return (
                  <RoutineRow
                    key={r.id}
                    routine={r}
                    currentTemplateSections={currentTemplate?.sections}
                    onEdit={() => openEditRoutine(r)}
                    onDelete={() => handleDeleteRoutine(r.id)}
                    onSync={() => handleSyncRoutine(r)}
                    isSyncing={syncingRoutineId === r.id}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Active Checklists */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Active Checklists</h2>
            <p className="text-sm text-muted-foreground">Complete checklists for the current period. Tick items as you go — progress saves automatically.</p>
          </div>
        </div>
        {routinesLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : visibleActiveChecklists.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              {isEducatorRole
                ? "No active checklists assigned to your site or to you."
                : "No routines scheduled yet. Create a routine from a template above to get started."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActiveChecklists.map((r) => (
              <ActiveChecklistTile
                key={r.id}
                routine={r}
                onOpen={() => setActiveRoutine(r)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Dialogs */}
      <TemplateFormDialog
        key={editTemplate?.id ?? "new"}
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditTemplate(null); }}
        editTemplate={editTemplate}
      />
      <RoutineDialog
        open={!!routineTemplate}
        onOpenChange={(o) => { if (!o) setRoutineTemplate(null); }}
        template={routineTemplate}
      />
      <EditRoutineDialog
        key={editRoutine?.id}
        open={!!editRoutine}
        onOpenChange={(o) => { if (!o) setEditRoutine(null); }}
        routine={editRoutine}
      />
      {activeRoutine && (
        <ChecklistDoDialog
          key={activeRoutine.id}
          routine={activeRoutine}
          open={!!activeRoutine}
          onOpenChange={(o) => { if (!o) setActiveRoutine(null); }}
        />
      )}
    </div>
  );
}
