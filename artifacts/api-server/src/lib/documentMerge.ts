import { PDFDocument } from "pdf-lib";

export const DOCUMENT_MERGE_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type DocumentMergeContentType = typeof DOCUMENT_MERGE_CONTENT_TYPES[number];

export type DocumentMergeSource = {
  name: string;
  contentType: DocumentMergeContentType;
  bytes: Uint8Array;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const IMAGE_MARGIN = 36;

export async function mergeDocumentSources(
  sources: DocumentMergeSource[],
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  if (sources.length < 2) {
    throw new Error("At least two documents are required");
  }

  const merged = await PDFDocument.create();

  for (const source of sources) {
    if (source.contentType === "application/pdf") {
      const sourcePdf = await PDFDocument.load(source.bytes);
      const pages = await merged.copyPages(sourcePdf, sourcePdf.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
      continue;
    }

    const image = source.contentType === "image/jpeg"
      ? await merged.embedJpg(source.bytes)
      : await merged.embedPng(source.bytes);
    const maxWidth = A4_WIDTH - IMAGE_MARGIN * 2;
    const maxHeight = A4_HEIGHT - IMAGE_MARGIN * 2;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const page = merged.addPage([A4_WIDTH, A4_HEIGHT]);

    page.drawImage(image, {
      x: (A4_WIDTH - width) / 2,
      y: (A4_HEIGHT - height) / 2,
      width,
      height,
    });
  }

  if (merged.getPageCount() === 0) {
    throw new Error("The selected documents do not contain any pages");
  }

  return {
    bytes: await merged.save(),
    pageCount: merged.getPageCount(),
  };
}