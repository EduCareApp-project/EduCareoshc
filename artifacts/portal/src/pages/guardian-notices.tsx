import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Bell, FileText, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { RichTextView } from "@/components/rich-text-editor";

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-slate-100 text-slate-800",
  normal: "bg-blue-100 text-blue-800",
  high:   "bg-amber-100 text-amber-800",
  urgent: "bg-red-100 text-red-800",
};

type Notice = {
  id: number;
  title: string;
  content: string;
  priority: string;
  createdAt: string;
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

  const sortedNotices = (notices ?? []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const published = (posts ?? [])
    .filter((p) => p.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notices & News</h1>
        <p className="text-muted-foreground text-sm mt-1">Updates and news from your education and care service.</p>
      </div>

      {/* ── Notices ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" /> Notices
        </h2>

        {noticesLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            <Skeleton className="h-40 w-64 shrink-0 rounded-lg" />
            <Skeleton className="h-40 w-64 shrink-0 rounded-lg" />
          </div>
        ) : sortedNotices.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No notices at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {sortedNotices.map((notice) => (
              <div
                key={notice.id}
                className="min-w-[280px] max-w-[320px] p-4 rounded-lg border shrink-0 snap-start flex flex-col justify-between text-white cursor-pointer hover:brightness-95 transition-all"
                style={{ backgroundColor: "#29BCD4", borderColor: "#1fa8be" }}
                onClick={() => setSelectedNotice(notice)}
              >
                <div className="space-y-1.5">
                  <Badge className={`${PRIORITY_COLORS[notice.priority] ?? PRIORITY_COLORS.normal} border-none capitalize`}>
                    {notice.priority}
                  </Badge>
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
                <div className="text-xs text-white/60 mt-4 pt-2 border-t border-white/25">
                  {format(new Date(notice.createdAt), "MMM d, h:mm a")}
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
