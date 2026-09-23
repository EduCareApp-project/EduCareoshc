import { useState, useEffect } from "react";
import { format, startOfWeek, subWeeks } from "date-fns";
import { fmtMelb } from "@/lib/timezone";
import {
  useListWeeklyReviews,
  useCreateWeeklyReview,
  useUpdateWeeklyReview,
  useDeleteWeeklyReview,
  useGetWeeklyReviewStats,
  useListSites,
  useListStaff,
  getListWeeklyReviewsQueryKey,
  getGetWeeklyReviewStatsQueryKey,
  WeeklyReview as WeeklyReviewItem,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardCheck, Plus, Building2, User, Calendar, StickyNote,
  BookOpen, Newspaper, Pencil, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Week helpers ─────────────────────────────────────────────────────────────

function getAvailableWeeks(n: number): Array<{ label: string; value: string }> {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
  // Start of the current ISO week (Monday)
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  // Week runs Mon–Sun. Include the current week from Friday (5), Saturday (6), or Sunday (0).
  const startOffset = dayOfWeek === 0 || dayOfWeek >= 5 ? 0 : 1;
  const results = [];
  for (let i = startOffset; i <= n; i++) {
    const monday = subWeeks(currentWeekStart, i);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const value = format(monday, "yyyy-MM-dd");
    const isCurrent = i === 0;
    const label = `${format(monday, "d MMM")} – ${format(sunday, "d MMM yyyy")}${isCurrent ? " (this week)" : ""}`;
    results.push({ value, label });
  }
  return results;
}

const PAST_WEEKS = getAvailableWeeks(24);

function fmtWeek(weekStart: string) {
  try {
    const d = new Date(weekStart + "T00:00:00");
    const sun = new Date(d);
    sun.setDate(d.getDate() + 6);
    return `${format(d, "d MMM")} – ${format(sun, "d MMM yyyy")}`;
  } catch {
    return weekStart;
  }
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold text-sm flex-1">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 py-4 space-y-4 text-sm">{children}</div>}
    </div>
  );
}

// ── Stats banner ─────────────────────────────────────────────────────────────

