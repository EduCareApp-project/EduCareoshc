import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { PDFDocument } from "pdf-lib";

type UploadRow = {
  id: number;
  staffId: number;
  objectPath: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
};

type MergedDocumentRow = {
  id: number;
  staffId: number;
  name: string;
  sourceNames: string[];
  pageCount: number;
  objectPath: string;
  createdAt: Date;
};

const {
  tables,
  state,
  mockDb,
  mockGetObjectEntityUploadURL,
  mockFetch,
  resetState,
} = vi.hoisted(() => {
  const tables = {
    uploads: {
      id: "id",
      staffId: "staffId",
      objectPath: "objectPath",
      originalName: "originalName",
      contentType: "contentType",
      sizeBytes: "sizeBytes",
      createdAt: "createdAt",
    },
    documents: {
      id: "id",
      staffId: "staffId",
      name: "name",
      sourceNames: "sourceNames",
      pageCount: "pageCount",
      objectPath: "objectPath",
      createdAt: "createdAt",
    },
  };

  const state: {
    uploads: UploadRow[];
    documents: MergedDocumentRow[];
    files: Map<string, { bytes: Uint8Array; deleted: boolean }>;
    lastFetchBody: unknown;
    nextUploadId: number;
    nextDocumentId: number;
    nextUploadUrlId: number;
  } = {
    uploads: [],
    documents: [],
    files: new Map(),
    lastFetchBody: undefined,
    nextUploadId: 1,
    nextDocumentId: 1,
    nextUploadUrlId: 1,
  };

  function fieldName(column: unknown): string {
    return String(column);
  }

  type Condition =
    | { kind: "eq"; column: unknown; value: unknown }
    | { kind: "and"; conditions: Condition[] }
    | { kind: "inArray"; column: unknown; values: unknown[] };

  function matches(row: Record<string, unknown>, condition: Condition): boolean {
    if (condition.kind === "eq") {
      return row[fieldName(condition.column)] === condition.value;
    }
    if (condition.kind === "inArray") {
      return condition.values.includes(row[fieldName(condition.column)]);
    }
    return condition.conditions.every((child) => matches(row, child));
  }

  function createChain(operation: "select" | "insert" | "delete") {
    let table: unknown;
    let rows: Record<string, unknown>[] = [];
    let insertedValues: Record<string, unknown> | undefined;

    const chain = {
      from: vi.fn((selectedTable: unknown) => {
        table = selectedTable;
        if (selectedTable === tables.uploads) rows = state.uploads as unknown as Record<string, unknown>[];
        if (selectedTable === tables.documents) rows = state.documents as unknown as Record<string, unknown>[];
        return chain;
      }),
      where: vi.fn((condition: Condition) => {
        if (operation === "delete") {
          if (table === tables.uploads) {
            state.uploads = state.uploads.filter((row) => !matches(row as unknown as Record<string, unknown>, condition));
          } else if (table === tables.documents) {
            state.documents = state.documents.filter((row) => !matches(row as unknown as Record<string, unknown>, condition));
          }
          return chain;
        }

        rows = rows.filter((row) => matches(row, condition));
        return chain;
      }),
      orderBy: vi.fn(() => chain),
      limit: vi.fn((count: number) => {
        rows = rows.slice(0, count);
        return chain;
      }),
      values: vi.fn((values: Record<string, unknown>) => {
        insertedValues = values;
        if (table === tables.uploads) {
          state.uploads.push({
            id: state.nextUploadId++,
            staffId: values.staffId as number,
            objectPath: values.objectPath as string,
            originalName: values.originalName as string,
            contentType: values.contentType as string,
            sizeBytes: values.sizeBytes as number,
            createdAt: new Date("2026-09-03T00:00:00.000Z"),
          });
        }
        return chain;
      }),
      returning: vi.fn(async () => {
        if (table !== tables.documents || !insertedValues) return [];
        const document: MergedDocumentRow = {
          id: state.nextDocumentId++,
          staffId: insertedValues.staffId as number,
          name: insertedValues.name as string,
          sourceNames: insertedValues.sourceNames as string[],
          pageCount: insertedValues.pageCount as number,
          objectPath: insertedValues.objectPath as string,
          createdAt: new Date("2026-09-03T00:00:00.000Z"),
        };
        state.documents.push(document);
        return [document];
      }),
      then(
        resolve: (value: unknown[]) => unknown,
        reject: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(rows).then(resolve, reject);
      },
      catch(reject: (reason: unknown) => unknown) {
        return Promise.resolve(rows).catch(reject);
      },
    };

    return chain;
  }

  const mockDb = {
    select: vi.fn(() => createChain("select")),
    insert: vi.fn((table: unknown) => {
      const chain = createChain("insert");
      chain.from(table);
      return chain;
    }),
    delete: vi.fn((table: unknown) => {
      const chain = createChain("delete");
      chain.from(table);
      return chain;
    }),
  };

  const mockGetObjectEntityUploadURL = vi.fn(async () => {
    const id = state.nextUploadUrlId++;
    return `https://storage.test/upload-${id}`;
  });
  const mockFetch = vi.fn(async (_url: string, init?: { body?: unknown }) => {
    state.lastFetchBody = init?.body;
    return { ok: true, status: 200 };
  });

  function resetState() {
    state.uploads.length = 0;
    state.documents.length = 0;
    state.files.clear();
    state.lastFetchBody = undefined;
    state.nextUploadId = 1;
    state.nextDocumentId = 1;
    state.nextUploadUrlId = 1;
    mockGetObjectEntityUploadURL.mockClear();
    mockFetch.mockClear();
  }

  return {
    tables,
    state,
    mockDb,
    mockGetObjectEntityUploadURL,
    mockFetch,
    resetState,
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  documentMergeUploadsTable: tables.uploads,
  mergedDocumentsTable: tables.documents,
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ kind: "and", conditions }),
  desc: (column: unknown) => ({ kind: "desc", column }),
  eq: (column: unknown, value: unknown) => ({ kind: "eq", column, value }),
  inArray: (column: unknown, values: unknown[]) => ({ kind: "inArray", column, values }),
}));

vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
      Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
    }
  }

  class ObjectStorageService {
    async getObjectEntityUploadURL() {
      return mockGetObjectEntityUploadURL();
    }

    normalizeObjectEntityPath(uploadURL: string) {
      return `/objects/uploads/${uploadURL.split("-").at(-1)}`;
    }

    async getObjectEntityFile(objectPath: string) {
      const file = state.files.get(objectPath);
      if (!file) throw new ObjectNotFoundError();
      return {
        download: async () => [file.bytes],
        delete: async () => {
          file.deleted = true;
        },
        bytes: file.bytes,
      };
    }

    async downloadObject(file: { bytes: Uint8Array }) {
      return new Response(file.bytes, {
        status: 200,
        headers: { "Content-Length": String(file.bytes.byteLength) },
      });
    }
  }

  return { ObjectNotFoundError, ObjectStorageService };
});

vi.stubGlobal("fetch", mockFetch);

import aiToolsRouter from "./ai-tools";

function buildApp(user: { id: number; type: "staff" | "guardian" }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { user };
    next();
  });
  app.use("/api", aiToolsRouter);
  return app;
}

function addDocument(document: Partial<MergedDocumentRow> & Pick<MergedDocumentRow, "id" | "staffId">) {
  const complete: MergedDocumentRow = {
    id: document.id,
    staffId: document.staffId,
    name: document.name ?? "Merged document.pdf",
    sourceNames: document.sourceNames ?? ["first.pdf", "second.pdf"],
    pageCount: document.pageCount ?? 2,
    objectPath: document.objectPath ?? `/objects/merged/${document.id}`,
    createdAt: document.createdAt ?? new Date("2026-09-03T00:00:00.000Z"),
  };
  state.documents.push(complete);
  return complete;
}

async function onePagePdf(width: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.addPage([width, 200]);
  return document.save();
}

