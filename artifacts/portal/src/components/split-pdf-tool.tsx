import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileText, Loader2, Scissors, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getSplitRanges, type SplitPdfResult } from "@/lib/split-pdf";

type Status = "idle" | "loading" | "ready" | "error";
type Thumb = { url: string } | { error: string } | null;

const THUMB_WIDTH = 150;
const THUMB_HEIGHT = 220;

function errorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "PasswordException") {
    return "This PDF is password-protected or encrypted. Remove the protection first, then upload it again.";
  }
  if (name === "InvalidPDFException" || name === "FormatError") {
    return "This file is not a valid PDF or is damaged.";
  }
  return err instanceof Error && err.message ? err.message : "The PDF could not be read.";
}

function rangeLabel(r: { startPage: number; endPage: number }) {
  return r.startPage === r.endPage ? `Page ${r.startPage}` : `Pages ${r.startPage}-${r.endPage}`;
}

export function SplitPdfTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const bytesRef = useRef<Uint8Array | null>(null);
  const generationRef = useRef(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [splits, setSplits] = useState<number[]>([]);
  const [results, setResults] = useState<SplitPdfResult[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [genError, setGenError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    generationRef.current += 1;
  }, []);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    const created: string[] = [];

    (async () => {
      try {
        const buffer = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;
        bytesRef.current = buffer;
        // The modern build requires newer Map APIs unavailable in some current browsers.
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (cancelled) return;
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).href;
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice() });
        task = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);
        setThumbs(Array.from({ length: pdf.numPages }, () => null));
        setStatus("ready");

        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelled) return;
          let result: Thumb;
          try {
            const page = await pdf.getPage(n);
            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({
              scale: Math.min(THUMB_WIDTH / base.width, THUMB_HEIGHT / base.height),
            });
            const canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("no canvas");
            const renderTask = page.render({ canvasContext: ctx, viewport, canvas });
            try {
              await renderTask.promise;
            } catch (e) {
              renderTask.cancel();
              throw e;
            }
            const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
            if (!blob) throw new Error("no blob");
            const url = URL.createObjectURL(blob);
            if (cancelled) {
              URL.revokeObjectURL(url);
              return;
            }
            created.push(url);
            urlsRef.current.push(url);
            result = { url };
          } catch (err) {
            result = { error: errorMessage(err) };
          }
          if (cancelled) return;
          setThumbs((prev) => {
            const next = prev.slice();
            next[n - 1] = result;
            return next;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      void task?.destroy().catch(() => undefined);
      created.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = urlsRef.current.filter((u) => !created.includes(u));
    };
  }, [file]);

  const reset = useCallback(() => {
    generationRef.current += 1;
    bytesRef.current = null;
    setFile(null);
    setStatus("idle");
    setError("");
    setPageCount(0);
    setThumbs([]);
    setSplits([]);
    setResults(null);
    setGenError("");
    setProgress(0);
    setGenerating(false);
  }, []);

  const choose = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      reset();
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setStatus("error");
        setError("Please choose a PDF file.");
        return;
      }
      setStatus("loading");
      setFile(f);
    },
    [reset],
  );

  const changeSplits = (next: number[]) => {
    setSplits(next.slice().sort((a, b) => a - b));
    setResults(null);
    setGenError("");
  };

  const toggle = (after: number) =>
    changeSplits(splits.includes(after) ? splits.filter((s) => s !== after) : [...splits, after]);

  const ranges = useMemo(() => (pageCount > 0 ? getSplitRanges(pageCount, splits) : []), [pageCount, splits]);

  const generate = async () => {
    if (!file || !bytesRef.current) return;
    const generation = ++generationRef.current;
    setGenerating(true);
    setResults(null);
    setGenError("");
    setProgress(0);
    try {
      const { createSplitPdfs } = await import("@/lib/split-pdf");
      const out = await createSplitPdfs(bytesRef.current.slice(), splits, file.name, (done, total) => {
        if (generationRef.current === generation) {
          setProgress(total > 0 ? Math.round((done / total) * 100) : 0);
        }
      });
      if (generationRef.current === generation) setResults(out);
    } catch (err) {
      if (generationRef.current === generation) {
        setGenError(err instanceof Error && err.message ? err.message : "The PDF could not be split.");
      }
    } finally {
      if (generationRef.current === generation) setGenerating(false);
    }
  };

  const download = (r: SplitPdfResult) => {
    const url = URL.createObjectURL(new Blob([r.bytes.slice()], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = r.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6" data-testid="split-pdf-tool">
      <div>
        <h2 className="text-xl font-semibold">Split PDF</h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Upload one PDF, then click the dotted line between any two pages to split there. Everything happens in your
          browser; your original file is never changed or uploaded.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        disabled={generating}
        className="hidden"
        data-testid="input-split-pdf-file"
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {status === "idle" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-all ${
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
        >
          <div className="h-14 w-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
            <UploadCloud className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold">Drag and drop a PDF here</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-5">One PDF at a time.</p>
          <Button variant="outline" onClick={() => inputRef.current?.click()} data-testid="button-choose-split-pdf">
            Choose PDF
          </Button>
        </div>
      )}

      {status === "loading" && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4 text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading {file?.name}...
        </div>
      )}

      {status === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3" role="alert">
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span data-testid="text-split-error">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Choose another PDF
          </Button>
        </div>
      )}

      {status === "ready" && file && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={file.name}>{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pageCount} {pageCount === 1 ? "page" : "pages"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={generating} onClick={() => inputRef.current?.click()} data-testid="button-replace-split-pdf">
                Replace file
              </Button>
              <Button variant="ghost" size="sm" disabled={generating} onClick={reset} data-testid="button-reset-split-pdf">
                <X className="h-4 w-4 mr-1" /> Reset
              </Button>
            </div>
          </div>

          {pageCount === 1 ? (
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground" data-testid="text-single-page">
              This PDF has only one page, so there is no boundary to split at. Upload a PDF with two or more pages.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={generating} onClick={() => changeSplits(Array.from({ length: pageCount - 1 }, (_, i) => i + 1))} data-testid="button-split-every-page">
                <Scissors className="h-4 w-4 mr-1" /> Split every page
              </Button>
              <Button variant="outline" size="sm" disabled={generating || splits.length === 0} onClick={() => changeSplits([])} data-testid="button-clear-splits">
                Clear splits
              </Button>
            </div>
          )}

          <ol className="flex flex-wrap gap-y-5" aria-label="PDF pages" data-testid="list-split-pages">
            {thumbs.map((t, i) => {
              const page = i + 1;
              const active = splits.includes(page);
              return (
                <li key={page} className="flex items-stretch">
                  <figure className="w-[150px]">
                    <div className="flex min-h-[190px] items-center justify-center overflow-hidden rounded-md border bg-white shadow-sm">
                      {t && "url" in t ? (
                        <img src={t.url} alt={`Page ${page} preview`} className="block w-full h-auto" />
                      ) : t ? (
                        <span className="px-2 text-center text-xs text-destructive">
                          Page {page} could not be rendered: {t.error}
                        </span>
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={`Loading page ${page}`} />
                      )}
                    </div>
                    <figcaption className="mt-1 text-center text-xs font-medium text-muted-foreground">Page {page}</figcaption>
                  </figure>
                  {page < pageCount ? (
                    <button
                      type="button"
                      disabled={generating}
                      aria-pressed={active}
                      aria-label={`Split between page ${page} and page ${page + 1}`}
                      title={active ? "Remove split" : "Split here"}
                      onClick={() => toggle(page)}
                      data-testid={`button-split-after-${page}`}
                      className={`group relative mx-1 flex w-7 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60 ${
                        active ? "bg-green-500/10" : "hover:bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dotted ${
                          active ? "border-green-600" : "border-muted-foreground/50 group-hover:border-foreground"
                        }`}
                      />
                      <span
                        className={`relative flex h-5 w-5 items-center justify-center rounded-full border bg-card ${
                          active ? "border-green-600 text-green-600" : "text-muted-foreground"
                        }`}
                      >
                        <Scissors className="h-3 w-3" />
                      </span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {pageCount > 1 && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium" data-testid="text-split-summary">
                {splits.length === 0
                  ? "No splits selected. Choose at least one split line."
                  : `${ranges.length} PDFs will be created from ${splits.length} ${splits.length === 1 ? "split" : "splits"}.`}
              </p>
              {splits.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {ranges.map((r) => (
                    <li key={r.startPage} className="rounded-full border border-green-600/40 bg-green-500/10 px-3 py-1 text-xs font-medium">
                      {rangeLabel(r)} ({r.endPage - r.startPage + 1} {r.endPage === r.startPage ? "page" : "pages"})
                    </li>
                  ))}
                </ul>
              )}
              <Button onClick={generate} disabled={splits.length === 0 || generating} data-testid="button-create-split-pdfs">
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Splitting...</>
                ) : (
                  <><Scissors className="h-4 w-4 mr-2" /> Create split PDFs</>
                )}
              </Button>
              {generating && <Progress value={progress} />}
              {genError && (
                <p className="text-sm text-destructive" role="alert" data-testid="text-generate-error">{genError}</p>
              )}
            </div>
          )}

          {results && (
            <div className="space-y-2" data-testid="list-split-results">
              <h3 className="font-semibold">Your split PDFs</h3>
              <ul className="divide-y rounded-lg border">
                {results.map((r) => (
                  <li key={r.startPage} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={r.name}>{r.name}</p>
                      <p className="text-xs text-muted-foreground">{rangeLabel(r)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => download(r)} data-testid={`button-download-split-${r.startPage}`}>
                      <Download className="h-4 w-4 mr-1" /> Download
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
