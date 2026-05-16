import { useState, useEffect } from "react";
import { useListPlanningExperiences, useCreatePlanningExperience, useUpdatePlanningExperience, useListSites } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Layers, ArrowRight, CheckCircle2, Plus, X, Send } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, format, parseISO, isBefore, isAfter, addDays,
} from "date-fns";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListPlanningExperiencesQueryKey } from "@workspace/api-client-react";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type RowKey = "experiencesThemes" | "active" | "creative" | "wellbeing" | "imaginative" | "spontaneousChoice";

const ROW_LABELS: { key: RowKey; label: string }[] = [
  { key: "experiencesThemes", label: "Experiences / Themes" },
  { key: "active", label: "Active" },
  { key: "creative", label: "Creative" },
  { key: "wellbeing", label: "Wellbeing" },
  { key: "imaginative", label: "Imaginative" },
  { key: "spontaneousChoice", label: "Spontaneous Choice" },
];

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

type WeeklyPlanGrid = Record<RowKey, Record<DayKey, string>>;
type CellOutcomes = Record<string, string[]>;

function emptyGrid(): WeeklyPlanGrid {
  const grid: Partial<WeeklyPlanGrid> = {};
  for (const { key } of ROW_LABELS) {
    grid[key] = { mon: "", tue: "", wed: "", thu: "", fri: "" };
  }
  return grid as WeeklyPlanGrid;
}

const MTOP_OUTCOMES = [
  {
    id: 1, label: "Outcome 1", title: "Children have a strong sense of identity",
    dot: "bg-blue-500", bubble: "bg-blue-100 text-blue-800 border-blue-300",
    sub: [
      { id: "1.1", desc: "Children feel safe, secure and supported" },
      { id: "1.2", desc: "Children develop their autonomy, inter-dependence, resilience and sense of agency" },
      { id: "1.3", desc: "Children develop knowledgeable and confident self-identities" },
      { id: "1.4", desc: "Children learn to interact in relation to others with care, empathy and respect" },
    ],
  },
  {
    id: 2, label: "Outcome 2", title: "Children are connected with and contribute to their world",
    dot: "bg-green-500", bubble: "bg-green-100 text-green-800 border-green-300",
    sub: [
      { id: "2.1", desc: "Children develop a sense of belonging to groups and communities and an understanding of reciprocal rights and responsibilities" },
      { id: "2.2", desc: "Children respond to diversity with respect" },
      { id: "2.3", desc: "Children become aware of fairness" },
      { id: "2.4", desc: "Children become socially responsible and show respect for the environment" },
    ],
  },
  {
    id: 3, label: "Outcome 3", title: "Children have a strong sense of wellbeing",
    dot: "bg-orange-500", bubble: "bg-orange-100 text-orange-800 border-orange-300",
    sub: [
      { id: "3.1", desc: "Children become strong in their social, emotional and mental health" },
      { id: "3.2", desc: "Children take increasing responsibility for their own health and physical wellbeing" },
    ],
  },
  {
    id: 4, label: "Outcome 4", title: "Children are confident and involved learners",
    dot: "bg-purple-500", bubble: "bg-purple-100 text-purple-800 border-purple-300",
    sub: [
      { id: "4.1", desc: "Children develop dispositions for learning such as curiosity, cooperation, confidence, creativity, commitment, enthusiasm, persistence, imagination and reflexivity" },
      { id: "4.2", desc: "Children use a range of skills and processes such as problem solving, inquiry, experimentation, hypothesising, researching and investigating" },
      { id: "4.3", desc: "Children transfer and adapt what they have learned from one context to another" },
      { id: "4.4", desc: "Children resource their own learning through connecting with people, place, technologies and natural and processed materials" },
    ],
  },
  {
    id: 5, label: "Outcome 5", title: "Children are effective communicators",
    dot: "bg-rose-500", bubble: "bg-rose-100 text-rose-800 border-rose-300",
    sub: [
      { id: "5.1", desc: "Children interact verbally and non-verbally with others for a range of purposes" },
      { id: "5.2", desc: "Children engage with a range of texts and make meaning from these texts" },
      { id: "5.3", desc: "Children express ideas and make meaning using a range of media" },
      { id: "5.4", desc: "Children begin to understand how symbols and pattern systems work" },
      { id: "5.5", desc: "Children use information and communication technologies to access information, investigate ideas and represent their thinking" },
    ],
  },
];

