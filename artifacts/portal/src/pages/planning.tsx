import { useState } from "react";
import { useLocation } from "wouter";
import { useListPlanningExperiences, useListChildren, useListSites } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CalendarDays, MapPin, Users, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const STAGE_LABELS: Record<string, string> = {
  brainstorm: "Brainstorm",
  planned: "Planned",
  implemented: "Implemented",
  evaluated: "Evaluated",
};
const STAGE_COLORS: Record<string, string> = {
  brainstorm: "bg-slate-100 text-slate-700 border-slate-300",
  planned: "bg-blue-100 text-blue-700 border-blue-300",
  implemented: "bg-amber-100 text-amber-700 border-amber-300",
  evaluated: "bg-green-100 text-green-700 border-green-300",
};

export default function Planning() {
  const [, navigate] = useLocation();
  const [siteFilter, setSiteFilter] = useState("all");
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
    if (siteFilter === "all") return true;
    if (siteFilter === "none") return !exp.siteId;
    return exp.siteId === parseInt(siteFilter, 10);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planning Cycle</h1>
          <p className="text-muted-foreground mt-1">Document and track educational experiences through the planning cycle.</p>
        </div>
        <Button onClick={() => navigate("/planning/new")}>
          <Plus className="h-4 w-4 mr-2" />New Planning Cycle
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-52">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Filter by site" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sites</SelectItem>
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
      ) : (experiences ?? []).length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">No planning cycles match the selected site.</p>
          <button onClick={() => setSiteFilter("all")} className="mt-2 text-sm text-primary hover:underline">
            Clear filter
          </button>
        </div>
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
                          {format(new Date(exp.startDate), "d MMM yyyy")}
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
    </div>
  );
}
