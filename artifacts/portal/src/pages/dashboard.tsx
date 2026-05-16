import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetDashboardSummary, useGetOutcomeCounts, useGetRecentObservations,
  useListNotices, useCreateNotice, useDeleteNotice,
  useGetServiceComplianceReport, useGetLearningStoriesReport,
  useListPlanningExperiences, useListPosts,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Baby, Users, BookOpen, ClipboardList, ShieldCheck, Bell, Trash2, Plus,
  AlertTriangle, CheckCircle2, Clock, XCircle, FileText, Calendar,
  Layers, Image, ChevronRight, TrendingUp, GraduationCap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("leadership");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Select a view based on your role.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="leadership">Leadership</TabsTrigger>
          <TabsTrigger value="educator">Educator</TabsTrigger>
          <TabsTrigger value="guardian">Guardian</TabsTrigger>
        </TabsList>

        <TabsContent value="leadership" className="mt-6">
          <LeadershipDashboard />
        </TabsContent>

        <TabsContent value="educator" className="mt-6">
          <EducatorDashboard />
        </TabsContent>

        <TabsContent value="guardian" className="mt-6">
          <GuardianDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadershipDashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: outcomes, isLoading: loadingOutcomes } = useGetOutcomeCounts();
  const { data: observations, isLoading: loadingObservations } = useGetRecentObservations();
  const { data: notices, isLoading: loadingNotices } = useListNotices();
  const queryClient = useQueryClient();
  const createNotice = useCreateNotice();
  const deleteNotice = useDeleteNotice();

  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticePriority, setNoticePriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [showNoticeForm, setShowNoticeForm] = useState(false);

  const handleCreateNotice = () => {
    if (!noticeTitle || !noticeContent) return;
    createNotice.mutate(
      { data: { title: noticeTitle, content: noticeContent, priority: noticePriority as any, postedById: 1 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
          setNoticeTitle(""); setNoticeContent(""); setNoticePriority("normal"); setShowNoticeForm(false);
        },
      }
    );
  };

  const handleDeleteNotice = (id: number) => {
    deleteNotice.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notices"] }) });
  };

  const priorityColors = {
    low: "bg-slate-100 text-slate-800",
    normal: "bg-blue-100 text-blue-800",
    high: "bg-amber-100 text-amber-800",
    urgent: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Children" value={summary?.activeChildren} icon={Baby} loading={loadingSummary} href="/children" />
        <MetricCard title="Staff Members" value={summary?.totalStaff} icon={Users} loading={loadingSummary} href="/staff" />
        <MetricCard title="Monthly Observations" value={summary?.observationsThisMonth} icon={BookOpen} loading={loadingSummary} href="/observations" />
        <MetricCard title="Active Programs" value={summary?.activePrograms} icon={ClipboardList} loading={loadingSummary} href="/programs" />
      </div>

      <Card className="border-l-4 border-l-primary">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center">
            <Bell className="w-5 h-5 mr-2" /> Notice Board
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowNoticeForm(!showNoticeForm)}>
            <Plus className="w-4 h-4 mr-1" /> Add Notice
          </Button>
        </CardHeader>
        <CardContent>
          {showNoticeForm && (
            <div className="mb-6 p-4 border rounded-md bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Input placeholder="Notice Title" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} />
                </div>
                <div>
                  <Select value={noticePriority} onValueChange={(v: any) => setNoticePriority(v)}>
                    <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button className="w-full" onClick={handleCreateNotice} disabled={createNotice.isPending}>
                    {createNotice.isPending ? "Posting..." : "Post Notice"}
                  </Button>
                </div>
              </div>
              <Textarea placeholder="Notice Content..." value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)} rows={2} />
            </div>
          )}
          {loadingNotices ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              <Skeleton className="h-32 w-64 shrink-0" />
              <Skeleton className="h-32 w-64 shrink-0" />
            </div>
          ) : notices && notices.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              {notices.map((notice) => (
                <div key={notice.id} className="min-w-[280px] max-w-[320px] p-4 rounded-lg border bg-card shrink-0 snap-start flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={`${priorityColors[notice.priority as keyof typeof priorityColors]} border-none capitalize`}>{notice.priority}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteNotice(notice.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{notice.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">{notice.content}</p>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4 pt-2 border-t">{format(new Date(notice.createdAt), "MMM d, h:mm a")}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">No active notices</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center text-lg">
              <span>Recent Observations</span>
              <Link href="/observations"><span className="text-sm text-primary font-normal cursor-pointer hover:underline">View all</span></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingObservations ? (
              <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : !observations || observations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No recent observations</div>
            ) : (
              <div className="space-y-4">
                {observations.slice(0, 5).map((obs) => (
                  <div key={obs.id} className="flex justify-between items-start border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <Link href={`/observations/${obs.id}`}>
                        <div className="font-medium cursor-pointer hover:text-primary transition-colors">{obs.title}</div>
                      </Link>
                      <div className="text-sm text-muted-foreground mt-1">{obs.childName} • By {obs.staffName}</div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-accent/50 px-2 py-1 rounded">{format(new Date(obs.observationDate), "MMM d, yyyy")}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MTOP Outcomes Focus</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOutcomes ? (
              <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : !outcomes || outcomes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No outcome data available</div>
            ) : (
              <div className="space-y-4">
                {outcomes.map((oc) => (
                  <div key={oc.outcomeId} className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mr-3 shrink-0">
                      {oc.outcomeNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium line-clamp-1 pr-2">{oc.outcomeTitle}</span>
                        <span className="text-sm text-muted-foreground">{oc.count}</span>
                      </div>
                      <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (oc.count / (summary?.totalObservations || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-lg text-primary">
            <ShieldCheck className="mr-2 h-5 w-5" /> NQS Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-foreground/80 mb-1">Quality Areas Meeting or Exceeding Standards</p>
              <div className="text-2xl font-bold">{summary?.nqsMeetingCount || 0} <span className="text-muted-foreground text-lg font-normal">/ 7</span></div>
            </div>
            <Link href="/nqs">
              <span className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                Review NQS
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EducatorDashboard() {
  const { data: service, isLoading: loadingService } = useGetServiceComplianceReport();
  const { data: learning, isLoading: loadingLearning } = useGetLearningStoriesReport();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();

  const evacOk = service?.evacuationStatus?.lastConducted && !service?.evacuationStatus?.isOverdue;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Service Compliance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Service Compliance</span>
              <Link href="/reports/service"><span className="text-xs text-primary font-normal cursor-pointer hover:underline flex items-center gap-0.5">Full report <ChevronRight className="h-3 w-3" /></span></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingService ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="space-y-3">
                <ComplianceRow
                  icon={service?.openIncidents === 0 ? CheckCircle2 : AlertTriangle}
                  ok={service?.openIncidents === 0}
                  label="Open Incidents"
                  value={service?.openIncidents ?? 0}
                  suffix="open"
                />
                <ComplianceRow
                  icon={service?.openConditionReports === 0 ? CheckCircle2 : AlertTriangle}
                  ok={service?.openConditionReports === 0}
                  label="Condition Reports"
                  value={service?.openConditionReports ?? 0}
                  suffix="open"
                />
                <ComplianceRow
                  icon={service?.overdueChecklists === 0 ? CheckCircle2 : AlertTriangle}
                  ok={service?.overdueChecklists === 0}
                  label="Overdue Checklists"
                  value={service?.overdueChecklists ?? 0}
                  suffix="overdue"
                />
                <ComplianceRow
                  icon={service?.openQipItems === 0 ? CheckCircle2 : Clock}
                  ok={service?.openQipItems === 0}
                  label="Open QIP Items"
                  value={service?.openQipItems ?? 0}
                  suffix="open"
                />
                <ComplianceRow
                  icon={evacOk ? CheckCircle2 : AlertTriangle}
                  ok={!!evacOk}
                  label="Evacuation Drill"
                  value={service?.evacuationStatus?.lastConducted ? format(parseISO(service.evacuationStatus.lastConducted), "d MMM yyyy") : "Never conducted"}
                  isText
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Learning Story Compliance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Learning Story Compliance</span>
              <Link href="/reports/learning"><span className="text-xs text-primary font-normal cursor-pointer hover:underline flex items-center gap-0.5">Full report <ChevronRight className="h-3 w-3" /></span></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLearning || loadingSummary ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2.5">
                  <span className="text-sm font-medium">Observations this month</span>
                  <span className="text-lg font-bold text-primary">{summary?.observationsThisMonth ?? 0}</span>
                </div>

                {learning?.underRepresentedOutcomes && learning.underRepresentedOutcomes.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Under-represented MTOP outcomes</p>
                    <div className="space-y-1.5">
                      {learning.underRepresentedOutcomes.map((o) => (
                        <div key={o.outcomeId} className="flex items-center gap-2 text-sm">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="text-foreground font-medium">Outcome {o.outcomeNumber}</span>
                          <span className="text-muted-foreground">{o.outcomeTitle}</span>
                          <Badge className="ml-auto bg-amber-100 text-amber-800 text-xs border-none">{o.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    All MTOP outcomes are well represented
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Outcomes breakdown</p>
                  <div className="space-y-2">
                    {(learning?.byOutcome ?? []).map((oc) => (
                      <div key={oc.outcomeId} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">{oc.outcomeNumber}</div>
                        <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, (oc.count / Math.max(1, summary?.observationsThisMonth ?? 1)) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-4 text-right">{oc.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Children without recent obs */}
      {(learning?.byChild ?? []).filter((c) => c.observationCount === 0).length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" /> Children with no observations this month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {learning!.byChild.filter((c) => c.observationCount === 0).map((c) => (
                <Link key={c.childId} href={`/children/${c.childId}`}>
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 cursor-pointer hover:bg-amber-200">{c.childName}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GuardianDashboard() {
  const { data: notices, isLoading: loadingNotices } = useListNotices();
  const { data: posts, isLoading: loadingPosts } = useListPosts();
  const { data: planning, isLoading: loadingPlanning } = useListPlanningExperiences();

  const publishedPlans = (planning ?? [])
    .filter((p) => p.stage === "published")
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
    .slice(0, 3);

  const priorityColors: Record<string, string> = {
    low: "bg-slate-100 text-slate-800",
    normal: "bg-blue-100 text-blue-800",
    high: "bg-amber-100 text-amber-800",
    urgent: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-8">
      {/* Notices */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Messages from the Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingNotices ? (
            <div className="flex gap-4"><Skeleton className="h-32 w-64 shrink-0" /><Skeleton className="h-32 w-64 shrink-0" /></div>
          ) : notices && notices.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              {notices.map((notice) => (
                <div key={notice.id} className="min-w-[260px] max-w-[300px] p-4 rounded-lg border bg-card shrink-0 snap-start">
                  <Badge className={`${priorityColors[notice.priority] ?? priorityColors.normal} border-none capitalize mb-2`}>{notice.priority}</Badge>
                  <h4 className="font-semibold text-sm mb-1">{notice.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-3">{notice.content}</p>
                  <div className="text-xs text-muted-foreground mt-3 pt-2 border-t">{format(new Date(notice.createdAt), "MMM d, h:mm a")}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">No messages at this time</div>
          )}
        </CardContent>
      </Card>

      {/* Published weekly plans */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Weekly Learning Programs</span>
            <Link href="/calendar"><span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-0.5">View calendar <ChevronRight className="h-3 w-3" /></span></Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPlanning ? (
            <div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
          ) : publishedPlans.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No published learning programs yet</div>
          ) : (
            <div className="space-y-3">
              {publishedPlans.map((plan) => (
                <Link key={plan.id} href="/calendar">
                  <div className="flex items-center justify-between rounded-md border px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Layers className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">{plan.title}</p>
                        {plan.startDate && <p className="text-xs text-muted-foreground">Week of {format(parseISO(plan.startDate), "d MMMM yyyy")}</p>}
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-none text-xs">Published</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Image className="h-4 w-4" /> Posts from the Centre</span>
            <Link href="/posts"><span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-0.5">View all <ChevronRight className="h-3 w-3" /></span></Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPosts ? (
            <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
          ) : !posts || posts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No posts yet</div>
          ) : (
            <div className="space-y-4">
              {posts.slice(0, 4).map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`}>
                  <div className="flex items-start gap-3 border-b pb-4 last:border-0 last:pb-0 cursor-pointer group">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-1">{post.title}</p>
                      {post.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.content}</p>}
                      {post.createdAt && <p className="text-xs text-muted-foreground mt-1">{format(new Date(post.createdAt), "MMM d, yyyy")}</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceRow({
  icon: Icon, ok, label, value, suffix, isText,
}: {
  icon: any; ok: boolean; label: string; value: number | string; suffix?: string; isText?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md px-3 py-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${ok ? "text-green-600" : "text-amber-500"}`} />
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-sm font-medium ${ok ? "text-green-700" : "text-amber-700"}`}>
        {isText ? value : `${value}${suffix ? ` ${suffix}` : ""}`}
      </span>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, loading, href }: { title: string; value?: number; icon: any; loading: boolean; href?: string }) {
  const content = (
    <Card className={href ? "hover:border-primary/50 transition-colors cursor-pointer" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{value ?? 0}</div>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
