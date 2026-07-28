import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetDashboardSummary, useGetOutcomeCounts, useGetRecentObservations, useGetRecentActivity,
  useListNotices, useCreateNotice, useDeleteNotice, useUpdateNotice,
  useGetServiceComplianceReport, useGetLearningStoriesReport,
  useListPlanningExperiences, useListPosts, useListSites,
  useListChecklistRoutines, useListChildren, useGetExpiringMedications,
  useListChildMedications, useUpsertChildMedication,
  getListChildMedicationsQueryKey,
} from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Link } from "wouter";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RichTextEditor, RichTextView } from "@/components/rich-text-editor";
import {
  Baby, Users, BookOpen, ClipboardList, ShieldCheck, Bell, Trash2, Plus,
  AlertTriangle, CheckCircle2, Clock, FileText, Calendar, PenLine, ShoppingCart,
  Layers, Image, ChevronLeft, ChevronRight, GraduationCap, Paperclip, X, XCircle, Upload, Newspaper, Pencil, ExternalLink, ClipboardCheck, Building2, Pill,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfWeek, addDays, differenceInCalendarDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListNoticesQueryKey } from "@workspace/api-client-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";

// ─── Shared priority colours ────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-800",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

type NoticeAudience = "leadership" | "educator" | "guardian";

// ─── Shared Notice Board ─────────────────────────────────────────────────────
type NoticeItem = { id: number; title: string; content: string; priority: string; audience: string; siteId?: number | null; createdAt: string; documentPaths?: string[] | null; documentNames?: string[] | null };

