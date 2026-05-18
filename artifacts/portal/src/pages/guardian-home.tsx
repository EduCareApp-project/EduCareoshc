import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth";
import { useListSites } from "@workspace/api-client-react";
import {
  Baby, Calendar, User, ExternalLink, ShieldCheck, FileText, BookOpen,
  MessageCircle, ChevronLeft, ChevronRight, CalendarDays, Building2,
} from "lucide-react";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { startOfWeek, addWeeks, subWeeks, format, parseISO, addDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type Child = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  ageGroup: string | null;
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

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type RowKey = "experiencesThemes" | "active" | "creative" | "wellbeing" | "imaginative" | "spontaneousChoice";
type WeeklyPlanData = Partial<Record<RowKey, Partial<Record<DayKey, string>>>>;

type Plan = {
  id: number;
  title: string;
  startDate: string | null;
  siteId: number | null;
  siteName: string | null;
  preparedBy: string | null;
  weeklyPlanData: WeeklyPlanData;
};

// ─── Calendar constants ───────────────────────────────────────────────────────
const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const ROW_CONFIG: { key: RowKey; label: string; color: string }[] = [
  { key: "experiencesThemes", label: "Theme", color: "bg-amber-50" },
  { key: "active",            label: "Active Play",        color: "bg-green-50" },
  { key: "creative",          label: "Creative",           color: "bg-blue-50" },
  { key: "wellbeing",         label: "Wellbeing",          color: "bg-rose-50" },
  { key: "imaginative",       label: "Imaginative Play",   color: "bg-purple-50" },
  { key: "spontaneousChoice", label: "Child's Choice",     color: "bg-orange-50" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ageFromDob(dob: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (totalMonths < 12) return `${totalMonths} months`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}y ${m}m` : `${y} year${y !== 1 ? "s" : ""}`;
}

const AGE_GROUP_LABELS: Record<string, string> = {
  infant: "Infant", toddler: "Toddler", preschool: "Preschool", school_age: "School Age",
};
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

/** Monday of the week that is `offset` weeks from today */
function mondayForOffset(offset: number): Date {
  const base = startOfWeek(new Date(), { weekStartsOn: 1 });
  return offset === 0 ? base : offset > 0 ? addWeeks(base, offset) : subWeeks(base, Math.abs(offset));
}

// ─── Weekly Plan Grid ─────────────────────────────────────────────────────────
function WeeklyGrid({ data, monday }: { data: WeeklyPlanData; monday: Date }) {
  const dayDates = DAY_KEYS.map((_, i) => format(addDays(monday, i), "d"));

  const activeRows = ROW_CONFIG.filter((row) =>
    DAY_KEYS.some((d) => (data[row.key]?.[d] ?? "").trim())
  );

  if (activeRows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-3 text-center">
        No activities entered for this week.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-28">
              Activity
            </th>
            {DAY_KEYS.map((d, i) => (
              <th key={d} className="text-center py-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>{DAY_LABELS[i]}</span>
                <span className="block text-[10px] font-normal text-muted-foreground/60">{dayDates[i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeRows.map((row) => (
            <tr key={row.key} className="border-t border-border/50">
              <td className={`py-2 px-2 text-xs font-medium align-top rounded-l ${row.color}`}>
                {row.label}
              </td>
              {DAY_KEYS.map((d) => {
                const cell = (data[row.key]?.[d] ?? "").trim();
                return (
                  <td key={d} className="py-2 px-1 text-center align-top">
                    {cell ? (
                      <span className="text-xs text-foreground whitespace-pre-wrap leading-snug">{cell}</span>
                    ) : (
                      <span className="text-muted-foreground/25 text-xs">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Weekly Plan Section ──────────────────────────────────────────────────────
function WeeklyLearningProgram({ childSiteIds }: { childSiteIds: number[] }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/auth/my-plans"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

  const monday = mondayForOffset(weekOffset);
  const mondayStr = format(monday, "yyyy-MM-dd");
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "d MMM")} – ${format(friday, "d MMM yyyy")}`;
  const isCurrentWeek = weekOffset === 0;

  // Find a published plan whose startDate matches this Monday for the guardian's sites
  const weekPlan = (plans ?? []).find((p) => {
    if (!p.startDate) return false;
    const planMonday = format(
      startOfWeek(parseISO(p.startDate), { weekStartsOn: 1 }),
      "yyyy-MM-dd"
    );
    if (planMonday !== mondayStr) return false;
    return childSiteIds.length === 0 || (p.siteId != null && childSiteIds.includes(p.siteId));
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Weekly Learning Program</h2>
      </div>

      <Card>
        {/* Week navigator */}
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <p className="text-sm font-semibold">{weekLabel}</p>
              {isCurrentWeek && (
                <span className="text-[10px] text-primary font-medium uppercase tracking-wide">
                  Current week
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-5 pt-0 border-t">
          {isLoading ? (
            <div className="space-y-2 pt-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
            </div>
          ) : weekPlan ? (
            <div className="pt-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                {weekPlan.siteName && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />{weekPlan.siteName}
                  </span>
                )}
                {weekPlan.preparedBy && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />Prepared by {weekPlan.preparedBy}
                  </span>
                )}
              </div>
              <WeeklyGrid data={weekPlan.weeklyPlanData} monday={monday} />
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-25" />
              <p className="text-sm">No published program for this week.</p>
              <p className="text-xs mt-1">
                {weekOffset < 0 ? "Check a later week or ask your service for details." : "Check back soon — your service will publish the program here."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────
function PostCard({ post, onSelect }: { post: Post; onSelect: () => void }) {
  const summary = post.aiSummary || stripHtml(post.description) || stripHtml(post.learning);
  const hasImage = post.images && post.images.length > 0;
  const publishDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
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
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      {!hasImage && (
        <div className="h-2" style={{ background: "linear-gradient(90deg, #4CAF50, #2196F3)" }} />
      )}
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm leading-snug mb-1">{post.title}</h3>
        {publishDate && <p className="text-xs text-muted-foreground mb-2">{publishDate}</p>}
        {summary && <p className="text-sm text-muted-foreground line-clamp-3">{summary.slice(0, 200)}</p>}
        {post.childNames.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {post.childNames.map((name) => (
              <span key={name} className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GuardianHome() {
  const { user } = useAuth();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

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

  const { data: sites } = useListSites();

  const childSiteIds = [
    ...new Set((children ?? []).map((c) => c.siteId).filter((id): id is number => id != null)),
  ];

  return (
    <div className="space-y-6">
      {/* Top-right quick links */}
      <div className="flex justify-end gap-2 flex-wrap">
        {childSiteIds.map((siteId) => {
          const site = (sites ?? []).find((s) => s.id === siteId);
          const siteName = site?.name ?? "Our Service";
          return (
            <React.Fragment key={siteId}>
              <a
                href={`/service-docs?siteId=${siteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
              >
                <FileText className="h-4 w-4 text-primary shrink-0" />
                Service Documentation
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
              <a
                href={`/qip-public?siteId=${siteId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
              >
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                {siteName} QIP
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            </React.Fragment>
          );
        })}
      </div>

      {/* Welcome banner */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1b5e20] to-[#2e7d32] p-6 text-white">
        <p className="text-sm text-white/70 mb-1">Welcome back</p>
        <h1 className="text-2xl font-bold mb-0.5">{user?.name ?? "Guardian"}</h1>
        <p className="text-white/70 text-sm">
          {new Date().toLocaleDateString("en-AU", {
            weekday: "long", day: "numeric", month: "long", year: "numeric",
          })}
        </p>
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
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : !children || children.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Baby className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No children linked to your account yet.</p>
              <p className="text-xs mt-1">Please contact the centre if this is unexpected.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-1.5" style={{ background: "linear-gradient(90deg, #4CAF50, #2196F3)" }} />
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
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[child.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {child.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 shrink-0" />
                          <span>{ageFromDob(child.dateOfBirth)}</span>
                          {child.ageGroup && (
                            <span className="text-muted-foreground/60">· {AGE_GROUP_LABELS[child.ageGroup] ?? child.ageGroup}</span>
                          )}
                        </div>
                        {child.enrollmentDate && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>
                              Enrolled{" "}
                              {new Date(child.enrollmentDate).toLocaleDateString("en-AU", {
                                day: "numeric", month: "long", year: "numeric",
                              })}
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

      {/* Weekly Learning Program (calendar) */}
      <WeeklyLearningProgram childSiteIds={childSiteIds} />

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
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
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
              <PostCard key={post.id} post={post} onSelect={() => setSelectedPostId(post.id)} />
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
    </div>
  );
}
