import { useState } from "react";
import { useLocation } from "wouter";
import { useListPlanningExperiences, useListChildren, useListSites } from "@workspace/api-client-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarDays, MapPin, Users, ChevronRight, Award, ClipboardList } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO, isBefore, startOfToday } from "date-fns";

const STAGE_LABELS: Record<string, string> = {
  brainstorm: "Brainstorm",
  planned: "Planned",
  assessment: "Assessment Stage",
  closed: "Closed",
};
const STAGE_COLORS: Record<string, string> = {
  brainstorm: "bg-slate-100 text-slate-700 border-slate-300",
  planned: "bg-blue-100 text-blue-700 border-blue-300",
  assessment: "bg-amber-100 text-amber-700 border-amber-300",
  closed: "bg-green-100 text-green-700 border-green-300",
};

export default function Planning() {
  const [, navigate] = useLocation();
  const { isEducatorRole, ownSiteId } = usePermissions();
  const [siteFilter, setSiteFilter] = useState(() =>
    isEducatorRole && ownSiteId ? String(ownSiteId) : "all"
  );
  const { data: experiences, isLoading } = useListPlanningExperiences();
  const { data: children } = useListChildren();
  const { data: sites } = useListSites();

  const childName = (id: number) => {
    const c = (children ?? []).find((ch) => ch.id === id);
    return c ? `${c.firstName} ${c.lastName}` : `#${id}`;
  };
  const siteName = (id: number | null | undefined) => {
    if (!id) return null;
    const s = (sites ?? []).find((s) => s.id === id);
    return s?.name ?? null;
  };

  const filtered = (experiences ?? []).filter((exp) => {
    if (exp.weeklyPlanData != null) return false; // calendar weekly plans — not planning cycles
    if (exp.stage === "published") return false; // published = on the calendar, not in planning cycle tab
    if (siteFilter === "templates") return exp.isTemplate === true;
    if (exp.isTemplate) return false; // exclude templates from all other views
    if (siteFilter === "all") return true;
    if (siteFilter === "none") return !exp.siteId;
    return exp.siteId === parseInt(siteFilter, 10);
  });

  const today = startOfToday();
  const pastPublishedWeeklyPlans = (experiences ?? []).filter((exp) => {
    if (exp.weeklyPlanData == null) return false;
    if (exp.stage !== "published") return false;
    if (!exp.startDate) return false;
    return isBefore(parseISO(exp.startDate.slice(0, 10)), today);
  }).sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planning Cycle</h1>
          <p className="text-muted-foreground mt-1">Document and track educational experiences through the planning cycle.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/outcomes">
            <Button variant="outline">
              <Award className="h-4 w-4 mr-2" />MTOP Outcomes
            </Button>
          </Link>
          <Button onClick={() => navigate(siteFilter === "templates" ? "/planning/new?template=1" : "/planning/new")}>
            <Plus className="h-4 w-4 mr-2" />{siteFilter === "templates" ? "New Template" : "New Planning Cycle"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-52">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Filter by site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
            <SelectItem value="templates">⭐ Templates</SelectItem>
            <SelectItem value="none">No location</SelectItem>
            {(sites ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {siteFilter !== "all" && (
          <button
            onClick={() => setSiteFilter("all")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        siteFilter === "all" || siteFilter === "templates" ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No planning cycles yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Start by creating your first planning experience document.</p>
            <Button onClick={() => navigate("/planning/new")}>
              <Plus className="h-4 w-4 mr-2" />New Planning Cycle
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">No planning cycles match the selected site.</p>
            <button onClick={() => setSiteFilter("all")} className="mt-2 text-sm text-primary hover:underline">
              Clear filter
            </button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((exp) => {
            const site = siteName(exp.siteId);
            const focusNames = (exp.childIds ?? []).slice(0, 3).map(childName);
            const extraChildren = (exp.childIds ?? []).length - 3;
            return (
              <button
                key={exp.id}
                onClick={() => navigate(`/planning/${exp.id}`)}
                className="w-full text-left bg-white border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STAGE_COLORS[exp.stage] ?? STAGE_COLORS.brainstorm}`}>
                        {STAGE_LABELS[exp.stage] ?? exp.stage}
                      </span>
                    </div>
                    <h3 className="font-semibold text-base leading-snug truncate">{exp.title}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                      {site && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />{site}
                        </span>
                      )}
                      {exp.startDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(new Date(exp.startDate), "dd/MM/yyyy")}
                        </span>
                      )}
                      {(exp.childIds ?? []).length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {focusNames.join(", ")}{extraChildren > 0 ? ` +${extraChildren} more` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground shrink-0 mt-1 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {pastPublishedWeeklyPlans.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold tracking-tight">Assessment</h2>
            <Badge variant="secondary" className="text-xs">{pastPublishedWeeklyPlans.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-1">
            Published weekly programs whose week has passed — ready for assessment.
          </p>
          <div className="space-y-2">
            {pastPublishedWeeklyPlans.map((exp) => {
              const site = siteName(exp.siteId);
              return (
                <div
                  key={exp.id}
                  className="w-full text-left bg-white border rounded-xl p-5 opacity-80"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-100 text-amber-700 border-amber-300">
                          Assessment
                        </span>
                      </div>
                      <h3 className="font-semibold text-base leading-snug truncate">{exp.title}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        {site && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />{site}
                          </span>
                        )}
                        {exp.startDate && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Week of {format(parseISO(exp.startDate.slice(0, 10)), "dd/MM/yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
