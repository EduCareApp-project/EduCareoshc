import { useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, CheckCircle2, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListPlanningExperiences, useListSites } from "@workspace/api-client-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isThisWeek } from "date-fns";

function getWeekBounds(anchor: Date) {
  const mon = startOfWeek(anchor, { weekStartsOn: 1 });
  const sun = endOfWeek(anchor, { weekStartsOn: 1 });
  return { mon, sun };
}

export default function ReportsWeeklyPlans() {
  const [anchor, setAnchor] = useState(() => new Date());

  const { data: allPlanning, isLoading: loadingPlans } = useListPlanningExperiences();
  const { data: sites, isLoading: loadingSites } = useListSites();

  const { mon, sun } = getWeekBounds(anchor);
  const monStr = format(mon, "yyyy-MM-dd");
  const sunStr = format(sun, "yyyy-MM-dd");
  const isCurrentWeek = isThisWeek(anchor, { weekStartsOn: 1 });

  const publishedThisWeek = (allPlanning ?? []).filter((p) => {
    if (!p.weeklyPlanData) return false;
    if (p.stage !== "published") return false;
    if (!p.startDate) return false;
    const d = p.startDate.slice(0, 10);
    return d >= monStr && d <= sunStr;
  });

  const coveredSiteIds = new Set(publishedThisWeek.map((p) => p.siteId).filter(Boolean));
  const missingSites = (sites ?? []).filter((s) => !coveredSiteIds.has(s.id));
  const coveredSites = (sites ?? []).filter((s) => coveredSiteIds.has(s.id));

  const siteName = (id: number | null | undefined) => {
    if (!id) return "No site";
    return (sites ?? []).find((s) => s.id === id)?.name ?? `Site #${id}`;
  };

  const isLoading = loadingPlans || loadingSites;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weekly Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Published weekly learning programs by site, week by week.
          </p>
        </div>
      </div>

      {/* ── Week navigator ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor((d) => subWeeks(d, 1))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">
            {format(mon, "d MMM")} – {format(sun, "d MMM yyyy")}
          </span>
          {isCurrentWeek && (
            <Badge variant="secondary" className="text-xs shrink-0">This week</Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setAnchor((d) => addWeeks(d, 1))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentWeek && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            onClick={() => setAnchor(new Date())}
          >
            Back to this week
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          {/* ── Missing sites banner ── */}
          {missingSites.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-orange-800">
                  {missingSites.length === 1
                    ? "1 site has no published plan this week"
                    : `${missingSites.length} sites have no published plan this week`}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {missingSites.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-md bg-orange-100 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700"
                    >
                      <MapPin className="h-3 w-3" />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── All sites covered banner ── */}
          {missingSites.length === 0 && (sites ?? []).length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">
                All sites have a published plan for this week.
              </p>
            </div>
          )}

          {/* ── Published plans list ── */}
          {publishedThisWeek.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No published plans for this week.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Published Plans — {coveredSites.length} {coveredSites.length === 1 ? "site" : "sites"} covered
              </h2>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Site</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Plan Title</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Week Starting</th>
                      <th className="py-2.5 px-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {publishedThisWeek.map((plan) => (
                      <tr key={plan.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {siteName(plan.siteId)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{plan.title}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                          {plan.startDate
                            ? format(parseISO(plan.startDate.slice(0, 10)), "d MMM yyyy")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/planning/${plan.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
