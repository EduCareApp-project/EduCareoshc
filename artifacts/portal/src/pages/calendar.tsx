import { useState } from "react";
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
import { ChevronLeft, ChevronRight, Layers, ArrowRight, CheckCircle2 } from "lucide-react";
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

function emptyGrid(): WeeklyPlanGrid {
  const grid: Partial<WeeklyPlanGrid> = {};
  for (const { key } of ROW_LABELS) {
    grid[key] = { mon: "", tue: "", wed: "", thu: "", fri: "" };
  }
  return grid as WeeklyPlanGrid;
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

interface WeekPlanModalProps {
  weekMonday: Date;
  onClose: () => void;
  onSaved: () => void;
}

function WeekPlanModal({ weekMonday, onClose, onSaved }: WeekPlanModalProps) {
  const [title, setTitle] = useState(`Week of ${format(weekMonday, "d MMMM yyyy")}`);
  const [grid, setGrid] = useState<WeeklyPlanGrid>(emptyGrid);
  const { mutateAsync: create, isPending } = useCreatePlanningExperience();

  function setCell(row: RowKey, day: DayKey, value: string) {
    setGrid((g) => ({ ...g, [row]: { ...g[row], [day]: value } }));
  }

  async function handleSave() {
    await create({
      data: {
        title,
        stage: "planned",
        startDate: format(weekMonday, "yyyy-MM-dd"),
        weeklyPlanData: grid as any,
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
                <tr className="bg-muted/60">
                  <th className="border px-3 py-2 text-left font-semibold w-40 text-muted-foreground">Category</th>
                  {DAY_LABELS.map((d) => (
                    <th key={d} className="border px-3 py-2 text-center font-semibold text-muted-foreground">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROW_LABELS.map(({ key, label }) => (
                  <tr key={key} className="even:bg-muted/20">
                    <td className="border px-3 py-2 font-medium text-sm align-top whitespace-nowrap">{label}</td>
                    {DAY_KEYS.map((day) => (
                      <td key={day} className="border px-2 py-1 align-top">
                        <Textarea
                          value={grid[key][day]}
                          onChange={(e) => setCell(key, day, e.target.value)}
                          className="min-h-[72px] text-xs resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent p-0"
                          placeholder="Add notes…"
                        />
                      </td>
                    ))}
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
  const [filterSiteId, setFilterSiteId] = useState<string>("__all__");
  const queryClient = useQueryClient();

  const { data: sites } = useListSites();
  const { data: planning, isLoading } = useListPlanningExperiences();

  const siteIdNum = filterSiteId === "__all__" ? undefined : Number(filterSiteId);

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

  const plannedThisMonth = filteredPlanning.filter((p) => {
    if (p.stage !== "planned" || !p.startDate) return false;
    const d = parseISO(p.startDate);
    return !isAfter(d, endOfMonth(currentMonth)) && !isBefore(d, startOfMonth(currentMonth));
  });

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
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Sites</SelectItem>
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
                <CardTitle className="text-base">Planning Cycles This Month</CardTitle>
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
                No planned cycles starting in {format(currentMonth, "MMMM yyyy")}.
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
