import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { FolderOpen, ChevronRight, ShieldCheck, ClipboardList, FileText, ExternalLink } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

const TILES = [
  {
    href: "/policies/list",
    icon: ShieldCheck,
    title: "Policies",
    description:
      "Numbered service policies with HTML content or PDF upload. Track staff acknowledgements per version and notify by role when updates are made.",
  },
  {
    href: "/policies/procedures",
    icon: ClipboardList,
    title: "Procedures",
    description:
      "Step-by-step operational procedures linked to your service policies. Upload documents or write content directly, with staff acknowledgement tracking.",
  },
  {
    href: "/policies/files",
    icon: FolderOpen,
    title: "File Library",
    description:
      "A shared library of documents and files organised under custom category headings. Categories can be managed in settings.",
  },
  {
    href: "/policies/service-docs",
    icon: FileText,
    title: "Service Documentation",
    description: "",
  },
];

export default function PoliciesFiles() {
  const [, navigate] = useLocation();
  const { isEducatorRole } = usePermissions();
  const tiles = isEducatorRole
    ? TILES.filter((t) => t.title !== "Service Documentation")
    : TILES;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Policies & Files</h1>
        <p className="text-muted-foreground mt-1">
          Manage service policies and procedures with staff acknowledgements, and your shared file library.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map(({ href, icon: Icon, title, description, external }) => (
          <Card
            key={href}
            className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all group"
            onClick={() => external ? window.open(href, "_blank") : navigate(href)}
          >
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{title}</h2>
                  {external
                    ? <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    : <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
