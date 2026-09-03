import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, File, FileText, Loader2 } from "lucide-react";

type DocItem = {
  id: number;
  name: string;
  documentName: string | null;
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

function PdfThumbnail({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).href;

        const pdf = await pdfjsLib.getDocument({ url, withCredentials: true }).promise;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const containerWidth = canvas.parentElement?.clientWidth ?? 400;
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: containerWidth / baseViewport.width });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext("2d");
        if (!context) return;
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground">
        <FileText className="h-10 w-10 opacity-40" />
        <span className="text-xs">Preview unavailable</span>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white">
      {loading && (
        <div className="absolute inset-0 flex aspect-[3/4] items-center justify-center bg-muted/20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`block h-auto w-full transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
      />
    </div>
  );
}

function DocumentationCard({ item }: { item: DocItem }) {
  const documentName = item.documentName ?? item.name;
  const href = `/api/service-docs/public/file/${item.id}`;
  const [imageError, setImageError] = useState(false);

  return (
    <div className="group overflow-hidden rounded-xl border bg-white shadow-sm">
      {isPdf(documentName) ? (
        <PdfThumbnail url={href} />
      ) : isImage(documentName) && !imageError ? (
        <div className="flex min-h-40 w-full items-center justify-center overflow-hidden bg-white">
          <img
            src={href}
            alt={item.name}
            className="h-auto max-h-72 w-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground">
          <File className="h-10 w-10 opacity-40" />
          <span className="text-xs font-medium uppercase">{fileExt(documentName) || "FILE"}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2">
        <span className="min-w-0 truncate text-xs font-medium" title={item.name}>
          {item.name}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </a>
          <a
            href={href}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

export function ServiceDocumentationPanel({ siteId }: { siteId: number }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/service-docs/public?siteId=${siteId}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load service documentation");
        return response.json();
      })
      .then((data: { sections?: Section[] }) => {
        if (!cancelled) setSections(data.sections ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading service documentation…</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-destructive">
        Service documentation could not be loaded. Please try again.
      </div>
    );
  }

  const nonEmptySections = sections.filter((section) => section.items.length > 0);
  if (nonEmptySections.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No service documentation has been published for this site.</p>;
  }

  return (
    <div className="space-y-8">
      {nonEmptySections.map((section) => (
        <section key={section.category}>
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-foreground">{section.category}</h4>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <DocumentationCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}