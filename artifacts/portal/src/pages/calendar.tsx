import { useState, useEffect } from "react";
import { useListPlanningExperiences, useCreatePlanningExperience, useListSites } from "@workspace/api-client-react";
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
import { ChevronLeft, ChevronRight, Layers, ArrowRight, CheckCircle2, Plus, X } from "lucide-react";
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
type CellOutcomes = Record<string, number[]>;

function emptyGrid(): WeeklyPlanGrid {
  const grid: Partial<WeeklyPlanGrid> = {};
  for (const { key } of ROW_LABELS) {
    grid[key] = { mon: "", tue: "", wed: "", thu: "", fri: "" };
  }
  return grid as WeeklyPlanGrid;
}

const MTOP_OUTCOMES = [
  { id: 1, label: "Outcome 1", description: "Strong sense of identity", color: "bg-blue-500" },
  { id: 2, label: "Outcome 2", description: "Connected to their world", color: "bg-green-500" },
  { id: 3, label: "Outcome 3", description: "Strong sense of wellbeing", color: "bg-orange-500" },
  { id: 4, label: "Outcome 4", description: "Confident & involved learners", color: "bg-purple-500" },
  { id: 5, label: "Outcome 5", description: "Effective communicators", color: "bg-rose-500" },
];

const OUTCOME_BUBBLE: Record<number, string> = {
  1: "bg-blue-100 text-blue-800 border-blue-300",
  2: "bg-green-100 text-green-800 border-green-300",
  3: "bg-orange-100 text-orange-800 border-orange-300",
  4: "bg-purple-100 text-purple-800 border-purple-300",
  5: "bg-rose-100 text-rose-800 border-rose-300",
};

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

interface WeekPlanModalProps {
  weekMonday: Date;
  onClose: () => void;
  onSaved: () => void;
}

function WeekPlanModal({ weekMonday, onClose, onSaved }: WeekPlanModalProps) {
  const [title, setTitle] = useState(`Week of ${format(weekMonday, "d MMMM yyyy")}`);
  const [grid, setGrid] = useState<WeeklyPlanGrid>(emptyGrid);
  const [cellOutcomes, setCellOutcomes] = useState<CellOutcomes>({});
  const { mutateAsync: create, isPending } = useCreatePlanningExperience();
  const { data: allPlanning } = useListPlanningExperiences();

  const openExperiences = (allPlanning ?? []).filter((p) => p.stage !== "closed" && p.stage !== "planned");

  function setCell(row: RowKey, day: DayKey, value: string) {
    setGrid((g) => ({ ...g, [row]: { ...g[row], [day]: value } }));
  }

  function cellKey(row: RowKey, day: DayKey) {
    return `${row}-${day}`;
  }

  function toggleOutcome(row: RowKey, day: DayKey, outcomeId: number) {
    const key = cellKey(row, day);
    setCellOutcomes((prev) => {
      const current = prev[key] ?? [];
      const exists = current.includes(outcomeId);
      return { ...prev, [key]: exists ? current.filter((id) => id !== outcomeId) : [...current, outcomeId] };
    });
  }

  function removeOutcome(row: RowKey, day: DayKey, outcomeId: number) {
    const key = cellKey(row, day);
    setCellOutcomes((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((id) => id !== outcomeId) }));
  }

  async function handleSave() {
    await create({
      data: {
        title,
        stage: "planned",
        startDate: format(weekMonday, "yyyy-MM-dd"),
        weeklyPlanData: { ...grid, cellOutcomes } as any,
      },
    });
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Weekly Learning & Planning Template</DialogTitle>
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
                              {selected.map((id) => {
                                const o = MTOP_OUTCOMES.find((o) => o.id === id)!;
                                return (
                                  <span
                                    key={id}
                                    className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${OUTCOME_BUBBLE[id]} cursor-pointer`}
                                    onClick={() => removeOutcome(key, day, id)}
                                    title={o.description}
                                  >
                                    {o.label}
                                    <X className="h-2.5 w-2.5 opacity-60" />
                                  </span>
                                );
                              })}
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
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="h-5 w-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-colors">
                                  <Plus className="h-3 w-3" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-2" align="end">
                                <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">MTOP Outcomes</p>
                                <div className="space-y-1">
                                  {MTOP_OUTCOMES.map((o) => {
                                    const isSelected = selected.includes(o.id);
                                    return (
                                      <button
                                        key={o.id}
                                        onClick={() => toggleOutcome(key, day, o.id)}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${isSelected ? `${OUTCOME_BUBBLE[o.id]} border` : "hover:bg-muted"}`}
                                      >
                                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${o.color}`} />
                                        <span className="font-medium">{o.label}</span>
                                        <span className="text-muted-foreground truncate">{o.description}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
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

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [planWeek, setPlanWeek] = useState<Date | null>(null);
  const [filterSiteId, setFilterSiteId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: sites } = useListSites();
  const { data: planning, isLoading } = useListPlanningExperiences();

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

  const plannedThisMonth = filteredPlanning.filter((p) => p.stage === "planned");

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
                  const isPlanned = planned.length > 0;
                  const monday = weekDays[0];

                  return (
                    <div key={wi} className={`relative ${!inMonth ? "opacity-40" : ""}`}>
                      {isPlanned && (
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
                            variant={isPlanned ? "ghost" : "outline"}
                            className="w-full text-xs h-8"
                            onClick={() => setPlanWeek(monday)}
                          >
                            Plan
                          </Button>
                        </div>
                        <div className="flex items-center justify-center px-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8"
                            onClick={() => {}}
                          >
                            Publish
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
                {plannedThisMonth.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-800">{plannedThisMonth.length} planned</Badge>
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
            {plannedThisMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No planned cycles for this site yet.
              </p>
            ) : (
              <div className="divide-y">
                {plannedThisMonth.map((p) => (
                  <Link key={p.id} href={`/planning/${p.id}`}>
                    <div className="flex items-center justify-between py-3 px-1 hover:bg-muted/50 rounded cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.startDate ? `Starts ${format(parseISO(p.startDate), "MMM d, yyyy")}` : ""}
                          {p.preparedBy ? ` · By ${p.preparedBy}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800 text-xs">Planned</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {planWeek && (
        <WeekPlanModal
          weekMonday={planWeek}
          onClose={() => setPlanWeek(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
