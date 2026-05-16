import { useEffect, useState } from "react";
import { FileText, File, ShieldCheck, ChevronDown, Download } from "lucide-react";

type DocItem = {
  id: number;
  name: string;
  documentPath: string;
  documentName: string;
  position: number;
  createdAt: string;
};

type Section = {
  category: string;
  items: DocItem[];
};

type SiteOption = { id: number; name: string };

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(name: string): boolean {
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(fileExt(name));
}

function isPdf(name: string): boolean {
  return fileExt(name) === "pdf";
}

function DocViewer({ item }: { item: DocItem }) {
  const href = `/api/storage/objects${item.documentPath}`;
  const img = isImage(item.documentName);
  const pdf = isPdf(item.documentName);

  if (pdf) {
    return (
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <iframe
          src={`${href}#toolbar=0&navpanes=0`}
          className="w-full"
          style={{ height: "680px", border: "none", display: "block" }}
          title={item.name}
        />
        <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-end">
          <a
            href={href}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download PDF
          </a>
        </div>
      </div>
    );
  }

  if (img) {
    return (
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <img src={href} alt={item.name} className="w-full object-contain max-h-[600px]" />
        <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-end">
          <a
            href={href}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 px-5 py-5">
        <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-muted shrink-0">
          <File className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground truncate">{item.documentName}</p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
      </div>
    </div>
  );
}

export default function ServiceDocsPublic() {
  const params = new URLSearchParams(window.location.search);
  const initialSiteId = params.get("siteId");

  const [sections, setSections] = useState<Section[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [activeSiteId, setActiveSiteId] = useState<string>(initialSiteId ?? "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = activeSiteId ? `/api/service-docs/public?siteId=${activeSiteId}` : `/api/service-docs/public`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setSections(data.sections ?? []);
        setSites(data.sites ?? []);
        setSiteName(data.siteName ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeSiteId]);

  const nonEmpty = sections.filter((s) => s.items.length > 0);
  const showSiteFilter = sites.length > 1 || (sites.length === 1 && !activeSiteId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/educare-logo-dark.png" alt="EduCare" className="h-8 w-8 object-contain" />
            <span className="text-base font-bold text-foreground tracking-tight">EduCare</span>
          </div>
          <div className="w-px h-6 bg-border shrink-0" />
          <div className="min-w-0 flex items-center gap-2 flex-1">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground leading-tight">Service Documentation</h1>
              <p className="text-xs text-muted-foreground truncate">
                {siteName ?? "Publicly available documents from our service"}
              </p>
            </div>
          </div>
          {showSiteFilter && (
            <div className="relative shrink-0">
              <select
                value={activeSiteId}
                onChange={(e) => setActiveSiteId(e.target.value)}
                className="appearance-none rounded-lg border bg-white pl-3 pr-8 py-1.5 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="">All sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">Loading…</div>
        )}

        {!loading && nonEmpty.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-30" />
            <p className="text-sm">No documents have been published yet.</p>
          </div>
        )}

        {nonEmpty.map((section) => (
          <section key={section.category}>
            <h2 className="text-base font-semibold text-foreground uppercase tracking-wide mb-4">{section.category}</h2>
            <div className="space-y-4">
              {section.items.map((item) => <DocViewer key={item.id} item={item} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
