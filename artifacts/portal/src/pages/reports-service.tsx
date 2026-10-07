import { useState } from "react";
import { useGetServiceComplianceReport, useListSites, useListPlanningExperiences, useGetRollComplianceReport, useListWeeklyReviews } from "@workspace/api-client-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, AlertTriangle, CheckCircle2, ClipboardX, TrendingUp, CheckSquare, Layers, ArrowRight, ClipboardList, ClipboardCheck } from "lucide-react";
import { format, isBefore, parseISO, startOfToday } from "date-fns";
import { Link } from "wouter";
import { EmergencyComplianceMatrix } from "@/components/emergency-compliance-matrix";
import { useAuth } from "@/contexts/auth";

export default function ReportsService() {
  const { user } = useAuth();
  const emergencyPreferenceKey = user ? `educare:emergency-record-headings:${user.type}:${user.id}` : undefined;
  const { isEducatorRole, ownSiteId } = usePermissions();
  const [filterSiteId, setFilterSiteId] = useState<string>(() =>
    isEducatorRole && ownSiteId ? String(ownSiteId) : "__all__"
  );
  const { data: sites, isLoading: sitesLoading, isError: sitesError, refetch: refetchSites } = useListSites();
  const siteIdParam = filterSiteId === "__all__" ? undefined : Number(filterSiteId);
  const { data: report, isLoading, isError: reportError, refetch: refetchReport } = useGetServiceComplianceReport(siteIdParam ? { siteId: siteIdParam } : undefined);
  const { data: allPlanning, isLoading: planningLoading } = useListPlanningExperiences();
  const { data: rollReport, isLoading: rollLoading } = useGetRollComplianceReport(siteIdParam ? { siteId: siteIdParam } : undefined);
  const { data: allReviews } = useListWeeklyReviews();

  const today = startOfToday();

  // Past published weekly plans (have a grid) per site
  const pastPublishedPlans = (allPlanning ?? []).filter((p) => {
    if (p.weeklyPlanData == null) return false;
    if (p.stage !== "published") return false;
    if (!p.startDate) return false;
    return isBefore(parseISO(p.startDate.slice(0, 10)), today);
  });

  // Outstanding = past published plans with no matching weekly review
  function outstandingForSite(siteId: number) {
    return pastPublishedPlans.filter((p) => {
      if (p.siteId !== siteId) return false;
      const weekStart = p.startDate!.slice(0, 10);
      return !(allReviews ?? []).some((r) => r.weekStart === weekStart && r.siteId === siteId);
    });
  }

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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Emergency Record Compliance</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Expired records remain outstanding until a newer record of the same type replaces them. Records due within 14 days show an Expiring soon warning on hover.
              </p>
            </div>
            <Link href="/evacuations">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted">View records</Badge>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <EmergencyComplianceMatrix
            key={emergencyPreferenceKey ?? "anonymous"}
            preferenceKey={emergencyPreferenceKey}
            sites={sites}
            report={report}
            sitesLoading={sitesLoading}
            sitesError={sitesError}
            reportError={reportError}
            selectedSiteId={siteIdParam}
            onRetry={() => { refetchSites(); refetchReport(); }}
          />
        </CardContent>
      </Card>

      {/* Roll Compliance Report */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Roll Compliance</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {rollLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !rollReport || rollReport.sites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No roll data recorded yet.</p>
          ) : (
            <>
              {/* Per-site summary table */}
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Site</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">4 Weeks</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">12 Weeks</th>
                      <th className="text-center px-3 py-2 font-medium text-muted-foreground">52 Weeks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rollReport.sites.map((site) => (
                      <tr key={site.siteId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 font-medium">{site.siteName}</td>
                        {([site.last4Weeks, site.last12Weeks, site.last52Weeks] as const).map((cell, i) => (
                          <td key={i} className="px-3 py-2 text-center">
                            <span className={`font-medium ${cell.pct === 100 ? "text-green-700" : cell.pct >= 75 ? "text-amber-700" : "text-red-700"}`}>
                              {cell.submitted}/{cell.totalPossible}
                            </span>
                            <span className="text-muted-foreground ml-1.5 text-xs">({cell.pct}%)</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Weekly Reviews</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Outstanding weekly reviews per service — past published weeks without a completed review.</p>
        </CardHeader>
        <CardContent className="p-0">
          {planningLoading ? (
            <div className="px-6 pb-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (sites ?? []).filter((s) => siteIdParam === undefined || s.id === siteIdParam).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No services found.</p>
          ) : (
            <div className="rounded-b-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Service</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Outstanding</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Total plans</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(sites ?? [])
                    .filter((s) => siteIdParam === undefined || s.id === siteIdParam)
                    .map((site) => {
                      const outstanding = outstandingForSite(site.id);
                      const total = pastPublishedPlans.filter((p) => p.siteId === site.id).length;
                      const allDone = outstanding.length === 0 && total > 0;
                      const noneYet = total === 0;
                      return (
                        <tr key={site.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{site.name}</td>
                          <td className="px-4 py-3 text-center">
                            {noneYet ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              <span className={`font-bold text-base ${outstanding.length > 0 ? "text-amber-600" : "text-green-600"}`}>
                                {outstanding.length}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{total}</td>
                          <td className="px-4 py-3 text-right">
                            {noneYet ? (
                              <span className="text-xs text-muted-foreground">No plans yet</span>
                            ) : allDone ? (
                              <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" /> All reviewed
                              </Badge>
                            ) : (
                              <Link href="/calendar">
                                <Badge className="bg-amber-100 text-amber-800 text-xs cursor-pointer hover:bg-amber-200">
                                  {outstanding.length} pending →
                                </Badge>
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                          {cycle.startDate && <span>Started {format(new Date(cycle.startDate), "dd/MM/yyyy")}</span>}
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
