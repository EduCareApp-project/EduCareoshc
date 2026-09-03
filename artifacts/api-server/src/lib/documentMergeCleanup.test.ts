import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupAbandonedDocumentMergeUploads,
  DOCUMENT_MERGE_UPLOAD_RETENTION_MS,
} from "./documentMergeCleanup";

const {
  tables,
  state,
  mockDb,
  mockDeleteObjectEntity,
  mockWarn,
  mockError,
  ObjectNotFoundError,
} = vi.hoisted(() => {
  const tables = {
    uploads: {
      id: "id",
      createdAt: "createdAt",
    },
  };

  const state: {
    uploads: Array<{ id: number; objectPath: string; createdAt: Date }>;
  } = {
    uploads: [],
  };

  const selectChain = {
    from: vi.fn(),
    where: vi.fn((condition: { value: Date }) =>
      Promise.resolve(state.uploads.filter((upload) => upload.createdAt < condition.value))),
  };
  selectChain.from.mockReturnValue(selectChain);

  const deleteChain = {
    where: vi.fn((condition: { value: number }) => {
      state.uploads = state.uploads.filter((upload) => upload.id !== condition.value);
      return Promise.resolve([]);
    }),
  };

  const mockDb = {
    select: vi.fn(() => selectChain),
    delete: vi.fn(() => deleteChain),
  };
  const mockDeleteObjectEntity = vi.fn();
  const mockWarn = vi.fn();
  const mockError = vi.fn();

  class ObjectNotFoundError extends Error {}

  return {
    tables,
    state,
    mockDb,
    mockDeleteObjectEntity,
    mockWarn,
    mockError,
    ObjectNotFoundError,
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  documentMergeUploadsTable: tables.uploads,
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  lt: (column: unknown, value: unknown) => ({ column, value }),
}));

vi.mock("./objectStorage", () => ({
  ObjectNotFoundError,
  ObjectStorageService: class {},
}));

vi.mock("./logger", () => ({
  logger: {
    warn: mockWarn,
    error: mockError,
  },
}));

describe("document merge upload cleanup", () => {
  const now = new Date("2026-09-03T00:00:00.000Z");

  beforeEach(() => {
    state.uploads = [];
    mockDb.select.mockClear();
    mockDb.delete.mockClear();
    mockDeleteObjectEntity.mockReset();
    mockWarn.mockReset();
    mockError.mockReset();
  });

  it("removes only pending uploads older than the retention window", async () => {
    state.uploads.push(
      {
        id: 1,
        objectPath: "/objects/uploads/expired",
        createdAt: new Date(now.getTime() - DOCUMENT_MERGE_UPLOAD_RETENTION_MS - 1),
      },
      {
        id: 2,
        objectPath: "/objects/uploads/recent",
        createdAt: new Date(now.getTime() - DOCUMENT_MERGE_UPLOAD_RETENTION_MS + 1),
      },
    );

    const deletedCount = await cleanupAbandonedDocumentMergeUploads({
      now,
      storage: { deleteObjectEntity: mockDeleteObjectEntity },
      log: { warn: mockWarn, error: mockError },
    });

    expect(deletedCount).toBe(1);
    expect(mockDeleteObjectEntity).toHaveBeenCalledWith("/objects/uploads/expired");
    expect(state.uploads).toEqual([
      {
        id: 2,
        objectPath: "/objects/uploads/recent",
        createdAt: new Date(now.getTime() - DOCUMENT_MERGE_UPLOAD_RETENTION_MS + 1),
      },
    ]);
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it("removes missing objects but keeps records when object deletion fails", async () => {
    state.uploads.push(
      { id: 1, objectPath: "/objects/uploads/missing", createdAt: new Date(0) },
      { id: 2, objectPath: "/objects/uploads/failed", createdAt: new Date(0) },
    );
    mockDeleteObjectEntity.mockImplementation(async (objectPath: string) => {
      if (objectPath.endsWith("missing")) throw new ObjectNotFoundError();
      throw new Error("storage unavailable");
    });

    const deletedCount = await cleanupAbandonedDocumentMergeUploads({
      now,
      storage: { deleteObjectEntity: mockDeleteObjectEntity },
      log: { warn: mockWarn, error: mockError },
    });

    expect(deletedCount).toBe(1);
    expect(state.uploads).toHaveLength(1);
    expect(state.uploads[0]?.objectPath).toBe("/objects/uploads/failed");
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: 2, objectPath: "/objects/uploads/failed" }),
      "Failed to remove abandoned document merge object",
    );
    expect(mockError).not.toHaveBeenCalled();
  });
});