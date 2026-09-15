import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth";
import { useListSites } from "@workspace/api-client-react";
import {
  Baby,
  Calendar,
  User,
  ExternalLink,
  ShieldCheck,
  FileText,
  BookOpen,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Send,
  Building2,
  ClipboardList,
  Bell,
  Paperclip,
  MapPin,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { RichTextView } from "@/components/rich-text-editor";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import {
  ReadOnlyPlanView,
  ExistingPlan,
} from "@/components/read-only-plan-view";
import { useListGuardianExcursions } from "@workspace/api-client-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  format,
  addDays,
  isAfter,
  parseISO,
} from "date-fns";
import { melbourneDateStr, fmtMelb } from "@/lib/timezone";

// ── Types ─────────────────────────────────────────────────────────────────────
type Child = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  status: string;
  enrollmentDate: string | null;
  siteId: number | null;
};

type Post = {
  id: number;
  title: string;
  date: string | null;
  publishedAt: string | null;
  description: string | null;
  learning: string | null;
  aiSummary: string | null;
  images: string[];
  childNames: string[];
  staffName: string | null;
  siteName: string | null;
};

type GuardianPlan = ExistingPlan & {
  startDate: string | null;
  siteName: string | null;
  preparedBy: string | null;
};

type Notice = {
  id: number;
  title: string;
  content: string;
  priority: string;
  audience: string;
  siteId: number | null;
  documentPaths?: string[] | null;
  documentNames?: string[] | null;
  expiresAt?: string | null;
  createdAt: string;
};

function docUrl(path: string) {
  const stripped = path.replace(/^\/?(objects\/)?/, "");
  return `/api/storage/objects/${stripped}`;
}

const NOTICE_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-700",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

// ── Calendar helpers ──────────────────────────────────────────────────────────
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

const TODAY = melbourneDateStr();
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type RowKey =
  | "experiencesThemes"
  | "active"
  | "creative"
  | "wellbeing"
  | "imaginative"
  | "spontaneousChoice";
type WeeklyPlanData = Partial<Record<RowKey, Partial<Record<DayKey, string>>>>;

const PLAN_ROWS: { key: RowKey; label: string; color: string }[] = [
  { key: "experiencesThemes", label: "Theme", color: "bg-amber-50" },
  { key: "active", label: "Active Play", color: "bg-green-50" },
  { key: "creative", label: "Creative", color: "bg-blue-50" },
  { key: "wellbeing", label: "Wellbeing", color: "bg-rose-50" },
  { key: "imaginative", label: "Imaginative Play", color: "bg-purple-50" },
  { key: "spontaneousChoice", label: "Child's Choice", color: "bg-orange-50" },
];
const PLAN_DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
];

