import { useState, useEffect } from "react";
import {
  useListQipItems, useCreateQipItem, useUpdateQipItem, useDeleteQipItem,
  useListQipSources, useCreateQipSource, useDeleteQipSource,
  useListQipStrengths, useUpsertQipStrength,
  useListSites,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Plus, Trash2, Pencil, Settings, X, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const QA_AREAS = [
  { key: "1", label: "Quality Area 1: Educational Program and Practice" },
  { key: "2", label: "Quality Area 2: Children's Health and Safety" },
  { key: "3", label: "Quality Area 3: Physical Environment" },
  { key: "4", label: "Quality Area 4: Staffing Arrangements" },
  { key: "5", label: "Quality Area 5: Relationships with Children" },
  { key: "6", label: "Quality Area 6: Collaborative Partnerships with Families and Communities" },
  { key: "7", label: "Quality Area 7: Governance and Leadership" },
];

const NQS_ELEMENTS: { value: string; label: string }[] = [
  // QA1
  { value: "1.1", label: "Standard 1.1 – Approved learning framework" },
  { value: "1.1.1", label: "1.1.1 – Curriculum decision making" },
  { value: "1.1.2", label: "1.1.2 – Child's knowledge, ideas and interests" },
  { value: "1.1.3", label: "1.1.3 – Program maximises learning opportunities" },
  { value: "1.2", label: "Standard 1.2 – Educators facilitate learning" },
  { value: "1.2.1", label: "1.2.1 – Deliberate and purposeful decisions" },
  { value: "1.2.2", label: "1.2.2 – Responsive teaching and scaffolding" },
  { value: "1.2.3", label: "1.2.3 – Critical reflection informs planning" },
  { value: "1.3", label: "Standard 1.3 – Planned and reflective approach" },
  { value: "1.3.1", label: "1.3.1 – Assessment and evaluation cycle" },
  { value: "1.3.2", label: "1.3.2 – Critical reflection guides planning" },
  { value: "1.3.3", label: "1.3.3 – Families informed about program" },
  // QA2
  { value: "2.1", label: "Standard 2.1 – Each child's health is promoted" },
  { value: "2.1.1", label: "2.1.1 – Each child's health needs are supported" },
  { value: "2.1.2", label: "2.1.2 – Illness, injury and hygiene management" },
  { value: "2.1.3", label: "2.1.3 – Healthy lifestyle is promoted" },
  { value: "2.2", label: "Standard 2.2 – Healthy eating and physical activity" },
  { value: "2.2.1", label: "2.2.1 – Healthy eating is promoted" },
  { value: "2.2.2", label: "2.2.2 – Physical activity is promoted" },
  { value: "2.3", label: "Standard 2.3 – Each child is protected" },
  { value: "2.3.1", label: "2.3.1 – Children are adequately supervised" },
  { value: "2.3.2", label: "2.3.2 – Children protected from harm and hazards" },
  // QA3
  { value: "3.1", label: "Standard 3.1 – Design of spaces" },
  { value: "3.1.1", label: "3.1.1 – Spaces, furniture and equipment are appropriate" },
  { value: "3.1.2", label: "3.1.2 – Environment promotes competence and exploration" },
  { value: "3.2", label: "Standard 3.2 – Service environment supports learning" },
  { value: "3.2.1", label: "3.2.1 – Indoor and outdoor spaces engage children" },
  { value: "3.2.2", label: "3.2.2 – Resources and equipment support learning" },
  { value: "3.2.3", label: "3.2.3 – Environment is inclusive and promotes independence" },
  // QA4
  { value: "4.1", label: "Standard 4.1 – Staffing arrangements" },
  { value: "4.1.1", label: "4.1.1 – Educators recruited with skills and qualifications" },
  { value: "4.1.2", label: "4.1.2 – Continuing professional learning" },
  { value: "4.2", label: "Standard 4.2 – Collaborative, respectful and ethical" },
  { value: "4.2.1", label: "4.2.1 – Staff work collaboratively with mutual respect" },
  { value: "4.2.2", label: "4.2.2 – Professional standards guide practice" },
  // QA5
  { value: "5.1", label: "Standard 5.1 – Respectful and equitable relationships" },
  { value: "5.1.1", label: "5.1.1 – Warm, responsive interactions that build trust" },
  { value: "5.1.2", label: "5.1.2 – Dignity and rights of every child maintained" },
  { value: "5.2", label: "Standard 5.2 – Sensitive and responsive relationships" },
  { value: "5.2.1", label: "5.2.1 – Children supported to collaborate and help each other" },
  { value: "5.2.2", label: "5.2.2 – Children supported to regulate behaviour" },
  { value: "5.2.3", label: "5.2.3 – Strengths of families and community recognised" },
  // QA6
  { value: "6.1", label: "Standard 6.1 – Relationships with families" },
  { value: "6.1.1", label: "6.1.1 – Families supported as primary educators" },
  { value: "6.1.2", label: "6.1.2 – Family expertise and beliefs are respected" },
  { value: "6.1.3", label: "6.1.3 – Current information available to families" },
  { value: "6.2", label: "Standard 6.2 – Families supported in parenting role" },
  { value: "6.2.1", label: "6.2.1 – Service supports family involvement" },
  { value: "6.2.2", label: "6.2.2 – Families have opportunities to contribute" },
  { value: "6.3", label: "Standard 6.3 – Collaboration with other organisations" },
  { value: "6.3.1", label: "6.3.1 – Links with community and support agencies" },
  { value: "6.3.2", label: "6.3.2 – Service builds community relationships" },
  { value: "6.3.3", label: "6.3.3 – Service is an active community participant" },
  // QA7
  { value: "7.1", label: "Standard 7.1 – Governance supports quality" },
  { value: "7.1.1", label: "7.1.1 – Statement of philosophy guides operations" },
  { value: "7.1.2", label: "7.1.2 – Management systems meet regulatory requirements" },
  { value: "7.1.3", label: "7.1.3 – Roles and responsibilities clearly defined" },
  { value: "7.2", label: "Standard 7.2 – Effective leadership" },
  { value: "7.2.1", label: "7.2.1 – Self-assessment and quality improvement process" },
  { value: "7.2.2", label: "7.2.2 – Educational leader effectively supported" },
  { value: "7.2.3", label: "7.2.3 – Service regularly evaluates and improves" },
];

const PRIORITY_COLOURS: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-green-100 text-green-800 border-green-200",
};

