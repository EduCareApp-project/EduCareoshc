import { useState, useMemo } from "react";
import {
  useGetLearningStoriesReport,
  useListPosts,
  useListJottings,
  useListObservations,
  useListSites,
  useListChildren,
  useListPlanningExperiences,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { BookMarked, AlertCircle, FileText, StickyNote, Eye } from "lucide-react";
import { melbourneDate } from "@/lib/timezone";
import { subDays, subMonths, parseISO, isAfter } from "date-fns";

// ── Period helpers ────────────────────────────────────────────────────────────

const PERIODS = [
  { value: "7d",   label: "Last 7 days" },
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

// ── MTOP constants ────────────────────────────────────────────────────────────

const MTOP_SHORT = [
  "Sense of Identity",
  "Connected to World",
  "Sense of Wellbeing",
  "Confident Learners",
  "Communicators",
];

const MTOP_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed"];

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

// ── Custom donut label ────────────────────────────────────────────────────────

function DonutLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.4em" className="text-2xl font-bold" style={{ fontSize: 24, fontWeight: 700, fill: "hsl(var(--foreground))" }}>
        {total}
      </tspan>
      <tspan x={cx} dy="1.4em" style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}>
        plans
      </tspan>
    </text>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsLearning() {
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("7d");

  const { data: sites } = useListSites();
  const { data: children } = useListChildren();
  const { data: posts, isLoading: postsLoading } = useListPosts();
  const { data: jottings, isLoading: jottingsLoading } = useListJottings();
  const { data: observations, isLoading: observationsLoading } = useListObservations();
  const { data: planning, isLoading: planningLoading } = useListPlanningExperiences();
  const { data: report, isLoading: reportLoading } = useGetLearningStoriesReport();

  const cutoff = useMemo(() => periodCutoff(selectedPeriod), [selectedPeriod]);
  const periodLabel = PERIODS.find((p) => p.value === selectedPeriod)?.label ?? "";

  // childIds in selected site (for filtering obs/jottings)
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

  // Planning experiences filtered by site + period (via startDate or createdAt)
  const filteredPlanning = useMemo(() => {
    if (!planning) return [];
    return planning.filter((p) => {
      if (p.isTemplate) return false;
      const inPeriod = afterCutoff(p.startDate ?? p.createdAt, cutoff);
      const inSite = selectedSite === "all" || String(p.siteId) === selectedSite;
      return inPeriod && inSite;
    });
  }, [planning, cutoff, selectedSite]);

  // MTOP outcome counts from filtered planning experiences
  const mtopWheelData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const exp of filteredPlanning) {
      for (const id of exp.outcomeIds ?? []) {
        if (id >= 1 && id <= 5) counts[id - 1]++;
      }
    }
    return counts.map((count, i) => ({
      name: `O${i + 1}`,
      fullName: `Outcome ${i + 1} — ${MTOP_SHORT[i]}`,
      count,
      color: MTOP_COLORS[i],
    }));
  }, [filteredPlanning]);

  const mtopTotal = mtopWheelData.reduce((s, d) => s + d.count, 0);
  const hasWheel = mtopTotal > 0;

  const isLoadingCounts = postsLoading || jottingsLoading || observationsLoading;
  const maxObs = Math.max(...(report?.byChild ?? []).map((c) => c.observationCount), 1);

  const siteName = sites?.find((s) => String(s.id) === selectedSite)?.name;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Stories</h1>
        <p className="text-muted-foreground mt-1">
          Track posts, jottings, observations and planning cycle outcomes by site and time period.
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

      {/* Period label */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider -mb-2">
        {periodLabel}{selectedSite !== "all" && siteName ? ` · ${siteName}` : ""}
      </p>

      {/* Summary tiles */}
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

      {/* MTOP Outcome row — donut + two stat tiles */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Two stat tiles stacked */}
        <div className="flex flex-col gap-4">
          <StatTile
            icon={<Eye className="h-5 w-5" />}
            label="Observations"
            count={filteredObservations.length}
            sub="In this period"
            loading={isLoadingCounts}
          />
          <StatTile
            icon={<StickyNote className="h-5 w-5" />}
            label="Active Jottings"
            count={filteredJottings.length}
            sub="In this period"
            loading={isLoadingCounts}
          />
        </div>

        {/* Donut chart */}
        <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">MTOP Outcome</CardTitle>
          <p className="text-xs text-muted-foreground">Outcome coverage across planning cycles — {periodLabel.toLowerCase()}</p>
        </CardHeader>
        <CardContent>
          {planningLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : !hasWheel ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <BookMarked className="h-8 w-8" />
              <p className="text-sm">No planning cycles with linked outcomes in this period.</p>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              {/* Donut */}
              <div className="w-full lg:w-64 shrink-0">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={mtopWheelData}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={100}
                      dataKey="count"
                      nameKey="name"
                      paddingAngle={2}
                      label={false}
                    >
                      {mtopWheelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} opacity={entry.count === 0 ? 0.15 : 1} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, _name, props) => [
                        `${value} plan${Number(value) !== 1 ? "s" : ""}`,
                        props.payload?.fullName ?? "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centre label overlaid via absolute positioning trick is not needed — using svg text approach */}
              </div>

              {/* Legend / breakdown */}
              <div className="flex-1 space-y-2 w-full">
                {mtopWheelData.map((d) => (
                  <div key={d.name} className="flex items-center gap-3">
                    <span
                      className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                      style={{ background: d.color, opacity: d.count === 0 ? 0.3 : 1 }}
                    >
                      {d.name}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{d.fullName.split("— ")[1]}</p>
                      <div className="h-1.5 w-full bg-muted rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${mtopTotal > 0 ? (d.count / mtopTotal) * 100 : 0}%`,
                            background: d.color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums w-5 text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        </Card>
      </div>

      {/* Under-represented outcomes alert */}
      {(report?.underRepresentedOutcomes ?? []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Observations needing more outcome coverage</p>
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

      {/* Observations per Child */}
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
  );
}