function StatsBanner({
  siteId, weekStart, savedJottings, savedObservations, savedPosts,
}: {
  siteId: number | null; weekStart: string | null;
  savedJottings?: number; savedObservations?: number; savedPosts?: number;
}) {
  const statsParams = { siteId: siteId ?? 0, weekStart: weekStart ?? "" };
  const { data: stats, isLoading } = useGetWeeklyReviewStats(
    statsParams,
    {
      query: {
        queryKey: getGetWeeklyReviewStatsQueryKey(statsParams),
        enabled: !!siteId && !!weekStart,
      },
    },
  );

  const jottings = savedJottings ?? stats?.jottingsCount ?? 0;
  const observations = savedObservations ?? stats?.observationsCount ?? 0;
  const posts = savedPosts ?? stats?.postsCount ?? 0;

  if (!siteId || !weekStart) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Activity captured at time of this report
      </p>
      {isLoading && !savedJottings ? (
        <div className="flex gap-6">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      ) : (
        <div className="flex gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            <span className="text-2xl font-bold">{jottings}</span>
            <span className="text-sm text-muted-foreground">Jottings</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            <span className="text-2xl font-bold">{observations}</span>
            <span className="text-sm text-muted-foreground">Observations</span>
          </div>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-purple-500" />
            <span className="text-2xl font-bold">{posts}</span>
            <span className="text-sm text-muted-foreground">Posts</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Review form ──────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    key: "weeklySummary" as const,
    label: "1. Summary of the week",
    hint: "Include intentional, planned, and spontaneous learning that occurred.",
  },
  {
    key: "goalsAchieved" as const,
    label: "2. Goals & objectives",
    hint: "Were the programmed goals and objectives achieved this week?",
  },
  {
    key: "environmentChanges" as const,
    label: "3. Environment changes",
    hint: "Were there any changes made to the environment this week?",
  },
  {
    key: "weekQuality" as const,
    label: "4. Quality of the week",
    hint: "Was it a good week or a challenging week? Describe what made it so.",
  },
  {
    key: "professionalEnquiry" as const,
    label: "5. Professional enquiry",
    hint: "What did you learn or record for your professional enquiry or reflective practice?",
  },
  {
    key: "childEngagement" as const,
    label: "6. Child engagement",
    hint: "How did you engage the children this week?",
  },
];

type FormState = {
  weekStart: string;
  siteId: string;
  completedById: string;
  weeklySummary: string;
  goalsAchieved: string;
  environmentChanges: string;
  weekQuality: string;
  professionalEnquiry: string;
  childEngagement: string;
};

function emptyForm(defaultWeek: string, defaultSite: string, defaultStaff: string): FormState {
  return {
    weekStart: defaultWeek,
    siteId: defaultSite,
    completedById: defaultStaff,
    weeklySummary: "",
    goalsAchieved: "",
    environmentChanges: "",
    weekQuality: "",
    professionalEnquiry: "",
    childEngagement: "",
  };
}

function reviewToForm(r: WeeklyReviewItem): FormState {
  return {
    weekStart: r.weekStart,
    siteId: String(r.siteId),
    completedById: String(r.completedById),
    weeklySummary: r.weeklySummary ?? "",
    goalsAchieved: r.goalsAchieved ?? "",
    environmentChanges: r.environmentChanges ?? "",
    weekQuality: r.weekQuality ?? "",
    professionalEnquiry: r.professionalEnquiry ?? "",
    childEngagement: r.childEngagement ?? "",
  };
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WeeklyReview() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: sites } = useListSites();
  const { data: allStaff } = useListStaff();
  const { data: reviews, isLoading } = useListWeeklyReviews({});

  const activeStaff = allStaff?.filter((s) => s.status === "active" && s.role !== "onboarding") ?? [];

  // Determine current user's staff record
  const currentStaffId = allStaff?.find(
    (s) => s.email?.toLowerCase() === (user as any)?.email?.toLowerCase()
  )?.id;

  const defaultWeek = PAST_WEEKS[0]?.value ?? "";
  const defaultSite = sites?.[0]?.id ? String(sites[0].id) : "";
  const defaultStaff = currentStaffId ? String(currentStaffId) : (activeStaff[0]?.id ? String(activeStaff[0].id) : "");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<WeeklyReviewItem | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(defaultWeek, defaultSite, defaultStaff)
  );
  const [viewId, setViewId] = useState<number | null>(null);

  // Sync defaults once data loads
  useEffect(() => {
    if (!sheetOpen || editing) return;
    setForm((prev) => ({
      ...prev,
      weekStart: prev.weekStart || defaultWeek,
      siteId: prev.siteId || defaultSite,
      completedById: prev.completedById || defaultStaff,
    }));
  }, [defaultWeek, defaultSite, defaultStaff, sheetOpen, editing]);

  const createMut = useCreateWeeklyReview();
  const updateMut = useUpdateWeeklyReview();
  const deleteMut = useDeleteWeeklyReview();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListWeeklyReviewsQueryKey({}) });
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm(defaultWeek, defaultSite, defaultStaff));
    setSheetOpen(true);
  }

  function openEdit(r: WeeklyReviewItem) {
    setEditing(r);
    setForm(reviewToForm(r));
    setSheetOpen(true);
  }

  function setField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.weekStart || !form.siteId || !form.completedById) {
      toast({ title: "Please fill in the required fields.", variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          data: {
            weeklySummary: form.weeklySummary || undefined,
            goalsAchieved: form.goalsAchieved || undefined,
            environmentChanges: form.environmentChanges || undefined,
            weekQuality: form.weekQuality || undefined,
            professionalEnquiry: form.professionalEnquiry || undefined,
            childEngagement: form.childEngagement || undefined,
          },
        });
        toast({ title: "Weekly review updated." });
      } else {
        await createMut.mutateAsync({
          data: {
            weekStart: form.weekStart,
            siteId: Number(form.siteId),
            completedById: Number(form.completedById),
            weeklySummary: form.weeklySummary || undefined,
            goalsAchieved: form.goalsAchieved || undefined,
            environmentChanges: form.environmentChanges || undefined,
            weekQuality: form.weekQuality || undefined,
            professionalEnquiry: form.professionalEnquiry || undefined,
            childEngagement: form.childEngagement || undefined,
          },
        });
        toast({ title: "Weekly review saved." });
      }
      invalidate();
      setSheetOpen(false);
    } catch (err: any) {
      const msg = err?.message ?? "Something went wrong.";
      toast({ title: msg.includes("unique") || msg.includes("uq_") ? "A review for this site and week already exists." : msg, variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    await deleteMut.mutateAsync({ id });
    invalidate();
    toast({ title: "Review deleted." });
  }

  const viewReview = reviews?.find((r) => r.id === viewId) ?? null;
  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            Weekly Review
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            This form is to be completed by one Responsible Person for each week of operation.
          </p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          New Review
        </Button>
      </div>

      {/* Review list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : reviews?.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 opacity-30" />
            <p className="font-medium">No weekly reviews yet</p>
            <p className="text-sm">Click &ldquo;New Review&rdquo; to complete the first one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reviews?.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setViewId(viewId === r.id ? null : r.id)}
            >
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{fmtWeek(r.weekStart)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {r.siteName}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {r.completedByName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {fmtMelb(r.completedAt, "d MMM yyyy")}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-amber-600">
                        <StickyNote className="h-3.5 w-3.5" />{r.jottingsCount} jottings
                      </span>
                      <span className="flex items-center gap-1 text-blue-600">
                        <BookOpen className="h-3.5 w-3.5" />{r.observationsCount} observations
                      </span>
                      <span className="flex items-center gap-1 text-purple-600">
                        <Newspaper className="h-3.5 w-3.5" />{r.postsCount} posts
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete review?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the weekly review for {fmtWeek(r.weekStart)}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-destructive text-white hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Expanded view */}
                {viewId === r.id && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {QUESTIONS.map((q) => {
                      const val = r[q.key];
                      if (!val) return null;
                      return (
                        <div key={q.key}>
                          <p className="font-medium text-sm mb-1">{q.label}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{val}</p>
                        </div>
                      );
                    })}
                    {QUESTIONS.every((q) => !r[q.key]) && (
                      <p className="text-sm text-muted-foreground italic">No responses recorded.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
          <SheetHeader className="mb-6">
            <SheetTitle>{editing ? "Edit Weekly Review" : "New Weekly Review"}</SheetTitle>
            <p className="text-sm text-muted-foreground">
              This form is to be completed by one Responsible Person for each week of operation.
            </p>
          </SheetHeader>

          <div className="space-y-5">
            {/* Context fields */}
            <Section title="Review Details">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label>Week <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.weekStart}
                    onValueChange={(v) => setField("weekStart", v)}
                    disabled={!!editing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select week…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAST_WEEKS.map((w) => (
                        <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Site <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.siteId}
                    onValueChange={(v) => setField("siteId", v)}
                    disabled={!!editing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select site…" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites?.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Completed by <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.completedById}
                    onValueChange={(v) => setField("completedById", v)}
                    disabled={!!editing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff member…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStaff.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.firstName} {s.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Stats */}
              <StatsBanner
                siteId={form.siteId ? Number(form.siteId) : null}
                weekStart={form.weekStart || null}
                savedJottings={editing?.jottingsCount}
                savedObservations={editing?.observationsCount}
                savedPosts={editing?.postsCount}
              />
            </Section>

            <Separator />

            {/* Reflective questions */}
            <Section title="Reflective Questions">
              {QUESTIONS.map((q) => (
                <div key={q.key} className="space-y-1.5">
                  <Label className="text-sm font-medium">{q.label}</Label>
                  <p className="text-xs text-muted-foreground">{q.hint}</p>
                  <Textarea
                    rows={3}
                    value={form[q.key]}
                    onChange={(e) => setField(q.key, e.target.value)}
                    placeholder="Write your response here…"
                  />
                </div>
              ))}
            </Section>

            <Separator />

            <div className="flex gap-3 justify-end pb-4">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving…" : editing ? "Update Review" : "Save Review"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
