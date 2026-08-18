import { useEffect, useRef, useState } from "react";
import { FileText, File, ShieldCheck, Download, Loader2, ExternalLink } from "lucide-react";
import QRCode from "react-qr-code";

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
          import.meta.url
        ).href;

        const pdf = await pdfjsLib.getDocument({ url, withCredentials: true }).promise;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const containerWidth = canvas.parentElement?.clientWidth ?? 400;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    }
    render();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-muted/30 text-muted-foreground gap-2">
        <FileText className="h-12 w-12 opacity-40" />
        <span className="text-xs">Preview unavailable</span>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20 aspect-[3/4]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-auto block transition-opacity duration-300 ${loading ? "opacity-0" : "opacity-100"}`}
      />
    </div>
  );
}

function DocCard({ item }: { item: DocItem }) {
  const href = `/api/service-docs/public/file/${item.id}`;
  const img = isImage(item.documentName);
  const pdf = isPdf(item.documentName);
  const [imgError, setImgError] = useState(false);

  const preview = (
    <div className="w-full overflow-hidden bg-white">
      {pdf ? (
        <PdfThumbnail url={href} />
      ) : img && !imgError ? (
        <img
          src={href}
          alt={item.name}
          className="w-full h-auto object-contain"
          onError={() => setImgError(true)}
        />
      ) : img && imgError ? (
        <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-muted/30 text-muted-foreground gap-2">
          <FileText className="h-12 w-12 opacity-40" />
          <span className="text-xs">Preview unavailable</span>
        </div>
      ) : (
        <div className="w-full aspect-[3/4] flex flex-col items-center justify-center bg-muted/30 text-muted-foreground gap-2">
          <File className="h-12 w-12 opacity-40" />
          <span className="text-xs font-medium uppercase">{fileExt(item.documentName) || "FILE"}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm group">
      {preview}
      <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-end gap-3">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Download"
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
  const siteId = params.get("siteId");

  const [sections, setSections] = useState<Section[]>([]);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = siteId
      ? `/api/service-docs/public?siteId=${siteId}`
      : `/api/service-docs/public`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setSections(data.sections ?? []);
        setSiteName(data.siteName ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  const nonEmpty = sections.filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
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
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* QR Code — links back to this page for print/display use */}
        <div className="flex items-start gap-6 bg-white border rounded-xl p-5 shadow-sm">
          <div className="shrink-0 bg-white p-2 border rounded-lg">
            <QRCode
              value={window.location.href}
              size={96}
              bgColor="#ffffff"
              fgColor="#111827"
              level="M"
            />
          </div>
          <div className="min-w-0 pt-1">
            <p className="text-sm font-semibold text-foreground">Scan to access online</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Scan this QR code with any mobile device to view the latest versions of all published service documents.
            </p>
            <p className="text-xs text-muted-foreground mt-2 font-mono break-all opacity-70">
              {window.location.href}
            </p>
          </div>
        </div>

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
            <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
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
