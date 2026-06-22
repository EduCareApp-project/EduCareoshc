import { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  useListPlanningExperiences, useCreatePlanningExperience, useUpdatePlanningExperience, useListSites,
  useListWeeklyReviews, useCreateWeeklyReview, useUpdateWeeklyReview, useDeleteWeeklyReview,
  useGetWeeklyReviewStats, useListStaff,
  getListPlanningExperiencesQueryKey, getListWeeklyReviewsQueryKey, getGetWeeklyReviewStatsQueryKey,
  WeeklyReview as WeeklyReviewItem, Site, PlanningExperience,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Layers, ArrowRight, CheckCircle2, Plus, X, Send, AlertTriangle, CopyCheck, ClipboardList, Copy,
  ClipboardCheck, User, StickyNote, BookOpen, Newspaper, Pencil, Trash2,
} from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, subWeeks, format, parseISO, isBefore, isAfter, addDays, startOfToday,
} from "date-fns";
import { Link, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import {
  ReadOnlyPlanView, ExistingPlan,
  DayKey, RowKey, ROW_LABELS, DAY_KEYS, DAY_LABELS,
  WeeklyPlanGrid, CellOutcomes,
  emptyGrid, initGridFromPlan, bubbleClassForSub, dotClassForSub, MTOP_OUTCOMES,
} from "@/components/read-only-plan-view";

function AutoResizeTextarea({
  value, onChange, className, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={className}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
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
  siteId?: number;
  siteName?: string;
  existingPlan?: ExistingPlan;
  onClose: () => void;
  onSaved: () => void;
  isAdmin?: boolean;
}

function WeekPlanModal({ weekMonday, siteId, siteName, existingPlan, onClose, onSaved, isAdmin }: WeekPlanModalProps) {
  const { toast } = useToast();
  const defaultTitle = existingPlan?.title ?? `Week of ${format(weekMonday, "dd/MM/yyyy")}`;
  const [title, setTitle] = useState(defaultTitle);
  const [grid, setGrid] = useState<WeeklyPlanGrid>(() => existingPlan ? initGridFromPlan(existingPlan) : emptyGrid());
  const [cellOutcomes, setCellOutcomes] = useState<CellOutcomes>(() => existingPlan?.weeklyPlanData?.cellOutcomes ?? {});
  const [copyFromId, setCopyFromId] = useState<string>("");
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateSiteId, setDuplicateSiteId] = useState<string>("");
  const [isDuplicating, setIsDuplicating] = useState(false);
  const { mutateAsync: create, isPending: isCreating } = useCreatePlanningExperience();
  const { mutateAsync: update, isPending: isUpdating } = useUpdatePlanningExperience();
  const isPending = isCreating || isUpdating;
  const { data: allPlanning } = useListPlanningExperiences();
  const { data: allSites } = useListSites();
  const otherSites = (allSites ?? []).filter((s) => s.id !== siteId);

  const openExperiences = (allPlanning ?? []).filter(
    (p) =>
      p.stage === "planned" &&
      p.weeklyPlanData == null &&
      (siteId === undefined || p.siteId === siteId),
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
      label: `${weekLabel} — ${plan.title ?? format(wkMonday, "dd/MM/yyyy")}`,
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

  async function handleDuplicate() {
    if (!existingPlan || !duplicateSiteId) return;
    setIsDuplicating(true);
    try {
      const weeklyPlanData = { ...grid, cellOutcomes } as any;
      const targetSite = otherSites.find((s) => s.id === Number(duplicateSiteId));
      await create({
        data: {
          title,
          stage: "planned",
          startDate: format(weekMonday, "yyyy-MM-dd"),
          weeklyPlanData,
          siteId: Number(duplicateSiteId),
        },
      });
      onSaved();
      toast({ title: "Plan duplicated", description: `Copied to ${targetSite?.name ?? "service"}` });
      onClose();
    } catch {
      toast({ title: "Failed to duplicate plan", variant: "destructive" });
    } finally {
      setIsDuplicating(false);
    }
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
            <span>This plan is currently published. Saving changes will revert it to draft — guardians won't see updates until you re-publish. Parents will <strong>not</strong> be notified again when you republish.</span>
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
                          <AutoResizeTextarea
                            value={grid[key][day]}
                            onChange={(v) => setCell(key, day, v)}
                            className="min-h-[60px] text-xs border-0 shadow-none bg-transparent p-0 w-full focus:outline-none"
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

        <DialogFooter className="pt-2 flex-wrap gap-2">
          {isAdmin && existingPlan && otherSites.length > 0 && (
            showDuplicate ? (
              <div className="flex items-center gap-2 mr-auto flex-wrap">
                <Select value={duplicateSiteId} onValueChange={setDuplicateSiteId}>
                  <SelectTrigger className="h-8 text-xs w-52">
                    <SelectValue placeholder="Choose service…" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherSites.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-xs">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={!duplicateSiteId || isDuplicating}
                  onClick={handleDuplicate}
                >
                  <Copy className="h-3.5 w-3.5" />
                  {isDuplicating ? "Duplicating…" : "Duplicate"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowDuplicate(false); setDuplicateSiteId(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="mr-auto h-9 text-xs gap-1.5"
                onClick={() => setShowDuplicate(true)}
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate to service…
              </Button>
            )
          )}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending || !title.trim()}>
            {isPending ? "Saving…" : "Save Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const REVIEW_QUESTIONS: { key: keyof WeeklyReviewItem; label: string; icon: React.ElementType }[] = [
  { key: "weeklySummary",       label: "Weekly summary",                    icon: StickyNote },
  { key: "goalsAchieved",       label: "Goals achieved",                    icon: CheckCircle2 },
  { key: "environmentChanges",  label: "Environment changes",               icon: Layers },
  { key: "weekQuality",         label: "Quality of the week",               icon: BookOpen },
  { key: "professionalEnquiry", label: "Professional enquiry / reflection", icon: User },
  { key: "childEngagement",     label: "Child engagement highlights",       icon: Newspaper },
];

function pastMondayOptions(n = 24): Date[] {
  const today = startOfToday();
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  const start = isBefore(thisMonday, today) ? thisMonday : subWeeks(thisMonday, 1);
  return Array.from({ length: n }, (_, i) => subWeeks(start, i));
}

interface WeeklyReviewSectionProps {
  siteId: number | undefined;
  sites: Site[];
  pastPublishedWeeks: PlanningExperience[];
}

function WeeklyReviewSection({ siteId, sites, pastPublishedWeeks }: WeeklyReviewSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<WeeklyReviewItem | null>(null);
  const [viewPlan, setViewPlan] = useState<PlanningExperience | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);

  const weekOptions = pastMondayOptions(24);
  const defaultWeek = weekOptions[0] ? format(weekOptions[0], "yyyy-MM-dd") : "";

  const [formSiteId, setFormSiteId]           = useState<string>("");
  const [formWeekStart, setFormWeekStart]     = useState<string>(defaultWeek);
  const [formPlanTitle, setFormPlanTitle]     = useState<string>("");
  const [formCompletedById, setFormCompletedById] = useState<string>("");
  const [formWeeklySummary, setFormWeeklySummary]         = useState("");
  const [formGoalsAchieved, setFormGoalsAchieved]         = useState("");
  const [formEnvironmentChanges, setFormEnvironmentChanges] = useState("");
  const [formWeekQuality, setFormWeekQuality]             = useState("");
  const [formProfessionalEnquiry, setFormProfessionalEnquiry] = useState("");
  const [formChildEngagement, setFormChildEngagement]     = useState("");

  const { data: reviews, isLoading: reviewsLoading } = useListWeeklyReviews();
  const { data: staff } = useListStaff();
  const { mutateAsync: create, isPending: isCreating } = useCreateWeeklyReview();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateWeeklyReview();
  const { mutateAsync: remove } = useDeleteWeeklyReview();

  const statsParams = formSiteId && formWeekStart
    ? { siteId: Number(formSiteId), weekStart: formWeekStart }
    : undefined;
  const { data: stats } = useGetWeeklyReviewStats(statsParams!, {
    query: {
      enabled: !!statsParams,
      queryKey: getGetWeeklyReviewStatsQueryKey(statsParams),
    },
  });

  const siteStaff = (staff ?? []).filter((s) =>
    !formSiteId || s.siteId === Number(formSiteId)
  );

  function reviewForPlan(plan: PlanningExperience): WeeklyReviewItem | undefined {
    const weekStart = plan.startDate?.slice(0, 10);
    if (!weekStart) return undefined;
    return (reviews ?? []).find(
      (r) => r.weekStart === weekStart && r.siteId === (plan.siteId ?? siteId)
    );
  }

  function openReviewForm(plan: PlanningExperience, existing?: WeeklyReviewItem) {
    const weekStart = plan.startDate?.slice(0, 10) ?? defaultWeek;
    const planSiteId = plan.siteId ?? siteId;
    const matchingStaff = (staff ?? []).find(
      (s) => s.email === user?.email && (!planSiteId || s.siteId === planSiteId)
    );
    if (existing) {
      setEditing(existing);
      setFormSiteId(String(existing.siteId));
      setFormWeekStart(existing.weekStart);
      setFormCompletedById(String(existing.completedById));
      setFormWeeklySummary(existing.weeklySummary ?? "");
      setFormGoalsAchieved(existing.goalsAchieved ?? "");
      setFormEnvironmentChanges(existing.environmentChanges ?? "");
      setFormWeekQuality(existing.weekQuality ?? "");
      setFormProfessionalEnquiry(existing.professionalEnquiry ?? "");
      setFormChildEngagement(existing.childEngagement ?? "");
    } else {
      setEditing(null);
      setFormSiteId(planSiteId ? String(planSiteId) : "");
      setFormWeekStart(weekStart);
      setFormCompletedById(matchingStaff ? String(matchingStaff.id) : "");
      setFormWeeklySummary("");
      setFormGoalsAchieved("");
      setFormEnvironmentChanges("");
      setFormWeekQuality("");
      setFormProfessionalEnquiry("");
      setFormChildEngagement("");
    }
    setFormPlanTitle(plan.title ?? "");
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!formSiteId || !formWeekStart || !formCompletedById) return;
    const data = {
      weekStart: formWeekStart,
      siteId: Number(formSiteId),
      completedById: Number(formCompletedById),
      weeklySummary: formWeeklySummary || undefined,
      goalsAchieved: formGoalsAchieved || undefined,
      environmentChanges: formEnvironmentChanges || undefined,
      weekQuality: formWeekQuality || undefined,
      professionalEnquiry: formProfessionalEnquiry || undefined,
      childEngagement: formChildEngagement || undefined,
    };
    try {
      if (editing) {
        await update({ id: editing.id, data });
        toast({ title: "Review updated" });
      } else {
        await create({ data });
        toast({ title: "Review saved" });
      }
      queryClient.invalidateQueries({ queryKey: getListWeeklyReviewsQueryKey() });
      setSheetOpen(false);
    } catch {
      toast({ title: "Failed to save review", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    try {
      await remove({ id });
      queryClient.invalidateQueries({ queryKey: getListWeeklyReviewsQueryKey() });
      toast({ title: "Review deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  const isPending = isCreating || isUpdating;

  const pendingCount = pastPublishedWeeks.filter((p) => !reviewForPlan(p)).length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Weekly Review</CardTitle>
            {pendingCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">{pendingCount} pending</Badge>
            )}
            {pastPublishedWeeks.length > 0 && pendingCount === 0 && (
              <Badge className="bg-green-100 text-green-800 text-xs">All reviewed</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Past published weeks — click a row to view the programme, then write your review.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {reviewsLoading ? (
            <div className="px-6 pb-4 space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : pastPublishedWeeks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-6">
              No past published weekly plans yet — publish a weekly plan and it will appear here once the week ends.
            </p>
          ) : (
            <div className="divide-y">
              {pastPublishedWeeks.map((plan) => {
                const existingReview = reviewForPlan(plan);
                const isReviewed = !!existingReview;
                const isExpanded = expandedReviewId === plan.id;
                const siteName = sites.find((s) => s.id === plan.siteId)?.name ?? "";
                const weekLabel = plan.startDate
                  ? `Week of ${format(parseISO(plan.startDate.slice(0, 10)), "dd/MM/yyyy")}`
                  : "";
                return (
                  <div key={plan.id}>
                    <div
                      className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => setViewPlan(plan)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{plan.title}</p>
                          {isReviewed ? (
                            <Badge className="bg-green-100 text-green-800 text-xs gap-1 shrink-0">
                              <CheckCircle2 className="h-3 w-3" /> Reviewed
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 text-xs shrink-0">
                              Needs review
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {weekLabel}{siteName ? ` · ${siteName}` : ""}
                          {isReviewed && existingReview && (
                            <> · by {existingReview.completedByName}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                        {isReviewed && existingReview ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => setExpandedReviewId(isExpanded ? null : plan.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {isExpanded ? "Hide" : "View"}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openReviewForm(plan, existingReview)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete review?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the review for {weekLabel}. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(existingReview.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => openReviewForm(plan)}
                          >
                            <Plus className="h-3.5 w-3.5" /> Write review
                          </Button>
                        )}
                      </div>
                    </div>
                    {isExpanded && existingReview && (
                      <div className="px-6 pb-5 pt-2 space-y-3 bg-muted/20 border-t">
                        {REVIEW_QUESTIONS.map(({ key, label, icon: Icon }) => {
                          const val = existingReview[key] as string | null | undefined;
                          if (!val) return null;
                          return (
                            <div key={key}>
                              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                                <Icon className="h-3.5 w-3.5" />{label}
                              </p>
                              <p className="text-sm whitespace-pre-wrap">{val}</p>
                            </div>
                          );
                        })}
                        {REVIEW_QUESTIONS.every(({ key }) => !existingReview[key as keyof WeeklyReviewItem]) && (
                          <p className="text-sm text-muted-foreground italic">No reflections recorded.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {viewPlan && (
        <ReadOnlyPlanView
          plan={viewPlan as ExistingPlan}
          siteName={sites.find((s) => s.id === viewPlan.siteId)?.name}
          onClose={() => setViewPlan(null)}
        />
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{editing ? "Edit Weekly Review" : "Weekly Review"}</SheetTitle>
            {formPlanTitle && (
              <p className="text-sm text-muted-foreground">{formPlanTitle}</p>
            )}
          </SheetHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Week (Monday)</Label>
                <Select value={formWeekStart} onValueChange={setFormWeekStart}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select week…" />
                  </SelectTrigger>
                  <SelectContent>
                    {weekOptions.map((d) => (
                      <SelectItem key={format(d, "yyyy-MM-dd")} value={format(d, "yyyy-MM-dd")} className="text-sm">
                        {format(d, "dd/MM/yyyy")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service</Label>
                <Select value={formSiteId} onValueChange={setFormSiteId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select site…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)} className="text-sm">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Completed by</Label>
              <Select value={formCompletedById} onValueChange={setFormCompletedById}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select staff member…" />
                </SelectTrigger>
                <SelectContent>
                  {siteStaff.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} className="text-sm">{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {stats && (
              <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
                <span className="font-medium text-muted-foreground text-xs">This week:</span>
                <span className="flex items-center gap-1 text-xs"><StickyNote className="h-3.5 w-3.5 text-muted-foreground" />{stats.jottingsCount} jottings</span>
                <span className="flex items-center gap-1 text-xs"><BookOpen className="h-3.5 w-3.5 text-muted-foreground" />{stats.observationsCount} obs</span>
                <span className="flex items-center gap-1 text-xs"><Newspaper className="h-3.5 w-3.5 text-muted-foreground" />{stats.postsCount} posts</span>
              </div>
            )}

            <Separator />

            {REVIEW_QUESTIONS.map(({ key, label, icon: Icon }) => {
              const fieldMap: Record<string, [string, (v: string) => void]> = {
                weeklySummary:       [formWeeklySummary,       setFormWeeklySummary],
                goalsAchieved:       [formGoalsAchieved,       setFormGoalsAchieved],
                environmentChanges:  [formEnvironmentChanges,  setFormEnvironmentChanges],
                weekQuality:         [formWeekQuality,         setFormWeekQuality],
                professionalEnquiry: [formProfessionalEnquiry, setFormProfessionalEnquiry],
                childEngagement:     [formChildEngagement,     setFormChildEngagement],
              };
              const [val, setVal] = fieldMap[key as string];
              return (
                <div key={key} className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />{label}
                  </Label>
                  <Textarea
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder={`Describe ${label.toLowerCase()}…`}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>
              );
            })}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isPending || !formSiteId || !formWeekStart || !formCompletedById}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Save Review"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function Calendar() {
  const search = useSearch();
  const isGuardianMode = new URLSearchParams(search).get("mode") === "guardian";
  const { isEducatorRole, ownSiteId, isAdmin } = usePermissions();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [planWeek, setPlanWeek] = useState<Date | null>(null);
  const [planExisting, setPlanExisting] = useState<ExistingPlan | null>(null);
  const [viewPlan, setViewPlan] = useState<ExistingPlan | null>(null);
  const [filterSiteId, setFilterSiteId] = useState<string>(() =>
    isEducatorRole && ownSiteId ? String(ownSiteId) : ""
  );
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

  const activeThisMonth = filteredPlanning.filter((p) =>
    p.weeklyPlanData == null && (p.stage === "planned" || p.stage === "published")
  );

  const today = startOfToday();
  const pastPublishedWeeks = filteredPlanning
    .filter((p) => {
      if (p.weeklyPlanData == null) return false;
      if (p.stage !== "published") return false;
      if (!p.startDate) return false;
      return isBefore(parseISO(p.startDate.slice(0, 10)), today);
    })
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));

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
                              {isPublished
                                ? <><Send className="h-3 w-3 mr-1" />Published</>
                                : isPlanned && planned[0].firstPublishedAt
                                ? "Republish"
                                : "Publish"}
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

      {!isGuardianMode && (
        <WeeklyReviewSection siteId={siteIdNum} sites={sites ?? []} pastPublishedWeeks={pastPublishedWeeks} />
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
                              {p.startDate ? `Starts ${format(parseISO(p.startDate), "dd/MM/yyyy")}` : ""}
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
                              {p.startDate ? `Starts ${format(parseISO(p.startDate), "dd/MM/yyyy")}` : ""}
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
          isAdmin={isAdmin}
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
