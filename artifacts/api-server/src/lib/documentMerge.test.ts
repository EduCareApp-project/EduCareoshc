import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergeDocumentSources } from "./documentMerge";

async function onePagePdf(): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  return document.save();
}

describe("mergeDocumentSources", () => {
  it("preserves the requested PDF order and page count", async () => {
    const first = await onePagePdf();
    const secondDocument = await PDFDocument.create();
    secondDocument.addPage([300, 300]);
    secondDocument.addPage([400, 400]);

    const result = await mergeDocumentSources([
      { name: "first.pdf", contentType: "application/pdf", bytes: first },
      { name: "second.pdf", contentType: "application/pdf", bytes: await secondDocument.save() },
    ]);
    const merged = await PDFDocument.load(result.bytes);

    expect(result.pageCount).toBe(3);
    expect(merged.getPage(0).getWidth()).toBe(200);
    expect(merged.getPage(1).getWidth()).toBe(300);
    expect(merged.getPage(2).getWidth()).toBe(400);
  });

  it("rejects a merge with fewer than two sources", async () => {
    await expect(mergeDocumentSources([
      { name: "only.pdf", contentType: "application/pdf", bytes: await onePagePdf() },
    ])).rejects.toThrow("At least two documents are required");
  });
});