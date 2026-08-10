import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListSites } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Bell, FileText, Paperclip, Building2 } from "lucide-react";
import { format } from "date-fns";
import { fmtMelb } from "@/lib/timezone";
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
  // siteIdOverride is only set when the user explicitly clicks a tab.
  // Until then, effectiveSiteId falls back to the guardian's first child's site.
  const [siteIdOverride, setSiteIdOverride] = useState<number | null>(null);

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

  // Computed: user's explicit choice, else first child's site, else null (no children yet)
  const effectiveSiteId: number | null = siteIdOverride ?? childSiteIds[0] ?? null;

  const now = new Date();

  const filteredNotices = (notices ?? [])
    .filter((n) => !n.expiresAt || new Date(n.expiresAt) > now)
    .filter((n) => {
      if (effectiveSiteId == null) return true; // children not loaded yet — show all
      return n.siteId == null || n.siteId === effectiveSiteId;
    })
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

      {/* Site tabs — only shown when guardian has children at multiple sites */}
      {showSiteTabs && (
        <div className="flex gap-2 flex-wrap">
          {childSiteIds.map((siteId) => {
            const site = (sites ?? []).find((s) => s.id === siteId);
            const siteName = site?.name ?? `Site ${siteId}`;
            const isActive = effectiveSiteId === siteId;
            return (
              <button
                key={siteId}
                onClick={() => setSiteIdOverride(siteId)}
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
          <div className="flex gap-4 overflow-x-auto pb-2">
            <Skeleton className="h-36 w-64 shrink-0 rounded-lg" />
            <Skeleton className="h-36 w-64 shrink-0 rounded-lg" />
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No active notices</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {filteredNotices.map((notice) => (
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
                  </div>
                  <h4 className="font-semibold text-sm text-white">{notice.title}</h4>
                  <RichTextView html={notice.content} className="text-white/85 line-clamp-3" />
                  {notice.documentPaths && notice.documentPaths.length > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-white/80">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span>
                        {notice.documentPaths.length === 1
                          ? notice.documentNames?.[0] ?? "1 attachment"
                          : `${notice.documentPaths.length} attachments`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-2 border-t border-white/25 flex items-center justify-between gap-2">
                  <span className="text-xs text-white/60">{fmtMelb(notice.createdAt, "MMM d, h:mm a")}</span>
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
                          {fmtMelb(post.publishedAt, "dd/MM/yyyy")}
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
                {selectedNotice && fmtMelb(selectedNotice.createdAt, "dd/MM/yyyy 'at' h:mm a")}
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
