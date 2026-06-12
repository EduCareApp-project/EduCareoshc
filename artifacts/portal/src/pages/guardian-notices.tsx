import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListSites } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Bell, FileText, Paperclip, Building2 } from "lucide-react";
import { format } from "date-fns";
import { RichTextView } from "@/components/rich-text-editor";

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-slate-100 text-slate-800",
  normal: "bg-blue-100 text-blue-800",
  high:   "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

const PRIORITY_BORDER: Record<string, string> = {
  low:    "border-l-slate-400",
  normal: "border-l-blue-400",
  high:   "border-l-amber-400",
  urgent: "border-l-red-500",
};

type Notice = {
  id: number;
  title: string;
  content: string;
  priority: string;
  siteId: number | null;
  createdAt: string;
  expiresAt?: string | null;
  documentPaths?: string[] | null;
  documentNames?: string[] | null;
};

type Post = {
  id: number;
  title: string;
  description: string | null;
  images: string[];
  publishedAt: string | null;
  createdAt: string;
};

type Child = {
  id: number;
  siteId: number | null;
};

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

function docUrl(path: string) {
  const stripped = path.replace(/^\/?(objects\/)?/, "");
  return `/api/storage/objects/${stripped}`;
}

export default function GuardianNotices() {
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  const { data: notices, isLoading: noticesLoading } = useQuery<Notice[]>({
    queryKey: ["/api/auth/my-notices"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-notices");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: posts, isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ["/api/auth/my-posts"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-posts");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: children } = useQuery<Child[]>({
    queryKey: ["/api/auth/my-children"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-children");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: sites } = useListSites();

  const childSiteIds = [
    ...new Set((children ?? []).map((c) => c.siteId).filter((id): id is number => id != null)),
  ];

  useEffect(() => {
    if (selectedSiteId != null) return;
    if (childSiteIds.length > 0) setSelectedSiteId(childSiteIds[0]);
  }, [childSiteIds.join(",")]);

  const now = new Date();

  const filteredNotices = (notices ?? [])
    .filter((n) => !n.expiresAt || new Date(n.expiresAt) > now)
    .filter((n) => n.siteId == null || selectedSiteId == null || n.siteId === selectedSiteId)
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, normal: 2, low: 3 };
      const pa = order[a.priority as keyof typeof order] ?? 2;
      const pb = order[b.priority as keyof typeof order] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const published = (posts ?? [])
    .filter((p) => p.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

  const showSiteTabs = childSiteIds.length > 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notice Board</h1>
        <p className="text-muted-foreground text-sm mt-1">Updates and news from your education and care service.</p>
      </div>

      {/* Site tabs */}
      {showSiteTabs && (
        <div className="flex gap-2 flex-wrap">
          {childSiteIds.map((siteId) => {
            const site = (sites ?? []).find((s) => s.id === siteId);
            const siteName = site?.name ?? `Site ${siteId}`;
            const isActive = selectedSiteId === siteId;
            return (
              <button
                key={siteId}
                onClick={() => setSelectedSiteId(siteId)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                {siteName}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Notices ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          Notices
          {filteredNotices.length > 0 && (
            <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">{filteredNotices.length}</span>
          )}
        </h2>

        {noticesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : filteredNotices.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notices at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNotices.map((notice) => (
              <Card
                key={notice.id}
                className={`overflow-hidden border-l-4 cursor-pointer hover:shadow-md transition-shadow ${PRIORITY_BORDER[notice.priority] ?? PRIORITY_BORDER.normal}`}
                onClick={() => setSelectedNotice(notice)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-sm leading-snug">{notice.title}</h3>
                    <Badge className={`${PRIORITY_COLORS[notice.priority] ?? PRIORITY_COLORS.normal} shrink-0 capitalize text-xs border-none`}>
                      {notice.priority}
                    </Badge>
                  </div>
                  <RichTextView html={notice.content} className="text-sm text-muted-foreground line-clamp-3" />
                  {notice.documentPaths && notice.documentPaths.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span>
                        {notice.documentPaths.length === 1
                          ? notice.documentNames?.[0] ?? "1 attachment"
                          : `${notice.documentPaths.length} attachments`}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-2">
                    {format(new Date(notice.createdAt), "dd/MM/yyyy")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Posts / News ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-muted-foreground" /> News & Updates
        </h2>

        {postsLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : published.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No news posts yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {published.map((post) => (
              <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                {post.images && post.images.length > 0 && (
                  <div className="aspect-[4/1] overflow-hidden bg-muted">
                    <img
                      src={imageUrl(post.images[0])}
                      alt={post.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    {(!post.images || post.images.length === 0) && (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Newspaper className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1">{post.title}</h3>
                      {post.publishedAt && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {format(new Date(post.publishedAt), "dd/MM/yyyy")}
                        </p>
                      )}
                      {post.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                          {post.description.replace(/<[^>]*>/g, "").trim()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Notice detail dialog ── */}
      <Dialog open={!!selectedNotice} onOpenChange={(open) => { if (!open) setSelectedNotice(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`${PRIORITY_COLORS[selectedNotice?.priority ?? "normal"]} border-none capitalize`}>
                {selectedNotice?.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedNotice && format(new Date(selectedNotice.createdAt), "dd/MM/yyyy 'at' h:mm a")}
              </span>
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
                  return (
                    <a
                      key={idx}
                      href={docUrl(path)}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
