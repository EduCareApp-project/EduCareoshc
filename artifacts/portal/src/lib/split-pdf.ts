export type SplitPdfRange = { startPage: number; endPage: number };
export type SplitPdfResult = SplitPdfRange & { name: string; bytes: Uint8Array };

/** Page ranges and boundaries are one-based, inclusive, and always preserve order. */
export function getSplitRanges(pageCount: number, splitAfterPages: readonly number[]): SplitPdfRange[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error("The PDF must contain at least one page.");
  }
  if (splitAfterPages.some((page) => !Number.isInteger(page) || page < 1 || page >= pageCount)) {
    throw new Error("Each split must be between two pages of the document.");
  }
  const boundaries = [...new Set(splitAfterPages)].sort((a, b) => a - b);
  let startPage = 1;
  return [...boundaries, pageCount].map((endPage) => {
    const range = { startPage, endPage };
    startPage = endPage + 1;
    return range;
  });
}

export async function createSplitPdfs(
  bytes: Uint8Array,
  splitAfterPages: readonly number[],
  filename: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<SplitPdfResult[]> {
  const { PDFDocument, EncryptedPDFError } = await import("pdf-lib");
  let source;
  try {
    // Do not bypass encryption: page copying from encrypted sources can produce corrupt results.
    source = await PDFDocument.load(bytes);
  } catch (error) {
    if (error instanceof EncryptedPDFError) {
      throw new Error("Password-protected PDFs are not supported. Upload an unlocked copy.");
    }
    throw new Error("This PDF could not be read. It may be damaged or not a valid PDF.");
  }
  const ranges = getSplitRanges(source.getPageCount(), splitAfterPages);
  const baseName = filename.replace(/\.pdf$/i, "").replace(/[/\\\u0000-\u001f]/g, "_").trim() || "Document";
  const results: SplitPdfResult[] = [];
  onProgress?.(0, ranges.length);
  for (const [index, range] of ranges.entries()) {
    const result = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: range.endPage - range.startPage + 1 },
      (_, offset) => range.startPage - 1 + offset,
    );
    const pages = await result.copyPages(source, pageIndices);
    pages.forEach((page) => result.addPage(page));
    const pageLabel = range.startPage === range.endPage
      ? `page-${range.startPage}`
      : `pages-${range.startPage}-${range.endPage}`;
    results.push({
      ...range,
      name: `${baseName}-part-${index + 1}-${pageLabel}.pdf`,
      bytes: await result.save(),
    });
    onProgress?.(index + 1, ranges.length);
    // Give the browser a chance to paint progress when splitting large documents.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return results;
}