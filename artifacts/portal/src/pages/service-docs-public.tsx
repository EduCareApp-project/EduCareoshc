import { useEffect, useState } from "react";
import { FileText, FileImage, File, ShieldCheck } from "lucide-react";

type DocItem = {
  id: number;
  name: string;
  documentPath: string;
  documentName: string;
  createdAt: string;
};

type Section = {
  category: string;
  items: DocItem[];
};

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(name: string): boolean {
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(fileExt(name));
}

function isPdf(name: string): boolean {
  return fileExt(name) === "pdf";
}

function DocCard({ item }: { item: DocItem }) {
  const img = isImage(item.documentName);
  const pdf = isPdf(item.documentName);
  const href = `/api/storage/objects${item.documentPath}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border bg-white overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Thumbnail area */}
      <div className="flex items-center justify-center bg-muted/40 h-40 overflow-hidden border-b">
        {img ? (
          <img
            src={href}
            alt={item.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : pdf ? (
          <div className="flex flex-col items-center gap-2 text-red-500">
            <FileText className="h-14 w-14" />
            <span className="text-xs font-semibold uppercase tracking-wide">PDF</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <File className="h-14 w-14" />
            <span className="text-xs font-semibold uppercase tracking-wide">{fileExt(item.documentName) || "FILE"}</span>
          </div>
        )}
      </div>

      {/* File name */}
      <div className="px-3 py-3">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.documentName}</p>
      </div>
    </a>
  );
}

export default function ServiceDocsPublic() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/service-docs/public")
      .then((r) => r.json())
      .then((data) => {
        setSections(data.sections ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const nonEmpty = sections.filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/educare-logo.png" alt="EduCare" className="h-8 w-8 object-contain" />
            <span className="text-base font-bold text-foreground tracking-tight">EduCare</span>
          </div>
          <div className="w-px h-6 bg-border shrink-0" />
          <div className="min-w-0 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-tight">Service Documentation</h1>
              <p className="text-xs text-muted-foreground">Publicly available documents from our service</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Loading…
          </div>
        )}

        {!loading && nonEmpty.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-30" />
            <p className="text-sm">No documents have been published yet.</p>
          </div>
        )}

        {nonEmpty.map((section) => (
          <section key={section.category}>
            <h2 className="text-base font-semibold text-foreground uppercase tracking-wide mb-4">
              {section.category}
            </h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {section.items.map((item) => (
                <DocCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
