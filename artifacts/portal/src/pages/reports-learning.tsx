import { useState, useMemo } from "react";
import {
  useGetLearningStoriesReport,
  useListPosts,
  useListJottings,
  useListObservations,
  useListSites,
  useListChildren,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { BookMarked, AlertCircle, FileText, StickyNote, Eye } from "lucide-react";
import { melbourneDate } from "@/lib/timezone";
import { subDays, subMonths, parseISO, isAfter } from "date-fns";

// ── Period helpers ────────────────────────────────────────────────────────────

const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "Last month" },
  { value: "term", label: "Last term (3 months)" },
  { value: "year", label: "Last year" },
] as const;

function periodCutoff(period: string): Date {
  const now = melbourneDate();
  switch (period) {
    case "7d":    return subDays(now, 7);
    case "month": return subDays(now, 30);
    case "term":  return subMonths(now, 3);
    case "year":  return subMonths(now, 12);
    default:      return subDays(now, 7);
  }
}

function afterCutoff(dateStr: string | null | undefined, cutoff: Date): boolean {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
    return isAfter(d, cutoff);
  } catch {
    return false;
  }
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  icon, label, count, sub, loading,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-9 w-16 mt-1" />
            ) : (
              <p className="text-4xl font-bold tracking-tight mt-1">{count}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReportsLearning() {
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("7d");

  const { data: sites } = useListSites();
  const { data: children } = useListChildren();
  const { data: posts, isLoading: postsLoading } = useListPosts();
  const { data: jottings, isLoading: jottingsLoading } = useListJottings();
  const { data: observations, isLoading: observationsLoading } = useListObservations();
  const { data: report, isLoading: reportLoading } = useGetLearningStoriesReport();

  const cutoff = useMemo(() => periodCutoff(selectedPeriod), [selectedPeriod]);
  const periodLabel = PERIODS.find((p) => p.value === selectedPeriod)?.label ?? "";

  // Build a Set of childIds that belong to the selected site (for filtering obs/jottings)
  const childIdsInSite = useMemo(() => {
    if (selectedSite === "all" || !children) return null;
    return new Set(
      children.filter((c) => String(c.siteId) === selectedSite).map((c) => c.id)
    );
  }, [children, selectedSite]);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => {
      const inPeriod = afterCutoff(p.date ?? p.createdAt, cutoff);
      const inSite = selectedSite === "all" || String(p.siteId) === selectedSite;
      return inPeriod && inSite;
    });
  }, [posts, cutoff, selectedSite]);

  const filteredObservations = useMemo(() => {
    if (!observations) return [];
    return observations.filter((o) => {
      const inPeriod = afterCutoff(o.observationDate ?? o.createdAt, cutoff);
      const inSite = childIdsInSite === null || childIdsInSite.has(o.childId);
      return inPeriod && inSite;
    });
  }, [observations, cutoff, childIdsInSite]);

  const filteredJottings = useMemo(() => {
    if (!jottings) return [];
    return jottings.filter((j) => {
      if (j.archivedAt) return false;
      const inPeriod = afterCutoff(j.createdAt, cutoff);
      const inSite = childIdsInSite === null || (j.childId != null && childIdsInSite.has(j.childId));
      return inPeriod && inSite;
    });
  }, [jottings, cutoff, childIdsInSite]);

  const isLoadingCounts = postsLoading || jottingsLoading || observationsLoading;

  // MTOP chart data from existing report (not period-filtered — whole-of-time view)
  const chartData = (report?.byOutcome ?? []).map((o) => ({
    name: `Outcome ${o.outcomeNumber}`,
    count: o.count,
    title: o.outcomeTitle,
  }));
  const maxObs = Math.max(...(report?.byChild ?? []).map((c) => c.observationCount), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Stories</h1>
        <p className="text-muted-foreground mt-1">
          Track posts, jottings and observations by site and time period.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Site</p>
          <Select value={selectedSite} onValueChange={setSelectedSite}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All sites" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {(sites ?? []).map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</p>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary tiles */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          {periodLabel}{selectedSite !== "all" ? ` · ${sites?.find((s) => String(s.id) === selectedSite)?.name ?? ""}` : ""}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            icon={<FileText className="h-5 w-5" />}
            label="Posts"
            count={filteredPosts.length}
            sub={selectedSite !== "all" ? "Filtered by site" : "Across all sites"}
            loading={isLoadingCounts}
          />
          <StatTile
            icon={<StickyNote className="h-5 w-5" />}
            label="Jottings"
            count={filteredJottings.length}
            sub="All active jottings"
            loading={isLoadingCounts}
          />
          <StatTile
            icon={<Eye className="h-5 w-5" />}
            label="Observations"
            count={filteredObservations.length}
            sub="All sites"
            loading={isLoadingCounts}
          />
        </div>
      </div>

      {/* Divider for whole-of-time MTOP section */}
      <div className="border-t pt-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
          MTOP Coverage — all time
        </p>
      </div>

      {/* Under-represented outcomes alert */}
      {(report?.underRepresentedOutcomes ?? []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Outcomes needing more coverage</p>
            <p className="text-sm text-amber-700 mt-1">These MTOP outcomes are under-represented in your observations:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {report?.underRepresentedOutcomes.map((o) => (
                <Badge key={o.outcomeId} className="bg-amber-100 text-amber-800 border-amber-300">
                  Outcome {o.outcomeNumber} ({o.count})
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">MTOP Outcome Coverage</CardTitle></CardHeader>
          <CardContent>
            {reportLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : chartData.every((d) => d.count === 0) ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <BookMarked className="h-8 w-8" />
                <p>No observations linked to outcomes yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v, _n, props) => [v, props.payload?.title || ""]} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Observations per Child</CardTitle></CardHeader>
          <CardContent>
            {reportLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (report?.byChild ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <p>No children enrolled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...(report?.byChild ?? [])]
                  .sort((a, b) => b.observationCount - a.observationCount)
                  .map((c) => (
                    <div key={c.childId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{c.childName}</span>
                        <span className="text-muted-foreground">{c.observationCount}</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(c.observationCount / maxObs) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Outcome Detail</CardTitle></CardHeader>
        <CardContent>
          {reportLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="divide-y">
              {(report?.byOutcome ?? []).map((o) => (
                <div key={o.outcomeId} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Outcome {o.outcomeNumber}</p>
                    <p className="text-xs text-muted-foreground">{o.outcomeTitle}</p>
                  </div>
                  <Badge variant={o.count === 0 ? "destructive" : "secondary"}>
                    {o.count} observations
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