function NoticeBoard({ canManage, audience, siteId: externalSiteId }: { canManage: boolean; audience: NoticeAudience; siteId?: string }) {
  const queryClient = useQueryClient();
  const params = { audience };
  const { data: notices, isLoading } = useListNotices(params);
  const createNotice = useCreateNotice();
  const deleteNotice = useDeleteNotice();
  const updateNotice = useUpdateNotice();
  const { isAdmin, ownSiteId } = usePermissions();
  const { data: sites } = useListSites();

  // Site filter — always scoped to a single site.
  // externalSiteId (from the dashboard tab selector) takes priority; falls back to ownSiteId or first site.
  const [siteFilter, setSiteFilter] = useState<string>("");
  useEffect(() => {
    if (externalSiteId) { setSiteFilter(externalSiteId); return; }
    if (siteFilter) return;
    if (ownSiteId) { setSiteFilter(String(ownSiteId)); return; }
    if (sites && sites.length > 0) setSiteFilter(String(sites[0].id));
  }, [sites, ownSiteId, siteFilter, externalSiteId]);

  const displayedNotices = (notices ?? []).filter((n) => {
    if (!siteFilter) return true;
    const id = parseInt(siteFilter);
    return n.siteId === id || n.siteId == null;
  });

  const showSiteFilter = (sites ?? []).length > 1;

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [newSiteId, setNewSiteId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<{ path: string; name: string }[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);

  // Edit state
  const [editingNotice, setEditingNotice] = useState<NoticeItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPriority, setEditPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [editAudience, setEditAudience] = useState<NoticeAudience>("leadership");
  const [editSiteId, setEditSiteId] = useState<number | null>(null);
  const [editDocuments, setEditDocuments] = useState<{ path: string; name: string }[]>([]);
  const [uploadingEditDoc, setUploadingEditDoc] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  const openEdit = (notice: NoticeItem) => {
    setEditingNotice(notice);
    setEditTitle(notice.title);
    setEditContent(notice.content);
    setEditPriority(notice.priority as any);
    setEditAudience(notice.audience as any);
    setEditSiteId(notice.siteId ?? null);
    setEditDocuments(
      (notice.documentPaths ?? []).map((p, i) => ({ path: p, name: notice.documentNames?.[i] ?? p.split("/").pop() ?? `Document ${i + 1}` }))
    );
  };

  const handleUpdate = () => {
    if (!editingNotice || !editTitle || !editContent) return;
    updateNotice.mutate(
      {
        id: editingNotice.id,
        data: {
          title: editTitle,
          content: editContent,
          priority: editPriority as any,
          audience: editAudience as any,
          siteId: editSiteId ?? null,
          documentPaths: editDocuments.map((d) => d.path),
          documentNames: editDocuments.map((d) => d.name),
        } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listNotices"] });
          setEditingNotice(null);
        },
      }
    );
  };

  const { uploadFile } = useUpload({
    onError: () => alert("Document upload failed — please try again."),
  });

  const handleDocPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const result = await uploadFile(file);
      if (result) setDocuments((prev) => [...prev, { path: result.objectPath, name: file.name }]);
    } finally {
      setUploadingDoc(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleEditDocPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEditDoc(true);
    try {
      const result = await uploadFile(file);
      if (result) setEditDocuments((prev) => [...prev, { path: result.objectPath, name: file.name }]);
    } finally {
      setUploadingEditDoc(false);
      if (editFileRef.current) editFileRef.current.value = "";
    }
  };

  const resetForm = () => {
    setTitle(""); setContent(""); setPriority("normal"); setDocuments([]);
    setNewSiteId(!isAdmin && ownSiteId != null ? ownSiteId : null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePost = async () => {
    if (!title || !content) return;
    createNotice.mutate(
      {
        data: {
          title, content, priority: priority as any, audience: audience as any,
          siteId: newSiteId ?? null,
          documentPaths: documents.map((d) => d.path),
          documentNames: documents.map((d) => d.name),
        } as any,
      },
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

  const isSaving = createNotice.isPending || uploadingDoc;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="w-5 h-5" /> Notice Board
        </CardTitle>
        <div className="flex items-center gap-2">
          {showSiteFilter && (
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {(sites ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = !showForm;
                if (next && !isAdmin && ownSiteId != null) setNewSiteId(ownSiteId);
                setShowForm(next);
              }}
            >
              {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              {showForm ? "Cancel" : "Add Notice"}
            </Button>
          )}
        </div>
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

            {(sites ?? []).length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Site</label>
                <Select
                  value={newSiteId != null ? String(newSiteId) : "all"}
                  onValueChange={(v) => setNewSiteId(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="all">All sites</SelectItem>}
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <RichTextEditor value={content} onChange={setContent} placeholder="Notice content…" />

            {/* Document upload — multiple */}
            <div className="space-y-1.5">
              {documents.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{doc.name}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {uploadingDoc && (
                <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2 text-muted-foreground">
                  <Upload className="h-4 w-4 animate-pulse shrink-0" />
                  Uploading…
                </div>
              )}
              <button
                type="button"
                disabled={uploadingDoc}
                className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed rounded-md px-3 py-2 w-full hover:bg-muted/40 transition-colors disabled:opacity-50"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Attach a document (optional)
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={handleDocPick} />
            </div>

            <Button className="w-full" onClick={handlePost} disabled={isSaving || uploadingDoc || !title || !content}>
              {isSaving ? "Posting…" : "Post Notice"}
            </Button>
          </div>
        )}

        {/* Notice cards */}
        {isLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            <Skeleton className="h-36 w-64 shrink-0" />
            <Skeleton className="h-36 w-64 shrink-0" />
          </div>
        ) : displayedNotices.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {displayedNotices.map((notice) => (
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
                      <div className="flex items-center gap-0.5 -mt-1 -mr-1">
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20"
                          onClick={(e) => { e.stopPropagation(); openEdit(notice); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20"
                          onClick={(e) => { e.stopPropagation(); handleDelete(notice.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm text-white">{notice.title}</h4>
                  <RichTextView html={notice.content} className="text-white/85 line-clamp-3" />

                  {notice.documentPaths && notice.documentPaths.length > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span>{notice.documentPaths.length === 1 ? notice.documentNames?.[0] ?? "1 attachment" : `${notice.documentPaths.length} attachments`}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-2 border-t border-white/25 flex items-center justify-between gap-2">
                  <span className="text-xs text-white/60">{format(new Date(notice.createdAt), "MMM d, h:mm a")}</span>
                  {notice.siteId != null && (
                    <span className="flex items-center gap-1 text-[11px] text-white/70 bg-white/15 rounded px-1.5 py-0.5 shrink-0">
                      <Building2 className="h-3 w-3" />
                      {(sites ?? []).find((s) => s.id === notice.siteId)?.name ?? "One site"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">No active notices</div>
        )}
      </CardContent>

      {/* Edit notice dialog */}
      <Dialog open={!!editingNotice} onOpenChange={(open) => { if (!open) setEditingNotice(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Notice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Notice title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
                <Select value={editPriority} onValueChange={(v: any) => setEditPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Distribute to</label>
                <Select value={editAudience} onValueChange={(v: any) => setEditAudience(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leadership">Leadership</SelectItem>
                    <SelectItem value="educator">Educators</SelectItem>
                    <SelectItem value="guardian">Guardians</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(sites ?? []).length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Site</label>
                <Select
                  value={editSiteId != null ? String(editSiteId) : "all"}
                  onValueChange={(v) => setEditSiteId(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="all">All sites</SelectItem>}
                    {(sites ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <RichTextEditor value={editContent} onChange={setEditContent} placeholder="Notice content…" />

            {/* Edit attachments */}
            <div className="space-y-1.5">
              {editDocuments.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{doc.name}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setEditDocuments((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {uploadingEditDoc && (
                <div className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2 text-muted-foreground">
                  <Upload className="h-4 w-4 animate-pulse shrink-0" />
                  Uploading…
                </div>
              )}
              <button
                type="button"
                disabled={uploadingEditDoc}
                className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed rounded-md px-3 py-2 w-full hover:bg-muted/40 transition-colors disabled:opacity-50"
                onClick={() => editFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Attach a document
              </button>
              <input ref={editFileRef} type="file" className="hidden" onChange={handleEditDocPick} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditingNotice(null)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={updateNotice.isPending || uploadingEditDoc || !editTitle || !editContent}>
                {updateNotice.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full notice detail dialog */}
      <Dialog open={!!selectedNotice} onOpenChange={(open) => { if (!open) setSelectedNotice(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={`${PRIORITY_COLORS[selectedNotice?.priority ?? "normal"]} border-none capitalize`}>
                {selectedNotice?.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedNotice && format(new Date(selectedNotice.createdAt), "dd/MM/yyyy 'at' h:mm a")}
              </span>
              {selectedNotice?.siteId != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                  <Building2 className="h-3 w-3" />
                  {(sites ?? []).find((s) => s.id === selectedNotice.siteId)?.name ?? "One site"}
                </span>
              )}
            </div>
            <DialogTitle className="text-lg leading-snug">{selectedNotice?.title}</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            {selectedNotice && (
              <RichTextView html={selectedNotice.content} className="text-foreground" />
            )}

            {selectedNotice?.documentPaths && selectedNotice.documentPaths.length > 0 && (
              <div className="pt-3 border-t space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>
                {selectedNotice.documentPaths.map((path, idx) => {
                  const name = selectedNotice.documentNames?.[idx] ?? path.split("/").pop() ?? `Document ${idx + 1}`;
                  const stripped = path.replace(/^\/?(objects\/)?/, "");
                  const url = `/api/storage/objects/${stripped}`;
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      {name}
                    </a>
                  );
                })}
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
  const { isEducatorRole, ownSiteId } = usePermissions();
  const [activeTab, setActiveTab] = useState<string>(() => isEducatorRole ? "educator" : "leadership");
  const { data: sites } = useListSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => isEducatorRole && ownSiteId ? String(ownSiteId) : "");
  const [guardianSiteId, setGuardianSiteId] = useState<string>(() => isEducatorRole && ownSiteId ? String(ownSiteId) : "__all__");
  const siteName = sites?.find((s) => String(s.id) === selectedSiteId)?.name ?? sites?.[0]?.name;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Select a view based on your role.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-6 flex-wrap">
          <TabsList className={`grid w-full ${isEducatorRole ? "max-w-xs grid-cols-2" : "max-w-md grid-cols-3"}`}>
            {!isEducatorRole && <TabsTrigger value="leadership">Leadership</TabsTrigger>}
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
          {activeTab === "guardian" && sites && sites.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Site:</span>
              <Select value={guardianSiteId} onValueChange={setGuardianSiteId}>
                <SelectTrigger className="h-8 text-sm w-auto min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {!isEducatorRole && (
          <TabsContent value="leadership" className="mt-6">
            <LeadershipDashboard />
          </TabsContent>
        )}
        <TabsContent value="educator" className="mt-6">
          <EducatorDashboard selectedSiteId={selectedSiteId || (sites?.[0] ? String(sites[0].id) : "")} />
        </TabsContent>
        <TabsContent value="guardian" className="mt-6">
          <GuardianDashboard siteFilter={guardianSiteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Roll Submission Checklist ────────────────────────────────────────────────
type SiteStatus = {
  siteId: number;
  siteName: string;
  id: number | null;
  submitted: boolean;
  accurate: boolean;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

type WeekData = {
  weekStart: string;
  sites: SiteStatus[];
};

function getWeekStartForOffset(offset: number): string {
  // Use LOCAL timezone throughout — format with getFullYear/getMonth/getDate
  // so we never convert to UTC (toISOString does that and shifts the date for
  // UTC+ timezones). On Sunday (d=0) advance to the coming Monday so the
  // tracker already shows next week by end of the weekend.
  const today = new Date();
  const d = today.getDay(); // 0=Sun … 6=Sat (local)
  const diff = d === 0 ? 1 : 1 - d; // Sun→+1 (next Mon), Mon→0, Tue→-1 …
  const mon = new Date(today);
  mon.setDate(today.getDate() + diff + offset * 7);
  const y = mon.getFullYear();
  const m = String(mon.getMonth() + 1).padStart(2, "0");
  const day = String(mon.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function RollSubmissionChecklist() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [weekOffset, setWeekOffset] = useState(0);
  const [saving, setSaving] = useState<number | null>(null);

  const weekStart = getWeekStartForOffset(weekOffset);
  const isCurrentWeek = weekOffset === 0;

  const { data, isLoading } = useQuery<WeekData>({
    queryKey: ["/api/roll-submissions", weekStart],
    queryFn: async () => {
      const res = await fetch(`/api/roll-submissions?weekStart=${weekStart}`);
      if (!res.ok) throw new Error("Failed to load roll submissions");
      return res.json();
    },
  });

  const monday = new Date(weekStart + "T00:00:00");
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const sites = data?.sites ?? [];
  const compliant = sites.filter((s) => s.submitted && s.accurate).length;
  const errors = sites.filter((s) => s.submitted && !s.accurate).length;
  const pending = sites.filter((s) => !s.submitted).length;

  async function setStatus(siteId: number, status: "compliant" | "error" | "pending") {
    setSaving(siteId);
    try {
      const body =
        status === "compliant" ? { submitted: true, accurate: true } :
        status === "error"     ? { submitted: true, accurate: false } :
                                 { submitted: false, accurate: false };
      const r = await fetch(`/api/roll-submissions/${weekStart}/${siteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed to save");
      await queryClient.invalidateQueries({ queryKey: ["/api/roll-submissions", weekStart] });
    } catch {
      toast({ title: "Failed to save roll submission", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            Roll Submission Tracker
          </CardTitle>

          {/* Week navigator */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="rounded-lg p-1.5 hover:bg-accent transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium px-2 text-center min-w-[180px]">
              {format(monday, "d MMM")}–{format(friday, "dd/MM/yyyy")}
              {isCurrentWeek && (
                <Badge variant="outline" className="ml-2 text-[10px] text-primary border-primary/30 py-0 align-middle">
                  This week
                </Badge>
              )}
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              disabled={weekOffset >= 0}
              className="rounded-lg p-1.5 hover:bg-accent disabled:opacity-30 disabled:cursor-default transition-colors"
              title="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="divide-y rounded-lg border overflow-hidden">
              {sites.map((site) => {
                const isCompliant = site.submitted && site.accurate;
                const isError = site.submitted && !site.accurate;
                const isSaving = saving === site.siteId;

                return (
                  <div key={site.siteId} className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-accent/30 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        isCompliant ? "bg-emerald-500" :
                        isError     ? "bg-red-500" :
                                      "bg-muted-foreground/30"
                      }`} />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{site.siteName}</span>
                        {site.updatedBy && (
                          <span className="text-[11px] text-muted-foreground">
                            Updated by {site.updatedBy}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Compliant button */}
                      <button
                        onClick={() => setStatus(site.siteId, isCompliant ? "pending" : "compliant")}
                        disabled={isSaving}
                        title={isCompliant ? "Click to clear" : "Mark compliant"}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                          isCompliant
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                            : "bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700"
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Compliant
                      </button>

                      {/* Error button */}
                      <button
                        onClick={() => setStatus(site.siteId, isError ? "pending" : "error")}
                        disabled={isSaving}
                        title={isError ? "Click to clear" : "Mark as error"}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                          isError
                            ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                            : "bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-700"
                        }`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Error
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary footer */}
            {sites.length > 0 && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  {compliant} compliant
                </span>
                {errors > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    {errors} error{errors !== 1 ? "s" : ""}
                  </span>
                )}
                {pending > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
                    {pending} pending
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Activity type badge ──────────────────────────────────────────────────────
const ACTIVITY_CONFIG: Record<string, { label: string; className: string }> = {
  observation: { label: "Observation", className: "bg-blue-100 text-blue-700 border-blue-200" },
  post:        { label: "Post",        className: "bg-green-100 text-green-700 border-green-200" },
  incident:    { label: "Incident",    className: "bg-red-100 text-red-700 border-red-200" },
  condition_report: { label: "Condition", className: "bg-orange-100 text-orange-700 border-orange-200" },
};
function ActivityTypeBadge({ type }: { type: string }) {
  const cfg = ACTIVITY_CONFIG[type] ?? { label: type, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Leadership ───────────────────────────────────────────────────────────────
// ─── Quick-renew dialog ───────────────────────────────────────────────────────
function QuickRenewDialog({
  childId, slot, medName, onClose,
}: { childId: number; slot: number; medName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: medications, isLoading } = useListChildMedications(childId);
  const upsertMed = useUpsertChildMedication();

  const currentMed = medications?.find((m) => m.slot === slot);
  const [expiryDate, setExpiryDate] = useState(currentMed?.expiryDate ?? "");

  // Sync once the medication data arrives
  useEffect(() => {
    if (currentMed?.expiryDate) setExpiryDate(currentMed.expiryDate);
  }, [currentMed?.expiryDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!expiryDate) return;
    const base = currentMed;
    upsertMed.mutate(
      {
        id: childId,
        slot,
        data: {
          name: base?.name ?? medName,
          expiryDate,
          lastAdministered: base?.lastAdministered ?? null,
          toBeAdministeredBy: base?.toBeAdministeredBy ?? null,
          frequency: base?.frequency ?? null,
          administrationTime: base?.administrationTime ?? null,
          dosage: base?.dosage ?? null,
          methodOfAdministration: base?.methodOfAdministration ?? null,
        } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/medications/expiring"] });
          queryClient.invalidateQueries({ queryKey: getListChildMedicationsQueryKey(childId) });
          toast({ title: "Expiry date updated" });
          onClose();
        },
        onError: () => toast({ title: "Failed to save", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pill className="h-4 w-4 text-orange-500" />
            Update expiry — {medName}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-4 flex justify-center"><Skeleton className="h-9 w-full" /></div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New expiry date</label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!expiryDate || upsertMed.isPending}
              >
                {upsertMed.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Medication Expiry Widget ────────────────────────────────────────────────
function MedicationExpiryWidget({ siteId }: { siteId?: number }) {
  const params = siteId ? { siteId } : undefined;
  const { data, isLoading } = useGetExpiringMedications(params);
  const [renewTarget, setRenewTarget] = useState<{ childId: number; slot: number; medName: string } | null>(null);

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-orange-400">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="h-4 w-4 text-orange-500" /> Medications needing attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-orange-400">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Pill className="h-4 w-4 text-orange-500" /> Medications needing attention
          </span>
          <Link href="/children?medical=1">
            <span className="text-xs text-primary font-normal cursor-pointer hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((child) => {
            const hasExpired = child.medications.some((m) => m.status === "expired");
            return (
              <div key={child.childId} className={`rounded-md px-3 py-2.5 border ${hasExpired ? "border-red-200 bg-red-50/60" : "border-orange-200 bg-orange-50/60"}`}>
                {/* Child name row — links to the medical tab */}
                <Link href={`/children/${child.childId}?tab=medical`}>
                  <div className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity mb-1.5">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${hasExpired ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                      {child.childFirstName[0]}{child.childLastName[0]}
                    </div>
                    <p className={`text-sm font-medium ${hasExpired ? "text-red-800" : "text-orange-800"}`}>
                      {child.childFirstName} {child.childLastName}
                    </p>
                  </div>
                </Link>
                {/* Per-medication rows with individual inline-renew buttons */}
                <div className="flex flex-col gap-1 pl-9">
                  {child.medications.map((med) => {
                    const expiry = new Date(med.expiryDate + "T00:00:00");
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const daysLeft = differenceInCalendarDays(expiry, today);
                    const label = med.status === "expired"
                      ? `${med.name} — expired ${Math.abs(daysLeft)}d ago`
                      : `${med.name} — expires in ${daysLeft}d`;
                    return (
                      <div key={med.slot} className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${med.status === "expired" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                          {label}
                        </span>
                        <button
                          className="text-xs text-primary hover:underline cursor-pointer whitespace-nowrap font-medium"
                          onClick={() => setRenewTarget({ childId: child.childId, slot: med.slot, medName: med.name })}
                        >
                          Update expiry
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Inline quick-renew dialog */}
      {renewTarget && (
        <QuickRenewDialog
          childId={renewTarget.childId}
          slot={renewTarget.slot}
          medName={renewTarget.medName}
          onClose={() => setRenewTarget(null)}
        />
      )}
    </Card>
  );
}

function LeadershipDashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: outcomes, isLoading: loadingOutcomes } = useGetOutcomeCounts();
  const { data: observations, isLoading: loadingObservations } = useGetRecentObservations();
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity();

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Learning</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard title="Posts (7 days)" value={summary?.postsLast7Days} icon={FileText} loading={loadingSummary} href="/posts" />
          <MetricCard title="Jottings (7 days)" value={summary?.jottingsLast7Days} icon={PenLine} loading={loadingSummary} href="/jottings" />
          <MetricCard title="Observations (7 days)" value={summary?.observationsLast7Days} icon={BookOpen} loading={loadingSummary} href="/observations" />
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Operational</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Staff Compliance"
            value={summary?.totalStaff}
            subtitle={
              summary
                ? summary.staffWithExpiringQuals > 0
                  ? `${summary.staffWithExpiringQuals} qualification expiry notice${summary.staffWithExpiringQuals === 1 ? "" : "s"}`
                  : "No expiry notices"
                : undefined
            }
            icon={Users}
            loading={loadingSummary}
            href="/staff"
          />
          <MetricCard
            title="Weekly Plans"
            label={summary ? `${summary.sitesWithPublishedPlan} / ${summary.totalSites}` : undefined}
            subtitle={summary ? (summary.sitesWithPublishedPlan === summary.totalSites && summary.totalSites > 0 ? "All sites covered this week" : `${summary.totalSites - summary.sitesWithPublishedPlan} site${summary.totalSites - summary.sitesWithPublishedPlan === 1 ? "" : "s"} missing a plan`) : undefined}
            icon={ClipboardList}
            loading={loadingSummary}
            href="/reports/weekly-plans"
          />
          <MetricCard
            title="Open Incidents"
            value={summary?.openIncidents}
            subtitle={summary ? (summary.openIncidents === 0 ? "None open" : `${summary.openIncidents} requiring attention`) : undefined}
            icon={AlertTriangle}
            loading={loadingSummary}
            href="/incidents"
          />
          <MetricCard
            title="Open Condition Reports"
            value={summary?.openConditionReports}
            subtitle={summary ? (summary.openConditionReports === 0 ? "None open" : `${summary.openConditionReports} requiring attention`) : undefined}
            icon={ClipboardCheck}
            loading={loadingSummary}
            href="/condition-reports"
          />
        </div>
      </div>

      <MedicationExpiryWidget />

      <NoticeBoard canManage audience="leadership" />

      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center text-lg">
            <span>Recent Observations</span>
            <Link href="/observations"><span className="text-sm text-primary font-normal cursor-pointer hover:underline">View all</span></Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingObservations ? (
            <div className="space-y-4 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : !observations || observations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No recent observations</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Child</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Observation</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Site</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Submitter</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.slice(0, 10).map((obs) => (
                    <tr key={obs.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top">
                        {format(new Date(obs.observationDate.length === 10 ? obs.observationDate + "T00:00:00" : obs.observationDate), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap align-top">
                        {obs.childName ?? <span className="text-muted-foreground italic">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 align-top max-w-xs">
                        <Link href={`/observations/${obs.id}`}>
                          <span className="line-clamp-2 cursor-pointer hover:text-primary transition-colors leading-snug">
                            {obs.description}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top">
                        {obs.siteName ?? <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top">
                        {obs.staffName ?? <span className="italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RollSubmissionChecklist />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Recent Activity</span>
            <span className="text-xs text-muted-foreground font-normal">Observations · Posts · Incidents · Condition Reports</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingActivity ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !activity || activity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No recent activity</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">When</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Activity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Site</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">By</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top text-xs">
                        {format(new Date(item.timestamp), "d MMM, h:mm a")}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <ActivityTypeBadge type={item.type} />
                      </td>
                      <td className="px-4 py-3 align-top max-w-sm">
                        {item.href ? (
                          <Link href={item.href}>
                            <span className="font-medium cursor-pointer hover:text-primary transition-colors block leading-snug">{item.label}</span>
                          </Link>
                        ) : (
                          <span className="font-medium block leading-snug">{item.label}</span>
                        )}
                        {item.detail && (
                          <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.detail}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top text-xs">
                        {item.siteName ?? <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap align-top text-xs">
                        {item.actor ?? <span className="italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
const CHECKLIST_FREQ_ORDER = ["weekly", "monthly", "term", "annual"] as const;
type ChecklistFreq = typeof CHECKLIST_FREQ_ORDER[number];

const CHECKLIST_FREQ_LABELS: Record<ChecklistFreq, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  term: "Term",
  annual: "Yearly",
};

const CHECKLIST_FREQ_COLORS: Record<ChecklistFreq, string> = {
  weekly: "bg-blue-100 text-blue-800",
  monthly: "bg-purple-100 text-purple-800",
  term: "bg-amber-100 text-amber-800",
  annual: "bg-rose-100 text-rose-800",
};

function EducatorDashboard({ selectedSiteId }: { selectedSiteId: string }) {
  const numericSiteId = selectedSiteId ? Number(selectedSiteId) : null;
  const siteParam = numericSiteId ? { siteId: numericSiteId } : undefined;

  const { data: service, isLoading: loadingService } = useGetServiceComplianceReport(siteParam);
  const { data: learning, isLoading: loadingLearning } = useGetLearningStoriesReport(siteParam);
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: routines, isLoading: loadingRoutines } = useListChecklistRoutines();
  const { data: children } = useListChildren();

  const evacOk = service?.evacuationStatus?.lastConducted && !service?.evacuationStatus?.isOverdue;

  // Build a set of child IDs at the selected site for fast lookup
  const siteChildIds = numericSiteId
    ? new Set((children ?? []).filter((c) => c.siteId === numericSiteId).map((c) => c.id))
    : null;

  const childrenWithNoObs = (learning?.byChild ?? []).filter(
    (c) => c.observationCount === 0 && (siteChildIds === null || siteChildIds.has(c.childId))
  );

  const today = format(new Date(), "yyyy-MM-dd");

  // Only show routines that are repeating or upcoming, filtered to the selected site
  const activeRoutines = (routines ?? []).filter(
    (r) =>
      (numericSiteId === null || r.siteId === numericSiteId) &&
      (r.isRepeating || (r.targetDate && String(r.targetDate).slice(0, 10) >= today))
  );

  // Group by the four frequencies we show
  const routinesByFreq: Record<ChecklistFreq, typeof activeRoutines> = {
    weekly:  activeRoutines.filter((r) => r.frequency === "weekly"),
    monthly: activeRoutines.filter((r) => r.frequency === "monthly"),
    term:    activeRoutines.filter((r) => r.frequency === "term"),
    annual:  activeRoutines.filter((r) => r.frequency === "annual"),
  };

  return (
    <div className="space-y-8">
      <NoticeBoard canManage audience="educator" siteId={selectedSiteId || undefined} />

      {/* Row 1: Service Compliance + Checklists */}
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
                  value={service?.evacuationStatus?.lastConducted ? format(parseISO(service.evacuationStatus.lastConducted), "dd/MM/yyyy") : "Never conducted"}
                  isText
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklists */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /> Checklists</span>
              <Link href="/checklists"><span className="text-xs text-primary font-normal cursor-pointer hover:underline flex items-center gap-0.5">View all <ChevronRight className="h-3 w-3" /></span></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRoutines ? (
              <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
            ) : (
              <div className="space-y-3">
                {CHECKLIST_FREQ_ORDER.map((freq) => {
                  const items = [...(routinesByFreq[freq] ?? [])].sort((a, b) =>
                    String(a.targetDate).localeCompare(String(b.targetDate))
                  );
                  const label = CHECKLIST_FREQ_LABELS[freq];
                  const colorClass = CHECKLIST_FREQ_COLORS[freq];
                  // Primary = soonest upcoming (or last one if all past)
                  const primary = items.find((r) => String(r.targetDate).slice(0, 10) >= today) ?? items[items.length - 1];
                  const extras = items.length > 1 ? items.length - 1 : 0;

                  if (!primary) {
                    return (
                      <div key={freq} className="rounded-md border px-3 py-2.5 flex items-center gap-2">
                        <Badge className={`${colorClass} border-none text-xs shrink-0`}>{label}</Badge>
                        <p className="text-sm text-muted-foreground italic">None scheduled</p>
                      </div>
                    );
                  }

                  return (
                    <Link key={freq} href={`/checklists?open=${primary.id}`}>
                      <div className="rounded-md border px-3 py-2.5 flex items-start justify-between gap-2 hover:bg-muted/40 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className={`${colorClass} border-none text-xs shrink-0`}>{label}</Badge>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{primary.title}</p>
                            <p className="text-xs text-muted-foreground">Due {format(parseISO(String(primary.targetDate)), "dd/MM/yyyy")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          {extras > 0 && (
                            <span className="text-xs text-muted-foreground">+{extras} more</span>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
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

      {/* Row 2: MTOP Outcomes + Children with no observations */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* MTOP Outcomes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> MTOP Outcomes</span>
              <Link href="/reports/learning"><span className="text-xs text-primary font-normal cursor-pointer hover:underline flex items-center gap-0.5">Full report <ChevronRight className="h-3 w-3" /></span></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingLearning || loadingSummary ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2.5">
                  <span className="text-sm font-medium">Observations (last 7 days)</span>
                  <span className="text-lg font-bold text-primary">{summary?.observationsLast7Days ?? 0}</span>
                </div>
                <OutcomePieChart outcomes={learning?.byOutcome ?? []} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Children with no observations — right column only */}
        {childrenWithNoObs.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 self-start">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Children with no observations this month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {childrenWithNoObs.map((c) => (
                  <Link key={c.childId} href={`/children/${c.childId}`}>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 cursor-pointer hover:bg-amber-200">{c.childName}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <MedicationExpiryWidget siteId={numericSiteId ?? undefined} />

      {/* Groceries button */}
      <a
        href="https://forms.gle/cDKqSt4pd7Xfvpww7"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-3 w-full rounded-xl border-2 border-green-300 bg-green-50 hover:bg-green-100 text-green-800 font-semibold text-lg transition-colors"
        style={{ minHeight: "6rem" }}
      >
        <ShoppingCart className="h-6 w-6" />
        Groceries
      </a>
    </div>
  );
}

// ─── Guardian ────────────────────────────────────────────────────────────────
function GuardianDashboard({ siteFilter = "__all__" }: { siteFilter?: string }) {
  const { data: posts, isLoading: loadingPosts } = useListPosts();
  const { data: planning, isLoading: loadingPlanning } = useListPlanningExperiences();
  const { data: sites } = useListSites();

  const visibleSites = (sites ?? []).filter(
    (s) => siteFilter === "__all__" || String(s.id) === siteFilter
  );

  const thisMonday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const fiveWeeksEnd = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 34), "yyyy-MM-dd");

  const publishedPlans = (planning ?? [])
    .filter((p) =>
      p.stage === "published" &&
      p.startDate && p.startDate >= thisMonday && p.startDate <= fiveWeeksEnd &&
      (siteFilter === "__all__" || String(p.siteId) === siteFilter)
    )
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
    .slice(0, 5);

  const filteredPosts = [...(posts ?? [])]
    .filter((p) => siteFilter === "__all__" || String(p.siteId) === siteFilter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Quick-access public links */}
      <div className="flex justify-end gap-2 flex-wrap">
        {visibleSites.map((site) => (
          <a
            key={`docs-${site.id}`}
            href={`/service-docs?siteId=${site.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
          >
            <FileText className="h-4 w-4 text-primary shrink-0" />
            Service Documentation
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </a>
        ))}
        {visibleSites.map((site) => (
          <a
            key={`qip-${site.id}`}
            href={`/qip-public?siteId=${site.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:shadow-md transition-shadow"
          >
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            {site.name} QIP
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>

      <NoticeBoard canManage audience="guardian" siteId={siteFilter !== "__all__" ? siteFilter : undefined} />

      {/* Published weekly plans */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Weekly Learning Programs</span>
            <Link href="/calendar?mode=guardian"><span className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-0.5">View calendar <ChevronRight className="h-3 w-3" /></span></Link>
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
                        {plan.startDate && <p className="text-xs text-muted-foreground">Week of {format(parseISO(plan.startDate), "dd/MM/yyyy")}</p>}
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
        ) : filteredPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Newspaper className="h-10 w-10 mb-2 opacity-40" />
              <p className="font-medium">No posts yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPosts.map((post) => {
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
                          {post.date && <span>{format(new Date(post.date.slice(0, 10) + "T00:00:00"), "dd/MM/yyyy")}</span>}
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

function MetricCard({ title, value, label, subtitle, icon: Icon, loading, href }: { title: string; value?: number | string; label?: string; subtitle?: string; icon: any; loading: boolean; href?: string }) {
  const content = (
    <Card className={href ? "hover:border-primary/50 transition-colors cursor-pointer" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <div className="text-3xl font-bold">
              {label ?? value ?? 0}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
