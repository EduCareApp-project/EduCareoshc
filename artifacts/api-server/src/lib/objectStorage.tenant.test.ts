import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ limit: vi.fn(), bucket: vi.fn() }));
vi.mock("@workspace/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.limit }) }) }) },
  tenantFilesTable: { objectPath: "object_path" },
}));
vi.mock("@google-cloud/storage", () => ({
  Storage: class { bucket = mocks.bucket; },
  File: class {},
}));
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

beforeEach(() => { vi.clearAllMocks(); mocks.limit.mockResolvedValue([]); });
describe("company file provenance", () => {
  it("rejects an unowned private path before contacting cloud storage", async () => {
    await expect(new ObjectStorageService().getObjectEntityFile("/objects/uploads/other-company"))
      .rejects.toBeInstanceOf(ObjectNotFoundError);
    expect(mocks.limit).toHaveBeenCalledOnce();
    expect(mocks.bucket).not.toHaveBeenCalled();
  });
  it.each(["/objects/../private/file", "/objects/./file", "https://example.invalid/file"])(
    "rejects unsafe or noncanonical paths: %s", async (path) => {
      await expect(new ObjectStorageService().getObjectEntityFile(path)).rejects.toBeInstanceOf(ObjectNotFoundError);
      expect(mocks.bucket).not.toHaveBeenCalled();
    },
  );
});