type FormState = {
  siteId: string;
  date: string;
  qualityArea: string;
  standardElement: string;
  source: string;
  priority: string;
  issueIdentified: string;
  outcomeGoal: string;
  howToAchieve: string;
  successMeasure: string;
  dueDate: string;
  progressNotes: string;
};

const EMPTY_FORM: FormState = {
  siteId: "",
  date: "",
  qualityArea: "",
  standardElement: "",
  source: "",
  priority: "medium",
  issueIdentified: "",
  outcomeGoal: "",
  howToAchieve: "",
  successMeasure: "",
  dueDate: "",
  progressNotes: "",
};

function ItemForm({
  initial,
  defaultQA,
  sites,
  sources,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: FormState;
  defaultQA?: string;
  sites: { id: number; name: string }[];
  sources: { id: number; name: string }[];
  onSubmit: (data: FormState) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial ?? { ...EMPTY_FORM, qualityArea: defaultQA ?? "" });
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Site</Label>
          <Select value={form.siteId} onValueChange={(v) => set("siteId", v)}>
            <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {sites.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Quality Area <span className="text-destructive">*</span></Label>
          <Select value={form.qualityArea} onValueChange={(v) => set("qualityArea", v)}>
            <SelectTrigger><SelectValue placeholder="Select quality area" /></SelectTrigger>
            <SelectContent>
              {QA_AREAS.map((a) => <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Standard / Element</Label>
          <Select value={form.standardElement} onValueChange={(v) => set("standardElement", v)}>
            <SelectTrigger><SelectValue placeholder="Select element" /></SelectTrigger>
            <SelectContent className="max-h-64">
              {NQS_ELEMENTS
                .filter((e) => !form.qualityArea || e.value.startsWith(form.qualityArea + ".") || e.value === form.qualityArea)
                .map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Source</Label>
          <Select value={form.source} onValueChange={(v) => set("source", v)}>
            <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {sources.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label>Issue Identified</Label>
        <Textarea value={form.issueIdentified} onChange={(e) => set("issueIdentified", e.target.value)} rows={3} placeholder="Describe the issue or area for improvement..." />
      </div>
      <div className="space-y-1">
        <Label>What outcome or goal do we seek?</Label>
        <Textarea value={form.outcomeGoal} onChange={(e) => set("outcomeGoal", e.target.value)} rows={2} placeholder="Describe the desired outcome or goal..." />
      </div>
      <div className="space-y-1">
        <Label>How will we get this outcome?</Label>
        <Textarea value={form.howToAchieve} onChange={(e) => set("howToAchieve", e.target.value)} rows={2} placeholder="Strategies or actions to achieve the goal..." />
      </div>
      <div className="space-y-1">
        <Label>Success Measure</Label>
        <Textarea value={form.successMeasure} onChange={(e) => set("successMeasure", e.target.value)} rows={2} placeholder="How will you know when you've succeeded?" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Due Date</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Progress Notes</Label>
        <Textarea value={form.progressNotes} onChange={(e) => set("progressNotes", e.target.value)} rows={2} placeholder="Ongoing notes about progress..." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending || !form.qualityArea}>{isPending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

function StrengthsEditor({ qualityArea }: { qualityArea: string }) {
  const queryClient = useQueryClient();
  const { data: strengths } = useListQipStrengths();
  const upsertMutation = useUpsertQipStrength();
  const { toast } = useToast();

  const existing = strengths?.find((s) => s.qualityArea === qualityArea);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (existing && !editing) setDraft(existing.content);
  }, [existing, editing]);

  function startEdit() {
    setDraft(existing?.content ?? "");
    setEditing(true);
  }

  function save() {
    upsertMutation.mutate(
      { qualityArea, data: { content: draft } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/qip-strengths"] });
          setEditing(false);
          toast({ title: "Strengths saved" });
        },
        onError: () => toast({ title: "Failed to save strengths", variant: "destructive" }),
      }
    );
  }

  return (
    <div className="rounded-lg border bg-green-50/60 p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-green-800">Strengths of the Service</h3>
        {!editing && (
          <Button size="sm" variant="ghost" className="h-7 text-green-700 hover:text-green-900" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            placeholder="Describe the strengths of the service in this quality area…"
            className="bg-white"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={upsertMutation.isPending}>Save</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-green-900 whitespace-pre-wrap min-h-[2rem]">
          {existing?.content || <span className="italic text-green-600 opacity-70">No strengths recorded yet. Click Edit to add.</span>}
        </p>
      )}
    </div>
  );
}

function ItemCard({
  item,
  sites,
  sources,
  onDeleted,
}: {
  item: any;
  sites: { id: number; name: string }[];
  sources: { id: number; name: string }[];
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateQipItem();
  const deleteMutation = useDeleteQipItem();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const siteName = item.siteId ? (sites.find((s) => s.id === item.siteId)?.name ?? `Site ${item.siteId}`) : null;

  function handleEdit(data: FormState) {
    const payload: Record<string, any> = {
      qualityArea: data.qualityArea,
      priority: data.priority,
      standardElement: data.standardElement && data.standardElement !== "none" ? data.standardElement : null,
      source: data.source && data.source !== "none" ? data.source : null,
      siteId: data.siteId && data.siteId !== "none" ? Number(data.siteId) : null,
      date: data.date || null,
      issueIdentified: data.issueIdentified || null,
      outcomeGoal: data.outcomeGoal || null,
      howToAchieve: data.howToAchieve || null,
      successMeasure: data.successMeasure || null,
      dueDate: data.dueDate || null,
      progressNotes: data.progressNotes || null,
    };
    updateMutation.mutate({ id: item.id, data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/qip"] });
        setEditOpen(false);
        toast({ title: "Item updated" });
      },
      onError: () => toast({ title: "Failed to update item", variant: "destructive" }),
    });
  }

  function handleDelete() {
    if (!confirm("Delete this QIP item?")) return;
    deleteMutation.mutate({ id: item.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/qip"] });
        onDeleted();
      },
      onError: () => toast({ title: "Failed to delete item", variant: "destructive" }),
    });
  }

  const initialForm: FormState = {
    siteId: item.siteId ? String(item.siteId) : "",
    date: item.date ?? "",
    qualityArea: item.qualityArea ?? "",
    standardElement: item.standardElement ?? "",
    source: item.source ?? "",
    priority: item.priority ?? "medium",
    issueIdentified: item.issueIdentified ?? "",
    outcomeGoal: item.outcomeGoal ?? "",
    howToAchieve: item.howToAchieve ?? "",
    successMeasure: item.successMeasure ?? "",
    dueDate: item.dueDate ?? "",
    progressNotes: item.progressNotes ?? "",
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Top row: badges */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge className={`text-xs border ${PRIORITY_COLOURS[item.priority] ?? PRIORITY_COLOURS.medium}`}>
                {(item.priority ?? "medium").charAt(0).toUpperCase() + (item.priority ?? "medium").slice(1)} Priority
              </Badge>
              {item.standardElement && (
                <Badge variant="outline" className="text-xs">{item.standardElement}</Badge>
              )}
              {item.source && (
                <Badge variant="outline" className="text-xs">{item.source}</Badge>
              )}
              {siteName && (
                <Badge variant="outline" className="text-xs">{siteName}</Badge>
              )}
              {item.date && (
                <Badge variant="outline" className="text-xs">{new Date(item.date).toLocaleDateString("en-AU")}</Badge>
              )}
            </div>

            {/* Issue */}
            {item.issueIdentified && (
              <p className="text-sm font-medium text-foreground mb-1">{item.issueIdentified}</p>
            )}

            {/* Expandable detail */}
            {expanded && (
              <div className="mt-3 space-y-2 text-sm text-muted-foreground border-t pt-3">
                {item.outcomeGoal && (
                  <div><span className="font-medium text-foreground/80">Goal: </span>{item.outcomeGoal}</div>
                )}
                {item.howToAchieve && (
                  <div><span className="font-medium text-foreground/80">How: </span>{item.howToAchieve}</div>
                )}
                {item.successMeasure && (
                  <div><span className="font-medium text-foreground/80">Success Measure: </span>{item.successMeasure}</div>
                )}
                {item.dueDate && (
                  <div><span className="font-medium text-foreground/80">Due: </span>{new Date(item.dueDate).toLocaleDateString("en-AU")}</div>
                )}
                {item.progressNotes && (
                  <div className="mt-2 rounded bg-muted/40 p-2 italic">{item.progressNotes}</div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Show less" : "Show detail"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit QIP Item</DialogTitle></DialogHeader>
                <ItemForm
                  initial={initialForm}
                  sites={sites}
                  sources={sources}
                  onSubmit={handleEdit}
                  onCancel={() => setEditOpen(false)}
                  isPending={updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourcesDialog() {
  const queryClient = useQueryClient();
  const { data: sources } = useListQipSources();
  const createMutation = useCreateQipSource();
  const deleteMutation = useDeleteQipSource();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({ data: { name: newName.trim() } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/qip-sources"] });
        setNewName("");
        toast({ title: "Source added" });
      },
      onError: () => toast({ title: "Failed to add source", variant: "destructive" }),
    });
  }

  function removeSource(id: number) {
    deleteMutation.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/qip-sources"] }),
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Manage the sources available when creating QIP items.</p>
      <div className="space-y-1">
        {(sources ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No sources added yet.</p>
        ) : (
          (sources ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
              <span className="text-sm">{s.name}</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeSource(s.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
      <form onSubmit={addSource} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add new source…"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!newName.trim() || createMutation.isPending}>Add</Button>
      </form>
    </div>
  );
}

export default function Qip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: items, isLoading } = useListQipItems();
  const { data: sites = [] } = useListSites();
  const { data: sources = [] } = useListQipSources();
  const createMutation = useCreateQipItem();

  const [activeTab, setActiveTab] = useState("1");
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const itemsByQA = (items ?? []).reduce<Record<string, typeof items>>((acc, item) => {
    const qa = item.qualityArea ?? "1";
    if (!acc[qa]) acc[qa] = [];
    acc[qa]!.push(item);
    return acc;
  }, {});

  function handleCreate(data: FormState) {
    const payload: Record<string, any> = {
      qualityArea: data.qualityArea,
      priority: data.priority,
      standardElement: data.standardElement && data.standardElement !== "none" ? data.standardElement : undefined,
      source: data.source && data.source !== "none" ? data.source : undefined,
      siteId: data.siteId && data.siteId !== "none" ? Number(data.siteId) : undefined,
      date: data.date || undefined,
      issueIdentified: data.issueIdentified || undefined,
      outcomeGoal: data.outcomeGoal || undefined,
      howToAchieve: data.howToAchieve || undefined,
      successMeasure: data.successMeasure || undefined,
      dueDate: data.dueDate || undefined,
      progressNotes: data.progressNotes || undefined,
    };
    createMutation.mutate({ data: payload as any }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/qip"] });
        setAddOpen(false);
        toast({ title: "QIP item added" });
      },
      onError: () => toast({ title: "Failed to add QIP item", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quality Improvement Plan</h1>
          <p className="text-muted-foreground mt-1">Continuous improvement goals across all seven quality areas.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />QIP Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>QIP Settings – Sources</DialogTitle></DialogHeader>
              <SourcesDialog />
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add QIP Item</DialogTitle></DialogHeader>
              <ItemForm
                defaultQA={activeTab}
                sites={sites}
                sources={sources}
                onSubmit={handleCreate}
                onCancel={() => setAddOpen(false)}
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto mb-4 bg-muted p-1">
            {QA_AREAS.map((a) => {
              const count = (itemsByQA[a.key] ?? []).length;
              return (
                <TabsTrigger key={a.key} value={a.key} className="text-xs px-3 py-1.5 flex items-center gap-1.5">
                  QA {a.key}
                  {count > 0 && (
                    <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 leading-none font-medium">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {QA_AREAS.map((a) => {
            const qaItems = itemsByQA[a.key] ?? [];
            return (
              <TabsContent key={a.key} value={a.key} className="mt-0 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{a.label}</h2>
                </div>

                <StrengthsEditor qualityArea={a.key} />

                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Improvement Items ({qaItems.length})</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setActiveTab(a.key); setAddOpen(true); }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                  </Button>
                </div>

                {qaItems.length === 0 ? (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                      <TrendingUp className="h-7 w-7 mb-1 opacity-40" />
                      <p className="text-sm">No improvement items for this quality area yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {qaItems.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        sites={sites}
                        sources={sources}
                        onDeleted={() => queryClient.invalidateQueries({ queryKey: ["/api/qip"] })}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
