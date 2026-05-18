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
import { ChevronLeft, ChevronRight, Layers, ArrowRight, CheckCircle2, Plus, X, Send, AlertTriangle, CopyCheck } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, format, parseISO, isBefore, isAfter, addDays,
} from "date-fns";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListPlanningExperiencesQueryKey } from "@workspace/api-client-react";
import {
  ReadOnlyPlanView, ExistingPlan,
  DayKey, RowKey, ROW_LABELS, DAY_KEYS, DAY_LABELS,
  WeeklyPlanGrid, CellOutcomes,
  emptyGrid, initGridFromPlan, bubbleClassForSub, dotClassForSub, MTOP_OUTCOMES,
} from "@/components/read-only-plan-view";

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
  siteId?: number;
  siteName?: string;
  existingPlan?: ExistingPlan;
  onClose: () => void;
  onSaved: () => void;
}

function WeekPlanModal({ weekMonday, siteId, siteName, existingPlan, onClose, onSaved }: WeekPlanModalProps) {
  const defaultTitle = existingPlan?.title ?? `Week of ${format(weekMonday, "d MMMM yyyy")}`;
  const [title, setTitle] = useState(defaultTitle);
  const [grid, setGrid] = useState<WeeklyPlanGrid>(() => existingPlan ? initGridFromPlan(existingPlan) : emptyGrid());
  const [cellOutcomes, setCellOutcomes] = useState<CellOutcomes>(() => existingPlan?.weeklyPlanData?.cellOutcomes ?? {});
  const [copyFromId, setCopyFromId] = useState<string>("");
  const [copyConfirm, setCopyConfirm] = useState(false);
  const { mutateAsync: create, isPending: isCreating } = useCreatePlanningExperience();
  const { mutateAsync: update, isPending: isUpdating } = useUpdatePlanningExperience();
  const isPending = isCreating || isUpdating;
  const { data: allPlanning } = useListPlanningExperiences();

  const openExperiences = (allPlanning ?? []).filter(
    (p) => p.stage !== "closed" && (siteId === undefined || p.siteId === siteId),
  );

  // Build a list of prior plans from the last 4 weeks (same site, must have grid data)
  const priorWeekOptions = Array.from({ length: 4 }, (_, i) => {
    const offsetDays = (i + 1) * 7;
    const wkMonday = addDays(weekMonday, -offsetDays);
    const wkFriday = addDays(weekMonday, -(offsetDays - 4));
    const wkMondayStr = format(wkMonday, "yyyy-MM-dd");
    const wkFridayStr = format(wkFriday, "yyyy-MM-dd");
    const plan = (allPlanning ?? []).find((p) => {
      if (!p.startDate || p.weeklyPlanData == null) return false;
      const d = p.startDate.slice(0, 10);
      return d >= wkMondayStr && d <= wkFridayStr &&
        (siteId === undefined || p.siteId === siteId);
    });
    if (!plan) return null;
    const weekLabel = i === 0 ? "1 week ago" : `${i + 1} weeks ago`;
    return {
      plan,
      label: `${weekLabel} — ${plan.title ?? format(wkMonday, "d MMM yyyy")}`,
    };
  }).filter(Boolean) as { plan: ExistingPlan; label: string }[];

  const selectedPriorPlan = priorWeekOptions.find((o) => String(o.plan.id) === copyFromId)?.plan ?? null;

  function applyCopyFrom() {
    if (!selectedPriorPlan) return;
    setGrid(initGridFromPlan(selectedPriorPlan));
    setCellOutcomes(selectedPriorPlan.weeklyPlanData?.cellOutcomes ?? {});
    setCopyFromId("");
    setCopyConfirm(false);
  }

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
      await update({ id: existingPlan.id, data: { title, weeklyPlanData, stage: "planned" } });
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

        {existingPlan?.stage === "published" && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>This plan is currently published. Saving changes will revert it to draft — guardians won't see updates until you re-publish.</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Plan title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {priorWeekOptions.length > 0 && (
            copyConfirm && selectedPriorPlan ? (
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
                <CopyCheck className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-800 flex-1">
                  This will replace the current grid with the selected week's content. Continue?
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCopyConfirm(false)}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" onClick={applyCopyFrom}>Yes, apply</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <CopyCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">Start with a prior week:</span>
                <Select
                  value={copyFromId}
                  onValueChange={(val) => { setCopyFromId(val); setCopyConfirm(false); }}
                >
                  <SelectTrigger className="h-8 text-xs w-72">
                    <SelectValue placeholder="Choose a week…" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorWeekOptions.map((o) => (
                      <SelectItem key={o.plan.id} value={String(o.plan.id)} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {copyFromId && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setCopyConfirm(true)}
                  >
                    Apply
                  </Button>
                )}
              </div>
            )
          )}

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

