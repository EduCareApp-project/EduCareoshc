import { useState } from "react";
import { useGetServiceComplianceReport, useListSites, useListPlanningExperiences } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, ClipboardX, TrendingUp, CheckSquare, Layers, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function ReportsService() {
  const [filterSiteId, setFilterSiteId] = useState<string>("__all__");
  const { data: sites } = useListSites();
  const siteIdParam = filterSiteId === "__all__" ? undefined : Number(filterSiteId);
  const { data: report, isLoading } = useGetServiceComplianceReport(siteIdParam ? { siteId: siteIdParam } : undefined);
  const { data: allPlanning, isLoading: planningLoading } = useListPlanningExperiences();

  const assessmentCycles = (allPlanning ?? []).filter((p) => {
    if (p.stage !== "assessment") return false;
    if (siteIdParam !== undefined && p.siteId !== siteIdParam) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold tracking-tight">Service Compliance</h1></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      </div>
    );
  }

  const evac = report?.evacuationStatus;
  const evacColor = !evac?.lastConducted ? "border-slate-200 bg-slate-50"
    : evac.isOverdue ? "border-red-200 bg-red-50"
    : "border-green-200 bg-green-50";
  const EvacIcon = !evac?.lastConducted ? Clock : evac.isOverdue ? AlertTriangle : CheckCircle2;
  const evacIconColor = !evac?.lastConducted ? "text-slate-500" : evac.isOverdue ? "text-red-600" : "text-green-600";

  const MetricCard = ({ title, value, icon: Icon, href, color = "border-border" }: { title: string; value: number; icon: any; href: string; color?: string }) => (
    <Link href={href}>
      <Card className={`cursor-pointer hover:shadow-md transition-shadow ${color}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">{title}</p>
              <p className={`text-3xl font-bold mt-1 ${value > 0 ? "text-amber-600" : "text-green-600"}`}>{value}</p>
            </div>
            <Icon className={`h-6 w-6 mt-1 ${value > 0 ? "text-amber-400" : "text-green-400"}`} />
          </div>
          {value === 0 && <Badge className="mt-2 bg-green-100 text-green-800">All clear</Badge>}
          {value > 0 && <Badge className="mt-2 bg-amber-100 text-amber-800">Needs attention</Badge>}
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Compliance</h1>
          <p className="text-muted-foreground mt-1">Overview of outstanding compliance items across your service.</p>
        </div>
        <Select value={filterSiteId} onValueChange={setFilterSiteId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Sites</SelectItem>
            {(sites ?? []).map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className={`${evacColor} border`}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <EvacIcon className={`h-8 w-8 shrink-0 mt-0.5 ${evacIconColor}`} />
            <div className="flex-1">
              <p className="font-semibold text-base">Safety Evacuation Drill</p>
              {!evac?.lastConducted ? (
                <p className="text-sm text-muted-foreground mt-1">No drills recorded. Evacuation drills are required every 90 days.</p>
              ) : (
                <div className="text-sm mt-1 space-y-0.5">
                  <p className="text-muted-foreground">Last conducted: <span className="font-medium text-foreground">{format(new Date(evac.lastConducted), "MMM d, yyyy")}</span></p>
                  {evac.nextDue && <p className="text-muted-foreground">Next due: <span className={`font-medium ${evac.isOverdue ? "text-red-700" : "text-foreground"}`}>{format(new Date(evac.nextDue), "MMM d, yyyy")}{evac.isOverdue ? " (OVERDUE)" : ""}</span></p>}
                </div>
              )}
            </div>
            <Link href="/evacuations">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">View</Badge>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Open Incidents" value={report?.openIncidents ?? 0} icon={AlertTriangle} href="/incidents" color={report?.openIncidents ? "border-amber-200" : ""} />
        <MetricCard title="Open Condition Reports" value={report?.openConditionReports ?? 0} icon={ClipboardX} href="/condition-reports" color={report?.openConditionReports ? "border-amber-200" : ""} />
        <MetricCard title="In-Progress QIP Items" value={report?.openQipItems ?? 0} icon={TrendingUp} href="/qip" />
        <Link href="/checklists">
          <Card className={`cursor-pointer hover:shadow-md transition-shadow ${(report?.overdueChecklists ?? 0) > 0 ? "border-red-200" : "border-border"}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active Checklists</p>
                  <p className="text-3xl font-bold mt-1">{report?.activeChecklists ?? 0}</p>
                </div>
                <CheckSquare className={`h-6 w-6 mt-1 ${(report?.overdueChecklists ?? 0) > 0 ? "text-red-400" : "text-green-400"}`} />
              </div>
              {(report?.overdueChecklists ?? 0) > 0 ? (
                <Badge className="mt-2 bg-red-100 text-red-800">{report?.overdueChecklists} overdue &gt;7 days</Badge>
              ) : (
                <Badge className="mt-2 bg-green-100 text-green-800">None overdue</Badge>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Planning Cycles in Assessment</CardTitle>
              {assessmentCycles.length > 0 && (
                <Badge className="bg-amber-100 text-amber-800">{assessmentCycles.length} awaiting review</Badge>
              )}
            </div>
            <Link href="/planning">
              <span className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">View all <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {planningLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : assessmentCycles.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              No planning cycles currently in the assessment stage{filterSiteId !== "__all__" ? " for this site" : ""}.
            </div>
          ) : (
            <div className="divide-y">
              {assessmentCycles.map((cycle) => {
                const site = (sites ?? []).find((s) => s.id === cycle.siteId);
                return (
                  <Link key={cycle.id} href={`/planning/${cycle.id}`}>
                    <div className="flex items-center justify-between py-3 px-1 hover:bg-muted/50 rounded cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{cycle.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          {site && <span>{site.name}</span>}
                          {cycle.startDate && <span>Started {format(new Date(cycle.startDate), "MMM d, yyyy")}</span>}
                          {cycle.preparedBy && <span>By {cycle.preparedBy}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <Badge className="bg-amber-100 text-amber-800 text-xs">Assessment</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
