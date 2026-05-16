import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

type Post = {
  id: number;
  title: string;
  content: string | null;
  imagePath: string | null;
  publishedAt: string | null;
  createdAt: string;
};

function imageUrl(path: string) {
  const stripped = path.replace(/^\/objects\//, "");
  return `/api/storage/objects/${stripped}`;
}

export default function GuardianNotices() {
  const { data: posts, isLoading } = useQuery<Post[]>({
    queryKey: ["/api/posts"],
    queryFn: async () => {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error("Failed to load notices");
      return res.json();
    },
  });

  const published = (posts ?? [])
    .filter((p) => p.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notices & News</h1>
        <p className="text-muted-foreground text-sm mt-1">Updates and news from your education and care service.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : published.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No notices published yet.</p>
            <p className="text-xs mt-1">Check back soon for updates from your service.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {published.map((post) => (
            <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {post.imagePath && (
                <div className="aspect-[4/1] overflow-hidden bg-muted">
                  <img
                    src={imageUrl(post.imagePath)}
                    alt={post.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  {!post.imagePath && (
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Newspaper className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base mb-1">{post.title}</h3>
                    {post.publishedAt && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {format(new Date(post.publishedAt), "d MMMM yyyy")}
                      </p>
                    )}
                    {post.content && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                        {post.content}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