function bubbleClassForSub(subId: string) {
  const parentId = parseInt(subId.split(".")[0]);
  return MTOP_OUTCOMES.find((o) => o.id === parentId)?.bubble ?? "bg-slate-100 text-slate-700 border-slate-300";
}

function dotClassForSub(subId: string) {
  const parentId = parseInt(subId.split(".")[0]);
  return MTOP_OUTCOMES.find((o) => o.id === parentId)?.dot ?? "bg-slate-400";
}

function getWeeksInMonth(month: Date): Date[][] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  let current = start;
  while (!isAfter(current, end)) {
    const week: Date[] = [];
    for (let i = 0; i < 5; i++) {
      week.push(new Date(current));
      current = addDays(current, 1);
    }
    current = addDays(current, 2);
    weeks.push(week);
  }
  return weeks;
}

const TODAY = format(new Date(), "yyyy-MM-dd");

type ExistingPlan = { id: number; title?: string | null; weeklyPlanData?: any; siteId?: number | null };

interface WeekPlanModalProps {
  weekMonday: Date;
  siteId?: number;
  siteName?: string;
  existingPlan?: ExistingPlan;
  onClose: () => void;
  onSaved: () => void;
}

function initGridFromPlan(plan: ExistingPlan): WeeklyPlanGrid {
  const data = plan.weeklyPlanData ?? {};
  const g = emptyGrid();
  for (const key of Object.keys(g) as RowKey[]) {
    if (data[key] && typeof data[key] === "object") {
      g[key] = { ...g[key], ...data[key] };
    }
  }
  return g;
}

