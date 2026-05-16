import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetDashboardSummary, useGetOutcomeCounts, useGetRecentObservations,
  useListNotices, useCreateNotice, useDeleteNotice,
  useGetServiceComplianceReport, useGetLearningStoriesReport,
  useListPlanningExperiences, useListPosts, useListSites,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Link } from "wouter";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RichTextEditor, RichTextView } from "@/components/rich-text-editor";
import {
  Baby, Users, BookOpen, ClipboardList, ShieldCheck, Bell, Trash2, Plus,
  AlertTriangle, CheckCircle2, Clock, FileText, Calendar,
  Layers, Image, ChevronRight, GraduationCap, Paperclip, X, Upload, Newspaper,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListNoticesQueryKey } from "@workspace/api-client-react";

// ─── Shared priority colours ────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

type NoticeAudience = "leadership" | "educator" | "guardian";

// ─── Shared Notice Board ─────────────────────────────────────────────────────
function NoticeBoard({ canManage, audience }: { canManage: boolean; audience: NoticeAudience }) {
  const queryClient = useQueryClient();
  const params = { audience };
  const { data: notices, isLoading } = useListNotices(params);
  const createNotice = useCreateNotice();
  const deleteNotice = useDeleteNotice();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [docFile, setDocFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedNotice, setSelectedNotice] = useState<(typeof notices extends (infer T)[] | undefined ? T : never) | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: () => alert("Document upload failed — please try again."),
  });

  const resetForm = () => {
    setTitle(""); setContent(""); setPriority("normal"); setDocFile(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePost = async () => {
    if (!title || !content) return;

    let documentUrl: string | undefined;
    let documentName: string | undefined;

    if (docFile) {
      const result = await uploadFile(docFile);
      if (!result) return; // upload failed
      documentUrl = `/api/storage/objects/${result.objectPath.replace(/^\/?(objects\/)?/, "")}`;
      documentName = docFile.name;
    }

    createNotice.mutate(
      { data: { title, content, priority: priority as any, audience: audience as any, documentUrl, documentName } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNoticesQueryKey(params) });
          resetForm();
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteNotice.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNoticesQueryKey(params) }) });
  };

  const isSaving = createNotice.isPending || isUploading;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" /> Notice Board
        </CardTitle>
        {canManage && (
          <Button variant="ghost" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? "Cancel" : "Add Notice"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form — staff only */}
        {canManage && showForm && (
          <div className="p-4 border rounded-md bg-muted/30 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Input placeholder="Notice title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <RichTextEditor value={content} onChange={setContent} placeholder="Notice content…" />

            {/* Document upload */}
            <div>
              {docFile ? (
                <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{docFile.name}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => { setDocFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed rounded-md px-3 py-2 w-full hover:bg-muted/40 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Attach a document (optional)
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button className="w-full" onClick={handlePost} disabled={isSaving || !title || !content}>
              {isUploading ? "Uploading document…" : isSaving ? "Posting…" : "Post Notice"}
            </Button>
          </div>
        )}

        {/* Notice cards */}
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            <Skeleton className="h-36 w-64 shrink-0" />
            <Skeleton className="h-36 w-64 shrink-0" />
          </div>
        ) : notices && notices.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="min-w-[280px] max-w-[320px] p-4 rounded-lg border shrink-0 snap-start flex flex-col justify-between text-white cursor-pointer hover:brightness-95 transition-all"
                style={{ backgroundColor: "#29BCD4", borderColor: "#1fa8be" }}
                onClick={() => setSelectedNotice(notice)}
              >
                <div className="space-y-1.5">
                  <div className="flex justify-between items-start">
                    <Badge className={`${PRIORITY_COLORS[notice.priority] ?? PRIORITY_COLORS.normal} border-none capitalize`}>
                      {notice.priority}
                    </Badge>
                    {canManage && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 -mt-1 -mr-1 text-white/70 hover:text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); handleDelete(notice.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-white">{notice.title}</h4>
                  <RichTextView html={notice.content} className="text-white/85 line-clamp-3" />

                  {notice.documentUrl && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{notice.documentName ?? "Attached document"}</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-white/60 mt-4 pt-2 border-t border-white/25">
                  {format(new Date(notice.createdAt), "MMM d, h:mm a")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">No active notices</div>
        )}
      </CardContent>

      {/* Full notice detail dialog */}
      <Dialog open={!!selectedNotice} onOpenChange={(open) => { if (!open) setSelectedNotice(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${PRIORITY_COLORS[selectedNotice?.priority ?? "normal"]} border-none capitalize`}>
                {selectedNotice?.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedNotice && format(new Date(selectedNotice.createdAt), "MMMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
            <DialogTitle className="text-lg leading-snug">{selectedNotice?.title}</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            {selectedNotice && (
              <RichTextView html={selectedNotice.content} className="text-foreground" />
            )}

            {selectedNotice?.documentUrl && (
              <div className="pt-3 border-t">
                <a
                  href={selectedNotice.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                >
                  <Paperclip className="h-4 w-4 shrink-0" />
                  {selectedNotice.documentName ?? "Attached document"}
                </a>
              </div>
            )}

            {canManage && selectedNotice && (
              <div className="pt-3 border-t flex justify-end">
                <Button
                  variant="destructive" size="sm"
                  onClick={() => {
                    handleDelete(selectedNotice.id);
                    setSelectedNotice(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete notice
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Dashboard shell ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("leadership");
  const { data: sites } = useListSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const siteName = sites?.find((s) => String(s.id) === selectedSiteId)?.name ?? sites?.[0]?.name;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Select a view based on your role.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-6 flex-wrap">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="leadership">Leadership</TabsTrigger>
            <TabsTrigger value="educator">Educator</TabsTrigger>
            <TabsTrigger value="guardian">Guardian</TabsTrigger>
          </TabsList>
          {activeTab === "educator" && sites && sites.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Your service is:</span>
              <Select
                value={selectedSiteId || String(sites[0].id)}
                onValueChange={setSelectedSiteId}
              >
                <SelectTrigger className="h-8 text-sm w-auto min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

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

// ─── Leadership ───────────────────────────────────────────────────────────────
function LeadershipDashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: outcomes, isLoading: loadingOutcomes } = useGetOutcomeCounts();
  const { data: observations, isLoading: loadingObservations } = useGetRecentObservations();

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Active Children" value={summary?.activeChildren} icon={Baby} loading={loadingSummary} href="/children" />
        <MetricCard title="Staff Members" value={summary?.totalStaff} icon={Users} loading={loadingSummary} href="/staff" />
        <MetricCard title="Monthly Observations" value={summary?.observationsThisMonth} icon={BookOpen} loading={loadingSummary} href="/observations" />
        <MetricCard title="Active Programs" value={summary?.activePrograms} icon={ClipboardList} loading={loadingSummary} href="/programs" />
      </div>

      <NoticeBoard canManage audience="leadership" />

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
          <CardHeader><CardTitle className="text-lg">MTOP Outcomes Focus</CardTitle></CardHeader>
          <CardContent>
            {loadingOutcomes ? (
              <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : !outcomes || outcomes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No outcome data available</div>
            ) : (
              <div className="space-y-4">
                {outcomes.map((oc) => (
                  <div key={oc.outcomeId} className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm mr-3 shrink-0">{oc.outcomeNumber}</div>
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

// ─── Outcome Pie Chart ───────────────────────────────────────────────────────
const OUTCOME_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#f43f5e"];
const OUTCOME_LABELS: Record<number, string> = {
  1: "Identity", 2: "World", 3: "Wellbeing", 4: "Learners", 5: "Communicators",
};

type OutcomeItem = { outcomeId: number; outcomeNumber: number; outcomeTitle: string; count: number };

function OutcomePieChart({ outcomes }: { outcomes: OutcomeItem[] }) {
  const data = outcomes.map((o) => ({
    name: `Outcome ${o.outcomeNumber}: ${OUTCOME_LABELS[o.outcomeNumber] ?? o.outcomeTitle}`,
    value: o.count,
    number: o.outcomeNumber,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Outcomes breakdown</p>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No observations recorded yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[(entry.number - 1) % OUTCOME_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: "11px" }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Educator ────────────────────────────────────────────────────────────────
function EducatorDashboard() {
  const { data: service, isLoading: loadingService } = useGetServiceComplianceReport();
  const { data: learning, isLoading: loadingLearning } = useGetLearningStoriesReport();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();

  const evacOk = service?.evacuationStatus?.lastConducted && !service?.evacuationStatus?.isOverdue;

  return (
    <div className="space-y-8">
      <NoticeBoard canManage audience="educator" />

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
                <ComplianceRow icon={service?.openIncidents === 0 ? CheckCircle2 : AlertTriangle} ok={service?.openIncidents === 0} label="Open Incidents" value={service?.openIncidents ?? 0} suffix="open" />
                <ComplianceRow icon={service?.openConditionReports === 0 ? CheckCircle2 : AlertTriangle} ok={service?.openConditionReports === 0} label="Condition Reports" value={service?.openConditionReports ?? 0} suffix="open" />
                <ComplianceRow icon={service?.overdueChecklists === 0 ? CheckCircle2 : AlertTriangle} ok={service?.overdueChecklists === 0} label="Overdue Checklists" value={service?.overdueChecklists ?? 0} suffix="overdue" />
                <ComplianceRow icon={service?.openQipItems === 0 ? CheckCircle2 : Clock} ok={service?.openQipItems === 0} label="Open QIP Items" value={service?.openQipItems ?? 0} suffix="open" />
                <ComplianceRow
                  icon={evacOk ? CheckCircle2 : AlertTriangle} ok={!!evacOk}
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
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
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
                          <span className="font-medium">Outcome {o.outcomeNumber}</span>
                          <span className="text-muted-foreground">{o.outcomeTitle}</span>
                          <Badge className="ml-auto bg-amber-100 text-amber-800 text-xs border-none">{o.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> All MTOP outcomes are well represented
                  </div>
                )}
                <OutcomePieChart outcomes={learning?.byOutcome ?? []} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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

// ─── Guardian ────────────────────────────────────────────────────────────────
function GuardianDashboard() {
  const { data: posts, isLoading: loadingPosts } = useListPosts();
  const { data: planning, isLoading: loadingPlanning } = useListPlanningExperiences();

  const publishedPlans = (planning ?? [])
    .filter((p) => p.stage === "published")
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <NoticeBoard canManage={false} audience="guardian" />

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
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Image className="h-4 w-4" /> Posts from the Centre
          </h2>
          <Link href="/posts">
            <span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </div>

        {loadingPosts ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : !posts || posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Newspaper className="h-10 w-10 mb-2 opacity-40" />
              <p className="font-medium">No posts yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...posts]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 6)
              .map((post) => {
                const coverImage = post.images?.[0];
                return (
                  <Link key={post.id} href={`/posts/${post.id}`}>
                    <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group h-full">
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        {coverImage ? (
                          <img
                            src={`/api/storage/objects/${coverImage.replace(/^\/objects\//, "")}`}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Newspaper className="h-10 w-10 text-muted-foreground opacity-30" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <h3 className="font-semibold leading-snug line-clamp-2">{post.title}</h3>
                        {post.childNames && post.childNames.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {post.childNames.map((name) => (
                              <Badge key={name} variant="secondary" className="text-xs gap-1">
                                <Users className="h-2.5 w-2.5" />{name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {post.aiSummary ? (
                          <p className="text-sm text-muted-foreground line-clamp-3">{post.aiSummary}</p>
                        ) : post.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-3">{post.description.replace(/<[^>]*>/g, "")}</p>
                        ) : null}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                          {post.staffName && <span>{post.staffName}</span>}
                          {post.staffName && post.date && <span>·</span>}
                          {post.date && <span>{format(new Date(post.date.slice(0, 10) + "T00:00:00"), "d MMM yyyy")}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared sub-components ───────────────────────────────────────────────────
function ComplianceRow({ icon: Icon, ok, label, value, suffix, isText }: {
  icon: any; ok: boolean | undefined; label: string; value: number | string; suffix?: string; isText?: boolean;
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