function WeeklyActivityGrid({ data }: { data: WeeklyPlanData }) {
  const hasContent = PLAN_ROWS.some((row) =>
    PLAN_DAYS.some((day) => (data[row.key]?.[day.key] ?? "").trim()),
  );
  if (!hasContent) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        No activities entered for this week.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide py-2 px-2 w-28">
              Activity
            </th>
            {PLAN_DAYS.map((d) => (
              <th
                key={d.key}
                className="text-center font-semibold text-xs uppercase tracking-wide py-2 px-1 text-muted-foreground"
              >
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_ROWS.map((row) => {
            const rowHasContent = PLAN_DAYS.some((d) =>
              (data[row.key]?.[d.key] ?? "").trim(),
            );
            if (!rowHasContent) return null;
            return (
              <tr key={row.key} className="border-t border-border/60">
                <td
                  className={`py-2 px-2 font-medium text-xs text-foreground rounded-l align-top ${row.color}`}
                >
                  {row.label}
                </td>
                {PLAN_DAYS.map((d) => {
                  const cell = (data[row.key]?.[d.key] ?? "").trim();
                  return (
                    <td key={d.key} className="py-2 px-1 align-top text-center">
                      {cell ? (
                        <span className="text-xs text-foreground whitespace-pre-wrap leading-snug">
                          {cell}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function WeeklyProgramCard({
  plan,
  onOpen,
}: {
  plan: GuardianPlan;
  onOpen: () => void;
}) {
  const dateLabel = plan.startDate
    ? `Week of ${format(parseISO(plan.startDate), "dd/MM/yyyy")}`
    : (plan.title ?? "Calendar");

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onOpen}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-4">
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-base leading-tight">
              {plan.title ?? "Calendar"}
            </h3>
            <Badge
              variant="secondary"
              className="text-xs font-medium bg-emerald-100 text-emerald-800"
            >
              Published
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-0.5">
            {plan.startDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {dateLabel}
              </span>
            )}
            {(plan as any).siteName && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {(plan as any).siteName}
              </span>
            )}
            {(plan as any).preparedBy && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {(plan as any).preparedBy}
              </span>
            )}
          </div>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
      </CardHeader>
    </Card>
  );
}

// ── Guardian calendar ─────────────────────────────────────────────────────────
function GuardianCalendar({ childSiteIds }: { childSiteIds: number[] }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPlan, setSelectedPlan] = useState<GuardianPlan | null>(null);

  const { data: plans, isLoading } = useQuery<GuardianPlan[]>({
    queryKey: ["/api/auth/my-plans"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  const filteredPlans = (plans ?? []).filter(
    (p) =>
      childSiteIds.length === 0 ||
      (p.siteId != null && childSiteIds.includes(p.siteId)),
  );

  // Cards view: only this week + next week
  const today = new Date();
  const dow = today.getDay(); // 0=Sun…6=Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysFromMonday);
  const nextFriday = new Date(thisMonday);
  nextFriday.setDate(thisMonday.getDate() + 11);
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const windowStart = fmtDate(thisMonday);
  const windowEnd = fmtDate(nextFriday);

  const sortedPlans = [...filteredPlans]
    .filter((p) => {
      if (!p.startDate) return true;
      const d = p.startDate.slice(0, 10);
      return d >= windowStart && d <= windowEnd;
    })
    .sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return b.startDate.localeCompare(a.startDate);
    });

  // Calendar helpers
  const weeks = getWeeksInMonth(currentMonth);
  function publishedPlanForWeek(weekDays: Date[]): GuardianPlan | undefined {
    const weekStart = format(weekDays[0], "yyyy-MM-dd");
    const weekEnd = format(weekDays[4], "yyyy-MM-dd");
    return (plans ?? []).find((p) => {
      if (!p.startDate) return false;
      const d = p.startDate.slice(0, 10);
      return (
        d >= weekStart &&
        d <= weekEnd &&
        (childSiteIds.length === 0 ||
          (p.siteId != null && childSiteIds.includes(p.siteId)))
      );
    });
  }
  const hasAnyPublished = weeks.some((w) => !!publishedPlanForWeek(w));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Weekly Learning Program</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={() => setShowCalendar((v) => !v)}
        >
          <Calendar className="h-3.5 w-3.5" />
          {showCalendar ? "View programs" : "View calendar"}
        </Button>
      </div>

      {showCalendar ? (
        /* ── Calendar view ── */
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            {isLoading ? (
              <div className="space-y-3 mt-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden mt-2">
                <div className="grid grid-cols-5 bg-muted/50 border-b">
                  {SHORT_DAYS.map((d) => (
                    <div
                      key={d}
                      className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center border-r last:border-r-0"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="divide-y">
                  {weeks.map((weekDays, wi) => {
                    const inMonth = weekDays.some(
                      (d) => d.getMonth() === currentMonth.getMonth(),
                    );
                    const plan = publishedPlanForWeek(weekDays);
                    return (
                      <div
                        key={wi}
                        className={`relative transition-colors ${!inMonth ? "opacity-40" : ""} ${plan ? "cursor-pointer hover:bg-green-50/60" : ""}`}
                        onClick={() => plan && setSelectedPlan(plan)}
                      >
                        {plan && (
                          <div className="absolute inset-0 pointer-events-none z-10">
                            <div className="h-full bg-green-50/70 border-y border-green-200 flex items-center px-3 gap-2">
                              <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs gap-1">
                                <Send className="h-3 w-3" />
                                {plan.title ?? "Calendar"}
                              </Badge>
                              <ExternalLink className="h-3 w-3 text-green-700 opacity-70" />
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-5 min-h-[72px]">
                          {weekDays.map((day, di) => (
                            <div
                              key={di}
                              className={`border-r last:border-r-0 px-2 py-1.5 ${day.getMonth() !== currentMonth.getMonth() ? "bg-muted/20" : ""}`}
                            >
                              <p
                                className={`text-xs font-medium ${format(day, "yyyy-MM-dd") === TODAY ? "text-primary font-bold" : "text-muted-foreground"}`}
                              >
                                {format(day, "d")}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!isLoading && !hasAnyPublished && (
              <div className="py-8 text-center text-muted-foreground mt-2">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-25" />
                <p className="text-sm">No published programs for this month.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : /* ── Program cards view (default) ── */
      isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : sortedPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No calendar programs published yet.</p>
            <p className="text-xs mt-1">
              Check back soon — your service will post the program here each
              week.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedPlans.map((plan) => (
            <WeeklyProgramCard
              key={plan.id}
              plan={plan}
              onOpen={() => setSelectedPlan(plan)}
            />
          ))}
        </div>
      )}

      {selectedPlan && (
        <ReadOnlyPlanView
          plan={selectedPlan}
          siteName={(selectedPlan as any).siteName ?? undefined}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ageFromDob(dob: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (totalMonths < 12) return `${totalMonths} months`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}y ${m}m` : `${y} year${y !== 1 ? "s" : ""}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  enrolled: "bg-blue-100 text-blue-800",
  waitlisted: "bg-amber-100 text-amber-800",
  inactive: "bg-gray-100 text-gray-600",
};

function stripHtml(html: string | null | undefined): string {
  return html ? html.replace(/<[^>]*>/g, "").trim() : "";
}

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

// ── Post card ─────────────────────────────────────────────────────────────────
function PostCard({ post, onSelect }: { post: Post; onSelect: () => void }) {
  const summary =
    post.aiSummary || stripHtml(post.description) || stripHtml(post.learning);
  const hasImage = post.images && post.images.length > 0;
  const publishDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-AU")
    : null;

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      {hasImage && (
        <div className="h-40 bg-muted overflow-hidden">
          <img
            src={imageUrl(post.images[0])}
            alt={post.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      {!hasImage && (
        <div
          className="h-2"
          style={{ background: "linear-gradient(90deg, #4CAF50, #2196F3)" }}
        />
      )}
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm leading-snug mb-1">
          {post.title}
        </h3>
        {publishDate && (
          <p className="text-xs text-muted-foreground mb-2">{publishDate}</p>
        )}
        {summary && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {summary.slice(0, 200)}
          </p>
        )}
        {post.childNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {post.childNames.map((name) => (
              <span
                key={name}
                className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium"
              >
                {name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MessageCircle className="h-3 w-3" />
          <span>View post</span>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingExcursions() {
  const { data: excursions, isLoading } = useListGuardianExcursions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!excursions || excursions.length === 0) return null;

  const pending = excursions.filter((e) => !e.decision);
  const completed = excursions.filter((e) => e.decision);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Upcoming Excursions</h2>
        {pending.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 font-medium">
            {pending.length} Action Required
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {excursions.map((exc) => (
          <Link key={exc.recipientId} href={`/excursions/${exc.id}/recipients/${exc.recipientId}`}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow group h-full flex flex-col">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {exc.excursionDate.split("T")[0]}
                  </div>
                  {exc.decision === "granted" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] uppercase font-semibold">
                      Granted
                    </Badge>
                  ) : exc.decision === "declined" ? (
                    <Badge
                      variant="destructive"
                      className="text-[10px] uppercase font-semibold"
                    >
                      Declined
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] uppercase font-semibold"
                    >
                      Action Required
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base leading-tight group-hover:text-primary transition-colors">
                  {exc.heading}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {exc.venue}
                </p>
              </CardHeader>
              <CardContent className="p-4 pt-0 mt-auto flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {exc.childName.charAt(0)}
                </div>
                <p className="text-xs font-medium text-foreground">
                  {exc.childName}
                </p>
                <div className="ml-auto text-xs text-primary font-medium flex items-center gap-1 group-hover:underline">
                  {exc.decision ? "View form" : "Review & sign"}{" "}
                  <ChevronRight className="h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GuardianHome() {
  const { user } = useAuth();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  // Only set when the user explicitly clicks a site tab; otherwise falls back to first child's site.
  const [noticeSiteOverride, setNoticeSiteOverride] = useState<number | null>(
    null,
  );

  const { data: children, isLoading: childrenLoading } = useQuery<Child[]>({
    queryKey: ["/api/auth/my-children"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-children");
      if (!res.ok) throw new Error("Failed to load children");
      return res.json();
    },
  });

  const { data: posts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/auth/my-posts"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-posts");
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    },
  });

  const { data: notices } = useQuery<Notice[]>({
    queryKey: ["/api/auth/my-notices"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-notices");
      if (!res.ok) throw new Error("Failed to load notices");
      return res.json();
    },
  });

  const now = new Date();

  const { data: sites } = useListSites();

  const childSiteIds = [
    ...new Set(
      (children ?? [])
        .map((c) => c.siteId)
        .filter((id): id is number => id != null),
    ),
  ];

  // Computed: user's explicit choice, else first child's site, else null (children not loaded yet)
  const selectedNoticeSiteId: number | null =
    noticeSiteOverride ?? childSiteIds[0] ?? null;

  const activeNotices = (notices ?? [])
    .filter((n) => !n.expiresAt || new Date(n.expiresAt) > now)
    .filter((n) => {
      if (selectedNoticeSiteId == null) return true; // children not loaded yet — show all
      return n.siteId == null || n.siteId === selectedNoticeSiteId;
    })
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, normal: 2, low: 3 };
      const pa = order[a.priority as keyof typeof order] ?? 2;
      const pb = order[b.priority as keyof typeof order] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] p-6 text-white">
        <p className="text-sm text-white/70 mb-1">Welcome back</p>
        <h1 className="text-2xl font-bold mb-0.5">
          {user?.name ?? "Guardian"}
        </h1>
        <p className="text-white/70 text-sm">
          {fmtMelb(new Date(), "EEEE, dd/MM/yyyy")}
        </p>
      </div>

      {/* Notices + quick links inline */}
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Notices</h2>
          {activeNotices.length > 0 && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">
              {activeNotices.length}
            </span>
          )}

          {/* Site selector — only when guardian has children at multiple sites */}
          {childSiteIds.length > 1 && (
            <div className="flex gap-1.5 ml-1">
              {childSiteIds.map((siteId) => {
                const site = (sites ?? []).find((s) => s.id === siteId);
                const siteName = site?.name ?? `Site ${siteId}`;
                const isActive = selectedNoticeSiteId === siteId;
                return (
                  <button
                    key={siteId}
                    onClick={() => setNoticeSiteOverride(siteId)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    <Building2 className="h-3 w-3" />
                    {siteName}
                  </button>
                );
              })}
            </div>
          )}

          <div className="ml-auto flex gap-2 flex-wrap">
            {childSiteIds.map((siteId) => {
              const site = (sites ?? []).find((s) => s.id === siteId);
              const siteName = site?.name ?? "Our Service";
              return (
                <React.Fragment key={siteId}>
                  <a
                    href={`/service-docs?siteId=${siteId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                    Service Documentation
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                  <a
                    href={`/qip-public?siteId=${siteId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                    {siteName} QIP
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </a>
                </React.Fragment>
              );
            })}
          </div>
        </div>
        {activeNotices.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {activeNotices.map((notice) => (
              <div
                key={notice.id}
                className="min-w-[280px] max-w-[320px] p-4 rounded-lg border shrink-0 snap-start flex flex-col justify-between text-white cursor-pointer hover:brightness-95 transition-all"
                style={{ backgroundColor: "#29BCD4", borderColor: "#1fa8be" }}
                onClick={() => setSelectedNotice(notice)}
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <Badge
                      className={`${NOTICE_PRIORITY_COLORS[notice.priority] ?? NOTICE_PRIORITY_COLORS.normal} border-none capitalize`}
                    >
                      {notice.priority}
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-sm text-white">
                    {notice.title}
                  </h4>
                  <RichTextView
                    html={notice.content}
                    className="text-white/85 line-clamp-3"
                  />
                  {notice.documentPaths && notice.documentPaths.length > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span>
                        {notice.documentPaths.length === 1
                          ? (notice.documentNames?.[0] ?? "1 attachment")
                          : `${notice.documentPaths.length} attachments`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-2 border-t border-white/25 flex items-center justify-between gap-2">
                  <span className="text-xs text-white/60">
                    {new Date(notice.createdAt).toLocaleDateString("en-AU")}
                  </span>
                  {notice.siteId != null && (
                    <span className="flex items-center gap-1 text-[11px] text-white/70 bg-white/15 rounded px-1.5 py-0.5 shrink-0">
                      <Building2 className="h-3 w-3" />
                      {(sites ?? []).find((s) => s.id === notice.siteId)
                        ?.name ?? "One site"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Children */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Baby className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">
            {(children?.length ?? 0) === 1 ? "Your Child" : "Your Children"}
          </h2>
          {!childrenLoading && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">
              {children?.length ?? 0}
            </span>
          )}
        </div>

        {childrenLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : !children || children.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Baby className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No children linked to your account yet.</p>
              <p className="text-xs mt-1">
                Please contact the centre if this is unexpected.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((child) => (
              <Card
                key={child.id}
                className="overflow-hidden hover:shadow-md transition-shadow"
              >
                <div
                  className="h-1.5"
                  style={{
                    background: "linear-gradient(90deg, #4CAF50, #2196F3)",
                  }}
                />
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {child.firstName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base leading-tight">
                          {child.firstName} {child.lastName}
                        </h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            STATUS_STYLES[child.status] ??
                            "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {child.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0" />
                          <span>{ageFromDob(child.dateOfBirth)}</span>
                        </div>
                        {child.enrollmentDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>
                              Enrolled{" "}
                              {new Date(
                                child.enrollmentDate,
                              ).toLocaleDateString("en-AU")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Learning Program — calendar view */}
      <GuardianCalendar childSiteIds={childSiteIds} />

      {/* Excursions */}
      <UpcomingExcursions />

      {/* Posts & Updates */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Posts & Updates</h2>
          {!postsLoading && posts && posts.length > 0 && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">
              {posts.length}
            </span>
          )}
        </div>

        {postsLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : !posts || posts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No posts yet — check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onSelect={() => setSelectedPostId(post.id)}
              />
            ))}
          </div>
        )}
      </div>

      <PostDetailDialog
        postId={selectedPostId}
        open={selectedPostId !== null}
        onClose={() => setSelectedPostId(null)}
        defaultCommentName={user?.name ?? "Guardian"}
      />

      {/* Notice detail dialog */}
      <Dialog
        open={!!selectedNotice}
        onOpenChange={(open) => {
          if (!open) setSelectedNotice(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge
                className={`${NOTICE_PRIORITY_COLORS[selectedNotice?.priority ?? "normal"]} border-none capitalize`}
              >
                {selectedNotice?.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedNotice &&
                  fmtMelb(selectedNotice.createdAt, "dd/MM/yyyy 'at' h:mm a")}
              </span>
            </div>
            <DialogTitle className="text-lg leading-snug">
              {selectedNotice?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            {selectedNotice && (
              <RichTextView
                html={selectedNotice.content}
                className="text-foreground"
              />
            )}
            {selectedNotice?.documentPaths &&
              selectedNotice.documentPaths.length > 0 && (
                <div className="pt-3 border-t space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Attachments
                  </p>
                  {selectedNotice.documentPaths.map((path, idx) => {
                    const name =
                      selectedNotice.documentNames?.[idx] ??
                      path.split("/").pop() ??
                      `Document ${idx + 1}`;
                    return (
                      <a
                        key={idx}
                        href={docUrl(path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        {name}
                      </a>
                    );
                  })}
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