describe("AI Tools document merge ownership", () => {
  beforeEach(() => {
    resetState();
  });

  it("records the signed-in staff member as the upload owner", async () => {
    const response = await request(buildApp({ id: 7, type: "staff" }))
      .post("/api/ai-tools/document-merge/upload-url")
      .send({ name: "signed.pdf", size: 1024, contentType: "application/pdf" });

    expect(response.status).toBe(200);
    expect(response.body.objectPath).toBe("/objects/uploads/1");
    expect(state.uploads).toHaveLength(1);
    expect(state.uploads[0]).toMatchObject({
      staffId: 7,
      objectPath: "/objects/uploads/1",
      originalName: "signed.pdf",
    });
  });

  it("rejects unsupported filename and content-type combinations before creating an upload", async () => {
    const response = await request(buildApp({ id: 7, type: "staff" }))
      .post("/api/ai-tools/document-merge/upload-url")
      .send({ name: "notes.txt", size: 1024, contentType: "application/pdf" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("filename and file type");
    expect(state.uploads).toHaveLength(0);
  });

  it("merges owned files in the requested order and removes their pending records and objects", async () => {
    const firstBytes = await onePagePdf(200);
    const secondBytes = await onePagePdf(400);
    const firstPath = "/objects/uploads/first";
    const secondPath = "/objects/uploads/second";
    state.uploads.push(
      {
        id: 1,
        staffId: 7,
        objectPath: firstPath,
        originalName: "first.pdf",
        contentType: "application/pdf",
        sizeBytes: firstBytes.byteLength,
        createdAt: new Date("2026-09-03T00:00:00.000Z"),
      },
      {
        id: 2,
        staffId: 7,
        objectPath: secondPath,
        originalName: "second.pdf",
        contentType: "application/pdf",
        sizeBytes: secondBytes.byteLength,
        createdAt: new Date("2026-09-03T00:00:00.000Z"),
      },
    );
    state.files.set(firstPath, { bytes: firstBytes, deleted: false });
    state.files.set(secondPath, { bytes: secondBytes, deleted: false });

    const response = await request(buildApp({ id: 7, type: "staff" }))
      .post("/api/ai-tools/document-merges/merge")
      .send({ files: [{ objectPath: secondPath }, { objectPath: firstPath }] });

    expect(response.status).toBe(201);
    expect(response.body.sourceNames).toEqual(["second.pdf", "first.pdf"]);
    expect(response.body.pageCount).toBe(2);
    expect(state.uploads).toHaveLength(0);
    expect(state.files.get(firstPath)?.deleted).toBe(true);
    expect(state.files.get(secondPath)?.deleted).toBe(true);

    const merged = await PDFDocument.load(state.lastFetchBody as Uint8Array);
    expect(merged.getPage(0).getWidth()).toBe(400);
    expect(merged.getPage(1).getWidth()).toBe(200);
  });

  it("lists only merged documents owned by the signed-in staff member", async () => {
    addDocument({ id: 1, staffId: 7, name: "mine.pdf" });
    addDocument({ id: 2, staffId: 8, name: "not-mine.pdf" });

    const response = await request(buildApp({ id: 7, type: "staff" }))
      .get("/api/ai-tools/document-merges");

    expect(response.status).toBe(200);
    expect(response.body.map((document: { id: number }) => document.id)).toEqual([1]);
  });

  it("allows owners to view and download but returns not found for another staff member", async () => {
    const document = addDocument({ id: 1, staffId: 7, name: "mine.pdf" });
    state.files.set(document.objectPath, { bytes: await onePagePdf(200), deleted: false });

    const ownerView = await request(buildApp({ id: 7, type: "staff" }))
      .get("/api/ai-tools/document-merges/1/view");
    const otherView = await request(buildApp({ id: 8, type: "staff" }))
      .get("/api/ai-tools/document-merges/1/view");
    const ownerDownload = await request(buildApp({ id: 7, type: "staff" }))
      .get("/api/ai-tools/document-merges/1/download");
    const otherDownload = await request(buildApp({ id: 8, type: "staff" }))
      .get("/api/ai-tools/document-merges/1/download");

    expect(ownerView.status).toBe(200);
    expect(ownerView.headers["content-disposition"]).toBe('inline; filename="mine.pdf"');
    expect(otherView.status).toBe(404);
    expect(ownerDownload.status).toBe(200);
    expect(ownerDownload.headers["content-disposition"]).toBe('attachment; filename="mine.pdf"');
    expect(otherDownload.status).toBe(404);
  });

  it("deletes the owned metadata and private object, while another staff member cannot delete it", async () => {
    const document = addDocument({ id: 1, staffId: 7 });
    state.files.set(document.objectPath, { bytes: await onePagePdf(200), deleted: false });

    const unauthorized = await request(buildApp({ id: 8, type: "staff" }))
      .delete("/api/ai-tools/document-merges/1");

    expect(unauthorized.status).toBe(404);
    expect(state.documents).toHaveLength(1);
    expect(state.files.get(document.objectPath)?.deleted).toBe(false);

    const deleted = await request(buildApp({ id: 7, type: "staff" }))
      .delete("/api/ai-tools/document-merges/1");

    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ ok: true });
    expect(state.documents).toHaveLength(0);
    expect(state.files.get(document.objectPath)?.deleted).toBe(true);
  });
});