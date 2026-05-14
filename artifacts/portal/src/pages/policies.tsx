import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, FolderOpen, ChevronRight, ShieldCheck, BookOpen } from "lucide-react";

export default function PoliciesFiles() {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Policies & Files</h1>
        <p className="text-muted-foreground mt-1">Manage service policies with staff acknowledgements and your shared file library.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
          onClick={() => navigate("/policies/list")}
        >
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Policies</h2>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Numbered service policies with HTML content or PDF upload. Track staff acknowledgements per version and notify by role when updates are made.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
          onClick={() => navigate("/policies/files")}
        >
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
              <FolderOpen className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">File Library</h2>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                A shared library of documents and files organised under custom category headings. Categories can be managed in settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