function WeekPlanModal({ weekMonday, siteId, siteName, existingPlan, onClose, onSaved }: WeekPlanModalProps) {
  const defaultTitle = existingPlan?.title ?? `Week of ${format(weekMonday, "d MMMM yyyy")}`;
  const [title, setTitle] = useState(defaultTitle);
  const [grid, setGrid] = useState<WeeklyPlanGrid>(() => existingPlan ? initGridFromPlan(existingPlan) : emptyGrid());
  const [cellOutcomes, setCellOutcomes] = useState<CellOutcomes>(() => existingPlan?.weeklyPlanData?.cellOutcomes ?? {});
  const { mutateAsync: create, isPending: isCreating } = useCreatePlanningExperience();
  const { mutateAsync: update, isPending: isUpdating } = useUpdatePlanningExperience();
  const isPending = isCreating || isUpdating;
  const { data: allPlanning } = useListPlanningExperiences();

  const openExperiences = (allPlanning ?? []).filter(
    (p) => p.stage !== "closed" && (siteId === undefined || p.siteId === siteId),
  );

  function setCell(row: RowKey, day: DayKey, value: string) {
    setGrid((g) => ({ ...g, [row]: { ...g[row], [day]: value } }));
  }

  function cellKey(row: RowKey, day: DayKey) {
    return `${row}-${day}`;
  }

  function toggleOutcome(row: RowKey, day: DayKey, subId: string) {
    const key = cellKey(row, day);
    setCellOutcomes((prev) => {
      const current = prev[key] ?? [];
      const exists = current.includes(subId);
      return { ...prev, [key]: exists ? current.filter((id) => id !== subId) : [...current, subId] };
    });
  }

  function removeOutcome(row: RowKey, day: DayKey, subId: string) {
    const key = cellKey(row, day);
    setCellOutcomes((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((id) => id !== subId) }));
  }

  async function handleSave() {
    const weeklyPlanData = { ...grid, cellOutcomes } as any;
    if (existingPlan) {
      await update({ id: existingPlan.id, data: { title, weeklyPlanData } });
    } else {
      await create({
        data: {
          title,
          stage: "planned",
          startDate: format(weekMonday, "yyyy-MM-dd"),
          weeklyPlanData,
          ...(siteId !== undefined ? { siteId } : {}),
        },
      });
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle>Weekly Learning & Planning Template</DialogTitle>
            {siteName && (
              <span className="shrink-0 inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 text-xs font-medium">
                {siteName}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-blue-300 px-3 py-2.5 text-left font-semibold w-44 bg-blue-600 text-white">Category</th>
                  {DAY_LABELS.map((d) => (
                    <th key={d} className="border border-blue-300 px-3 py-2.5 text-center font-semibold bg-blue-600 text-white">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROW_LABELS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border border-blue-200 px-3 py-2 font-semibold text-sm align-middle bg-blue-50 text-blue-900 whitespace-nowrap">{label}</td>
                    {DAY_KEYS.map((day) => {
                      const ck = cellKey(key, day);
                      const selected = cellOutcomes[ck] ?? [];
                      return (
                        <td key={day} className="border border-gray-200 px-2 py-1.5 align-top min-w-[140px]">
                          <Textarea
                            value={grid[key][day]}
                            onChange={(e) => setCell(key, day, e.target.value)}
                            className="min-h-[60px] text-xs resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 w-full"
                            placeholder="Add notes…"
                          />
                          {selected.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selected.map((subId) => (
                                <span
                                  key={subId}
                                  className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${bubbleClassForSub(subId)} cursor-pointer`}
                                  onClick={() => removeOutcome(key, day, subId)}
                                >
                                  {subId}
                                  <X className="h-2.5 w-2.5 opacity-60" />
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-1">
                            {key === "experiencesThemes" ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors">
                                    add
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-2" align="start">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Open Experiences</p>
                                  {openExperiences.length === 0 ? (
                                    <p className="text-xs text-muted-foreground px-1 py-2">No open experiences found.</p>
                                  ) : (
                                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                      {openExperiences.map((exp) => (
                                        <button
                                          key={exp.id}
                                          onClick={() => {
                                            const existing = grid[key][day];
                                            const appended = existing ? `${existing}\n${exp.title}` : exp.title;
                                            setCell(key, day, appended);
                                          }}
                                          className="w-full flex items-start gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-muted transition-colors"
                                        >
                                          <span className="font-medium truncate">{exp.title}</span>
                                          <Badge className="ml-auto shrink-0 text-[9px] bg-slate-100 text-slate-600 capitalize">{exp.stage}</Badge>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span />
                            )}
                            {key !== "experiencesThemes" && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="h-5 w-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-colors">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-72 p-2 max-h-[70vh] overflow-y-auto"
                                  align="end"
                                  onWheel={(e) => e.stopPropagation()}
                                >
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-1 sticky top-0 bg-white z-10">MTOP Outcomes</p>
                                  <div className="space-y-2">
                                    {MTOP_OUTCOMES.map((o) => (
                                      <div key={o.id}>
                                        <div className="flex items-center gap-1.5 px-1 mb-1">
                                          <span className={`h-2 w-2 rounded-full shrink-0 ${o.dot}`} />
                                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{o.label} — {o.title}</span>
                                        </div>
                                        <div className="space-y-0.5 pl-1">
                                          {o.sub.map((s) => {
                                            const isSelected = selected.includes(s.id);
                                            return (
                                              <button
                                                key={s.id}
                                                onClick={() => toggleOutcome(key, day, s.id)}
                                                className={`w-full flex items-start gap-2 px-2 py-1 rounded text-left text-xs transition-colors ${isSelected ? `${o.bubble} border` : "hover:bg-muted"}`}
                                              >
                                                <span className="font-semibold shrink-0 w-6">{s.id}</span>
                                                <span className="text-muted-foreground leading-snug">{s.desc}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !title.trim()}>
            {isPending ? "Saving…" : "Save Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyPlanView({ plan, siteName, onClose }: { plan: ExistingPlan; siteName?: string; onClose: () => void }) {
  const grid = initGridFromPlan(plan);
  const cellOutcomes: CellOutcomes = (plan.weeklyPlanData as any)?.cellOutcomes ?? {};

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle>{plan.title ?? "Weekly Plan"}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              {siteName && (
                <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 text-xs font-medium">
                  {siteName}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 text-xs font-medium gap-1">
                <Send className="h-3 w-3" /> Published
              </span>
            </div>
          </div>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#1a4d6e] text-white">
                <th className="border border-blue-900 px-3 py-2 text-left font-semibold w-36" />
                {DAY_LABELS.map((d) => (
                  <th key={d} className="border border-blue-900 px-2 py-2 text-center font-semibold">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_LABELS.map(({ key, label }, ri) => (
                <tr key={key} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700 whitespace-nowrap align-top">{label}</td>
                  {DAY_KEYS.map((day) => {
                    const ck = `${key}-${day}`;
                    const outcomes = cellOutcomes[ck] ?? [];
                    const text = grid[key][day];
                    return (
                      <td key={day} className="border border-slate-200 px-2 py-2 align-top min-w-[100px]">
                        {text && <p className="whitespace-pre-wrap text-slate-800 mb-1 leading-snug">{text}</p>}
                        {outcomes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {outcomes.map((subId) => (
                              <span key={subId} className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${bubbleClassForSub(subId)}`}>
                                {subId}
                              </span>
                            ))}
                          </div>
                        )}
                        {!text && outcomes.length === 0 && <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [planWeek, setPlanWeek] = useState<Date | null>(null);
  const [planExisting, setPlanExisting] = useState<ExistingPlan | null>(null);
  const [viewPlan, setViewPlan] = useState<ExistingPlan | null>(null);
  const [filterSiteId, setFilterSiteId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: sites } = useListSites();
  const { data: planning, isLoading } = useListPlanningExperiences();
  const { mutateAsync: updateStage, isPending: isPublishing } = useUpdatePlanningExperience();

  useEffect(() => {
    if (sites && sites.length > 0 && !filterSiteId) {
      setFilterSiteId(String(sites[0].id));
    }
  }, [sites]);

  const siteIdNum = filterSiteId ? Number(filterSiteId) : undefined;

  function filterBySite<T extends { siteId?: number | null }>(items: T[]): T[] {
    if (siteIdNum === undefined) return items;
    return items.filter((i) => i.siteId === siteIdNum);
  }

  const weeks = getWeeksInMonth(currentMonth);
  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  const filteredPlanning = filterBySite(planning ?? []);

  function cyclesForWeek(weekDays: Date[]) {
    const weekStart = format(weekDays[0], "yyyy-MM-dd");
    const weekEnd = format(weekDays[4], "yyyy-MM-dd");
    return filteredPlanning.filter((p) => {
      if (!p.startDate) return false;
      const d = p.startDate.slice(0, 10);
      return d >= weekStart && d <= weekEnd;
    });
  }

  function plannedCyclesForWeek(weekDays: Date[]) {
    return cyclesForWeek(weekDays).filter((p) => p.stage === "planned");
  }

  function publishedCyclesForWeek(weekDays: Date[]) {
    return cyclesForWeek(weekDays).filter((p) => p.stage === "published");
  }

  async function handlePublish(planId: number) {
    await updateStage({ id: planId, data: { stage: "published" } });
    queryClient.invalidateQueries({ queryKey: getListPlanningExperiencesQueryKey() });
  }

  const activeThisMonth = filteredPlanning.filter((p) => p.stage === "planned" || p.stage === "published");

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: getListPlanningExperiencesQueryKey() });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1">View planning cycles and programs by week.</p>
        </div>
        <Select value={filterSiteId} onValueChange={setFilterSiteId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select a site…" />
          </SelectTrigger>
          <SelectContent>
            {(sites ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg">{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid bg-muted/50" style={{ gridTemplateColumns: "repeat(5, 1fr) 80px 80px" }}>
                {weekDayHeaders.map((d) => (
                  <div key={d} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center border-r">{d}</div>
                ))}
                <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center border-r" />
                <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center" />
              </div>

              <div className="divide-y">
                {weeks.map((weekDays, wi) => {
                  const inMonth = weekDays.some((d) => d.getMonth() === currentMonth.getMonth());
                  const planned = plannedCyclesForWeek(weekDays);
                  const published = publishedCyclesForWeek(weekDays);
                  const isPlanned = planned.length > 0;
                  const isPublished = published.length > 0;
                  const monday = weekDays[0];
                  const activePlan = published[0] ?? planned[0] ?? null;

                  return (
                    <div key={wi} className={`relative ${!inMonth ? "opacity-40" : ""}`}>
                      {isPublished && (
                        <div className="absolute inset-0 pointer-events-none z-10" style={{ right: 160 }}>
                          <div className="h-full bg-blue-50/70 border-y border-blue-200 flex items-center px-3">
                            <Badge
                              className="bg-blue-100 text-blue-800 text-xs gap-1 pointer-events-auto cursor-pointer"
                              onClick={() => setViewPlan(published[0])}
                            >
                              <Send className="h-3 w-3" />
                              {published.length === 1 ? published[0].title : `${published.length} published`}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {!isPublished && isPlanned && (
                        <div className="absolute inset-0 pointer-events-none z-10" style={{ right: 160 }}>
                          <div className="h-full bg-green-50/70 border-y border-green-200 flex items-center px-3">
                            <Badge className="bg-green-100 text-green-800 text-xs gap-1 pointer-events-auto">
                              <CheckCircle2 className="h-3 w-3" />
                              {planned.length === 1 ? planned[0].title : `${planned.length} planned`}
                            </Badge>
                          </div>
                        </div>
                      )}
                      <div className="grid min-h-[80px]" style={{ gridTemplateColumns: "repeat(5, 1fr) 80px 80px" }}>
                        {weekDays.map((day, di) => (
                          <div
                            key={di}
                            className={`border-r px-2 py-1.5 ${day.getMonth() !== currentMonth.getMonth() ? "bg-muted/20" : ""}`}
                          >
                            <p className={`text-xs font-medium ${format(day, "yyyy-MM-dd") === TODAY ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              {format(day, "d")}
                            </p>
                          </div>
                        ))}

                        <div className="border-r flex items-center justify-center px-1">
                          <Button
                            size="sm"
                            variant={isPlanned || isPublished ? "ghost" : "outline"}
                            className="w-full text-xs h-8"
                            onClick={() => {
                              if (isPublished) {
                                setViewPlan(published[0]);
                              } else {
                                setPlanWeek(monday);
                                setPlanExisting(planned[0] ?? null);
                              }
                            }}
                          >
                            Plan
                          </Button>
                        </div>
                        <div className="flex items-center justify-center px-1">
                          <Button
                            size="sm"
                            variant={isPublished ? "ghost" : "outline"}
                            disabled={!isPlanned && !isPublished}
                            className={`w-full text-xs h-8 ${isPublished ? "text-blue-600" : ""}`}
                            onClick={() => {
                              if (isPublished) {
                                setViewPlan(published[0]);
                              } else if (isPlanned) {
                                handlePublish(planned[0].id);
                              }
                            }}
                          >
                            {isPublished ? <><Send className="h-3 w-3 mr-1" />Published</> : "Publish"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Planning Cycles</CardTitle>
                {activeThisMonth.filter((p) => p.stage === "planned").length > 0 && (
                  <Badge className="bg-green-100 text-green-800">{activeThisMonth.filter((p) => p.stage === "planned").length} planned</Badge>
                )}
                {activeThisMonth.filter((p) => p.stage === "published").length > 0 && (
                  <Badge className="bg-blue-100 text-blue-800">{activeThisMonth.filter((p) => p.stage === "published").length} published</Badge>
                )}
              </div>
              <Link href="/planning">
                <span className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {activeThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No planned cycles for this site yet.
              </p>
            ) : (
              <div className="divide-y">
                {activeThisMonth.map((p) => {
                  const isPublishedPlan = p.stage === "published";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between py-3 px-1 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                      onClick={() => isPublishedPlan ? setViewPlan(p) : undefined}
                    >
                      {!isPublishedPlan ? (
                        <Link href={`/planning/${p.id}`} className="contents">
                          <div>
                            <p className="text-sm font-medium">{p.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.startDate ? `Starts ${format(parseISO(p.startDate), "MMM d, yyyy")}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800 text-xs">Planned</Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div>
                            <p className="text-sm font-medium">{p.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {p.startDate ? `Starts ${format(parseISO(p.startDate), "MMM d, yyyy")}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-blue-100 text-blue-800 text-xs gap-1">
                              <Send className="h-3 w-3" /> Published
                            </Badge>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {planWeek && (
        <WeekPlanModal
          weekMonday={planWeek}
          siteId={siteIdNum}
          siteName={(sites ?? []).find((s) => s.id === siteIdNum)?.name}
          existingPlan={planExisting ?? undefined}
          onClose={() => { setPlanWeek(null); setPlanExisting(null); }}
          onSaved={handleSaved}
        />
      )}

      {viewPlan && (
        <ReadOnlyPlanView
          plan={viewPlan}
          siteName={(sites ?? []).find((s) => s.id === viewPlan.siteId)?.name}
          onClose={() => setViewPlan(null)}
        />
      )}
    </div>
  );
}
