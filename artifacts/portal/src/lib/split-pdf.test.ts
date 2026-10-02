// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createSplitPdfs, getSplitRanges } from "./split-pdf";

describe("getSplitRanges", () => {
  it("handles no splits and one-page documents", () => {
    expect(getSplitRanges(5, [])).toEqual([{ startPage: 1, endPage: 5 }]);
    expect(getSplitRanges(1, [])).toEqual([{ startPage: 1, endPage: 1 }]);
  });

  it("sorts boundaries and avoids duplicate sections", () => {
    expect(getSplitRanges(7, [5, 2, 2])).toEqual([
      { startPage: 1, endPage: 2 },
      { startPage: 3, endPage: 5 },
      { startPage: 6, endPage: 7 },
    ]);
  });

  it("supports a split at every boundary without an arbitrary cap", () => {
    const ranges = getSplitRanges(301, Array.from({ length: 300 }, (_, i) => i + 1));
    expect(ranges).toHaveLength(301);
    ranges.forEach((range, i) => expect(range).toEqual({ startPage: i + 1, endPage: i + 1 }));
  });

  it.each([0, -1, 2.5, NaN])("rejects invalid page count %s", (count) => {
    expect(() => getSplitRanges(count, [])).toThrow("at least one page");
  });

  it.each([0, -1, 5, 6, 1.5, NaN])("rejects invalid boundary %s", (split) => {
    expect(() => getSplitRanges(5, [split])).toThrow("between two pages");
  });
});

describe("createSplitPdfs", () => {
  async function sourcePdf() {
    const doc = await PDFDocument.create();
    for (let i = 1; i <= 5; i++) {
      const page = doc.addPage([200 + i, 300 + i]);
      page.drawText(`Page ${i}`, { x: 30, y: 50 });
    }
    return doc.save();
  }

  it("creates real readable PDFs with the correct pages, order and filenames", async () => {
    const bytes = await sourcePdf();
    const original = bytes.slice();
    const progress: number[][] = [];
    const results = await createSplitPdfs(bytes, [2, 4], "Service.PDF", (done, total) => {
      progress.push([done, total]);
    });
    expect(results.map((result) => result.name)).toEqual([
      "Service-part-1-pages-1-2.pdf",
      "Service-part-2-pages-3-4.pdf",
      "Service-part-3-page-5.pdf",
    ]);
    expect(progress).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]]);
    const widths: number[] = [];
    for (const result of results) {
      const doc = await PDFDocument.load(result.bytes);
      expect(doc.getPageCount()).toBe(result.endPage - result.startPage + 1);
      widths.push(...doc.getPages().map((page) => page.getWidth()));
    }
    expect(widths).toEqual([201, 202, 203, 204, 205]);
    expect(bytes).toEqual(original);
  });

  it("makes one separate PDF per page when all boundaries are selected", async () => {
    const results = await createSplitPdfs(await sourcePdf(), [1, 2, 3, 4], "All pages.pdf");
    expect(results).toHaveLength(5);
    for (const result of results) {
      expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(1);
    }
  });

  it("reports invalid files clearly", async () => {
    await expect(createSplitPdfs(new Uint8Array([1, 2, 3]), [1], "Not a PDF.pdf"))
      .rejects.toThrow("could not be read");
  });
});