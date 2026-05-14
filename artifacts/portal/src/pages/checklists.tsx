import { useState } from "react";
import {
  useListChecklistTemplates, useCreateChecklistTemplate, useUpdateChecklistTemplate, useDeleteChecklistTemplate,
  useListChecklistRoutines, useCreateChecklistRoutine, useDeleteChecklistRoutine,
  useListStaff, useListSites,
  getListChecklistTemplatesQueryKey, getListChecklistRoutinesQueryKey,
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
import { CheckSquare, Plus, Trash2, Edit, CalendarClock, X, GripVertical, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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
      {TEMPLATE_TYPES.find((t) => t.value === type)?.label ?? type}
    </span>
  );
}

// ── Item row — shows toggles depending on type ──────────────────────────────
function ItemRow({
  item, type, onChange, onRemove, canRemove,
}: {
  item: ChecklistItemDraft;
  type: TemplateType;
  onChange: (updated: ChecklistItemDraft) => void;
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
              <Checkbox
                checked={item.days.includes(d.value)}
                onCheckedChange={() => toggleDay(d.value)}
                className="h-3.5 w-3.5"
              />
              {d.label}
            </label>
          ))}
        </div>
      )}
      {type === "monthly" && (
        <div className="flex gap-2 pl-6 flex-wrap">
          {MONTHS.map((m) => (
            <label key={m.value} className="flex items-center gap-1 text-xs cursor-pointer">
              <Checkbox
                checked={item.months.includes(m.value)}
                onCheckedChange={() => toggleMonth(m.value)}
                className="h-3.5 w-3.5"
              />
              {m.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section editor ──────────────────────────────────────────────────────────
function SectionEditor({
  section, index, type, onChange, onRemove, canRemove,
}: {
  section: ChecklistSectionDraft;
  index: number;
  type: TemplateType;
  onChange: (updated: ChecklistSectionDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function updateItem(i: number, updated: ChecklistItemDraft) {
    const items = [...section.items];
    items[i] = updated;
    onChange({ ...section, items });
  }
  function removeItem(i: number) {
    onChange({ ...section, items: section.items.filter((_, idx) => idx !== i) });
  }
  function addItem() {
    onChange({ ...section, items: [...section.items, emptyItem()] });
  }

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
          <ItemRow
            key={i}
            item={item}
            type={type}
            onChange={(u) => updateItem(i, u)}
            onRemove={() => removeItem(i)}
            canRemove={section.items.length > 1}
          />
        ))}
        <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs gap-1" onClick={addItem}>
          <Plus className="h-3 w-3" />Add item
        </Button>
      </div>
    </div>
  );
}

// ── Template form dialog ────────────────────────────────────────────────────
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
  function updateSection(i: number, updated: ChecklistSectionDraft) {
    const next = [...sections]; next[i] = updated; setSections(next);
  }

  function buildPayload() {
    return {
      title: title.trim(),
      type,
      commencementMonth: type === "annual" && commencementMonth ? parseInt(commencementMonth) : null,
      sections: sections.map((s) => ({
        title: s.title.trim(),
        items: s.items
          .filter((it) => it.title.trim())
          .map((it) => ({
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
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() });
          toast({ title: "Template updated" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: payload as any }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChecklistTemplatesQueryKey() });
          toast({ title: "Template created" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

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
                  {TEMPLATE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
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

          {type === "weekly" && (
            <p className="text-xs text-muted-foreground bg-purple-50 rounded px-3 py-2">
              For each item, tick the days of the week it applies to.
            </p>
          )}
          {type === "monthly" && (
            <p className="text-xs text-muted-foreground bg-orange-50 rounded px-3 py-2">
              For each item, tick the months of the year it applies to.
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Sections &amp; Items</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addSection}>
                <Plus className="h-3 w-3" />Add section
              </Button>
            </div>
            {sections.map((s, i) => (
              <SectionEditor
                key={i}
                section={s}
                index={i}
                type={type}
                onChange={(u) => updateSection(i, u)}
                onRemove={() => removeSection(i)}
                canRemove={sections.length > 1}
              />
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {editTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Routine dialog ──────────────────────────────────────────────────────────
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

  const [targetDate, setTargetDate] = useState("");
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
        setTargetDate("");
        setIsRepeating(false);
        setFrequency("none");
        setSiteId("none");
        setStaffId("none");
      },
      onError: () => toast({ title: "Failed to create routine", variant: "destructive" }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Routine — {template?.title}</DialogTitle>
        </DialogHeader>
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

// ── Template tile ───────────────────────────────────────────────────────────
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

// ── Routine row ─────────────────────────────────────────────────────────────
function RoutineRow({ routine, onDelete }: { routine: any; onDelete: () => void }) {
  const itemCount = routine.sectionsSnapshot.reduce((n: number, s: any) => n + s.items.length, 0);

  return (
    <div className="flex items-center gap-4 py-3 px-4 border rounded-lg hover:bg-muted/30 group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{routine.title}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span className="text-xs text-muted-foreground">
            Target: {routine.targetDate}
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
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Checklists() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates, isLoading: templatesLoading } = useListChecklistTemplates();
  const { data: routines, isLoading: routinesLoading } = useListChecklistRoutines();
  const deleteTmplMutation = useDeleteChecklistTemplate();
  const deleteRoutineMutation = useDeleteChecklistRoutine();

  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any | null>(null);
  const [routineTemplate, setRoutineTemplate] = useState<any | null>(null);

  function openCreate() { setEditTemplate(null); setFormOpen(true); }
  function openEdit(t: any) { setEditTemplate(t); setFormOpen(true); }
  function openRoutine(t: any) { setRoutineTemplate(t); }

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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListChecklistRoutinesQueryKey() });
        toast({ title: "Routine removed" });
      },
      onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
          <p className="text-muted-foreground mt-1">Build reusable templates and schedule them as routines.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />New Template
        </Button>
      </div>

      {/* Templates */}
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

      {/* Routines */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Routines</h2>
        {routinesLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (routines ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No routines yet. Use the <strong>Routine</strong> button on a template tile to schedule one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(routines ?? []).map((r) => (
              <RoutineRow key={r.id} routine={r} onDelete={() => handleDeleteRoutine(r.id)} />
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
    </div>
  );
}
