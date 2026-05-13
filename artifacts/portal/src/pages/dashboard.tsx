import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetDashboardSummary, useGetOutcomeCounts, useGetRecentObservations, useListNotices, useCreateNotice, useDeleteNotice } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Baby, Users, BookOpen, ClipboardList, ShieldCheck, Bell, Trash2, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
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
      {
        data: {
          title: noticeTitle,
          content: noticeContent,
          priority: noticePriority as any,
          postedById: 1, // Mock user ID for now
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
          setNoticeTitle("");
          setNoticeContent("");
          setNoticePriority("normal");
          setShowNoticeForm(false);
        },
      }
    );
  };

  const handleDeleteNotice = (id: number) => {
    deleteNotice.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/notices"] });
        },
      }
    );
  };

  const priorityColors = {
    low: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
    normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    high: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Centre Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of centre metrics and recent activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Children" value={summary?.activeChildren} icon={Baby} loading={loadingSummary} />
        <MetricCard title="Staff Members" value={summary?.totalStaff} icon={Users} loading={loadingSummary} />
        <MetricCard title="Monthly Obs." value={summary?.observationsThisMonth} icon={BookOpen} loading={loadingSummary} />
        <MetricCard title="Active Programs" value={summary?.activePrograms} icon={ClipboardList} loading={loadingSummary} />
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
                  <Input 
                    placeholder="Notice Title" 
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Select value={noticePriority} onValueChange={(v: any) => setNoticePriority(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
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
              <Textarea 
                placeholder="Notice Content..." 
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                rows={2}
              />
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
                      <Badge className={`${priorityColors[notice.priority as keyof typeof priorityColors]} border-none hover:bg-opacity-80 capitalize`}>
                        {notice.priority}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteNotice(notice.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{notice.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">{notice.content}</p>
                  </div>
                  <div className="text-xs text-muted-foreground mt-4 pt-2 border-t">
                    {format(new Date(notice.createdAt), "MMM d, h:mm a")}
                  </div>
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
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
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
                      <div className="text-sm text-muted-foreground mt-1">
                        {obs.childName} • By {obs.staffName}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-accent/50 px-2 py-1 rounded">
                      {format(new Date(obs.observationDate), "MMM d, yyyy")}
                    </div>
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
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
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
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${Math.min(100, (oc.count / (summary?.totalObservations || 1)) * 100)}%` }} 
                        />
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

function MetricCard({ title, value, icon: Icon, loading }: { title: string, value?: number, icon: any, loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-3xl font-bold">{value || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
