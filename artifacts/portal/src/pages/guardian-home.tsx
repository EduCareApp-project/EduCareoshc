import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";
import { useListSites } from "@workspace/api-client-react";
import {
  Baby, Calendar, User, ExternalLink, ShieldCheck, FileText, BookOpen,
  MessageCircle, ChevronLeft, ChevronRight, CalendarDays, Send,
} from "lucide-react";
import { PostDetailDialog } from "@/components/post-detail-dialog";
import { ReadOnlyPlanView, ExistingPlan } from "@/components/read-only-plan-view";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, format, addDays, isAfter,
} from "date-fns";

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

const TODAY = format(new Date(), "yyyy-MM-dd");
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ── Guardian calendar ─────────────────────────────────────────────────────────
function GuardianCalendar({ childSiteIds }: { childSiteIds: number[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewPlan, setViewPlan] = useState<GuardianPlan | null>(null);

  const { data: plans, isLoading } = useQuery<GuardianPlan[]>({
    queryKey: ["/api/auth/my-plans"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-plans");
      if (!res.ok) throw new Error("Failed to load plans");
      return res.json();
    },
  });

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
        (childSiteIds.length === 0 || (p.siteId != null && childSiteIds.includes(p.siteId)))
      );
    });
  }

  const hasAnyPublished = weeks.some((w) => !!publishedPlanForWeek(w));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Weekly Learning Program</h2>
      </div>

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
            <CardTitle className="text-base">{format(currentMonth, "MMMM yyyy")}</CardTitle>
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
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden mt-2">
              {/* Day headers */}
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

              {/* Week rows */}
              <div className="divide-y">
                {weeks.map((weekDays, wi) => {
                  const inMonth = weekDays.some((d) => d.getMonth() === currentMonth.getMonth());
                  const plan = publishedPlanForWeek(weekDays);

                  return (
                    <div
                      key={wi}
                      className={`relative transition-colors ${
                        plan ? "cursor-pointer hover:bg-green-50/40" : ""
                      } ${!inMonth ? "opacity-40" : ""}`}
                      onClick={plan ? () => setViewPlan(plan) : undefined}
                    >
                      {/* Published plan overlay */}
                      {plan && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                          <div className="h-full bg-green-50/70 border-y border-green-200 flex items-center px-3">
                            <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs gap-1 pointer-events-auto cursor-pointer hover:bg-green-200 transition-colors">
                              <Send className="h-3 w-3" />
                              {plan.title ?? "Weekly Program"}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* Date cells */}
                      <div className="grid grid-cols-5 min-h-[72px]">
                        {weekDays.map((day, di) => (
                          <div
                            key={di}
                            className={`border-r last:border-r-0 px-2 py-1.5 ${
                              day.getMonth() !== currentMonth.getMonth() ? "bg-muted/20" : ""
                            }`}
                          >
                            <p
                              className={`text-xs font-medium ${
                                format(day, "yyyy-MM-dd") === TODAY
                                  ? "text-primary font-bold"
                                  : "text-muted-foreground"
                              }`}
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
              <p className="text-xs mt-1">Check back soon — your service will publish the program here.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {viewPlan && (
        <ReadOnlyPlanView
          plan={viewPlan}
          siteName={viewPlan.siteName ?? undefined}
          onClose={() => setViewPlan(null)}
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
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
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
  const summary = post.aiSummary || stripHtml(post.description) || stripHtml(post.learning);
  const hasImage = post.images && post.images.length > 0;
  const publishDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-AU", {
        day: "numeric", month: "long", year: "numeric",
      })
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

// ── Page ──────────────────────────────────────────────────────────────────────
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
    ...new Set(
      (children ?? []).map((c) => c.siteId).filter((id): id is number => id != null),
    ),
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
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            STATUS_STYLES[child.status] ?? "bg-gray-100 text-gray-600"
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

      {/* Weekly Learning Program — calendar view */}
      <GuardianCalendar childSiteIds={childSiteIds} />

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