export default function Calendar() {
  const search = useSearch();
  const isGuardianMode = new URLSearchParams(search).get("mode") === "guardian";

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
          <p className="text-muted-foreground mt-1">
            {isGuardianMode ? "Published weekly learning programs." : "Create and publish weekly learning programs for guardians."}
          </p>
        </div>
        {!isGuardianMode && (
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
        )}
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
              <div className="grid bg-muted/50" style={{ gridTemplateColumns: isGuardianMode ? "repeat(5, 1fr)" : "repeat(5, 1fr) 80px 80px" }}>
                {weekDayHeaders.map((d) => (
                  <div key={d} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center border-r">{d}</div>
                ))}
                {!isGuardianMode && <>
                  <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center border-r" />
                  <div className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center" />
                </>}
              </div>

              <div className="divide-y">
                {weeks.map((weekDays, wi) => {
                  const inMonth = weekDays.some((d) => d.getMonth() === currentMonth.getMonth());
                  const planned = plannedCyclesForWeek(weekDays);
                  const published = publishedCyclesForWeek(weekDays);
                  const isPlanned = planned.length > 0;
                  const isPublished = published.length > 0;
                  const monday = weekDays[0];

                  // In guardian mode, only show weeks that have a published plan
                  if (isGuardianMode && !isPublished) return null;

                  return (
                    <div
                      key={wi}
                      className={`relative ${!inMonth ? "opacity-40" : ""} ${isGuardianMode ? "cursor-pointer" : ""}`}
                      onClick={isGuardianMode && isPublished ? () => setViewPlan(published[0]) : undefined}
                    >
                      {isPublished && (
                        <div className="absolute inset-0 pointer-events-none z-10" style={{ right: isGuardianMode ? 0 : 160 }}>
                          <div className="h-full bg-green-50/70 border-y border-green-200 flex items-center px-3">
                            <Badge
                              className="bg-green-100 text-green-800 text-xs gap-1 pointer-events-auto cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); setViewPlan(published[0]); }}
                            >
                              <Send className="h-3 w-3" />
                              {published.length === 1 ? published[0].title : `${published.length} published`}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {!isGuardianMode && !isPublished && isPlanned && (
                        <div className="absolute inset-0 pointer-events-none z-10" style={{ right: 160 }}>
                          <div className="h-full bg-blue-50/70 border-y border-blue-200 flex items-center px-3">
                            <Badge className="bg-blue-100 text-blue-800 text-xs gap-1 pointer-events-auto">
                              <CheckCircle2 className="h-3 w-3" />
                              {planned.length === 1 ? planned[0].title : `${planned.length} planned`}
                            </Badge>
                          </div>
                        </div>
                      )}
                      <div className="grid min-h-[80px]" style={{ gridTemplateColumns: isGuardianMode ? "repeat(5, 1fr)" : "repeat(5, 1fr) 80px 80px" }}>
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

                        {!isGuardianMode && <>
                          <div className="border-r flex items-center justify-center px-1">
                            <Button
                              size="sm"
                              variant={isPlanned || isPublished ? "ghost" : "outline"}
                              className="w-full text-xs h-8"
                              onClick={() => {
                                setPlanWeek(monday);
                                setPlanExisting(isPublished ? published[0] : (planned[0] ?? null));
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
                              className={`w-full text-xs h-8 ${isPublished ? "text-green-700" : ""}`}
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
                        </>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isGuardianMode && !isLoading && weeks.every((wd) => publishedCyclesForWeek(wd).length === 0) && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No published learning programs for this month.
          </CardContent>
        </Card>
      )}

      {!isGuardianMode && !isLoading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Planning Cycles</CardTitle>
                {activeThisMonth.filter((p) => p.stage === "planned").length > 0 && (
                  <Badge className="bg-blue-100 text-blue-800">{activeThisMonth.filter((p) => p.stage === "planned").length} planned</Badge>
                )}
                {activeThisMonth.filter((p) => p.stage === "published").length > 0 && (
                  <Badge className="bg-green-100 text-green-800">{activeThisMonth.filter((p) => p.stage === "published").length} published</Badge>
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
                            <Badge className="bg-blue-100 text-blue-800 text-xs">Planned</Badge>
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
                            <Badge className="bg-green-100 text-green-800 text-xs gap-1">
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
