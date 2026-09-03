import { eq, lt } from "drizzle-orm";
import {
  db,
  documentMergeUploadsTable,
  type DocumentMergeUpload,
} from "@workspace/db";
import { logger } from "./logger";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";

export const DOCUMENT_MERGE_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;
export const DOCUMENT_MERGE_UPLOAD_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

type CleanupDatabase = Pick<typeof db, "select" | "delete">;
type CleanupStorage = Pick<ObjectStorageService, "deleteObjectEntity">;
type CleanupLogger = Pick<typeof logger, "warn" | "error">;

export type DocumentMergeCleanupOptions = {
  database?: CleanupDatabase;
  storage?: CleanupStorage;
  log?: CleanupLogger;
  now?: Date;
};

/**
 * Removes source uploads that have remained pending past the retention window.
 *
 * The database is the source of truth for cleanup: this function never scans
 * or deletes an object unless a matching pending upload row was selected.
 * Failed object or metadata deletions are left for a later run.
 */
export async function cleanupAbandonedDocumentMergeUploads(
  options: DocumentMergeCleanupOptions = {},
): Promise<number> {
  const database = options.database ?? db;
  const storage = options.storage ?? new ObjectStorageService();
  const log = options.log ?? logger;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - DOCUMENT_MERGE_UPLOAD_RETENTION_MS);

  let pendingUploads: DocumentMergeUpload[];
  try {
    pendingUploads = await database
      .select()
      .from(documentMergeUploadsTable)
      .where(lt(documentMergeUploadsTable.createdAt, cutoff));
  } catch (err) {
    log.error({ err }, "Failed to find abandoned document merge uploads");
    return 0;
  }

  let deletedCount = 0;
  for (const upload of pendingUploads) {
    let objectDeleted = false;
    try {
      await storage.deleteObjectEntity(upload.objectPath);
      objectDeleted = true;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        // The object may never have finished uploading. Its metadata is still
        // stale and can be removed even though there is no object to delete.
        objectDeleted = true;
      } else {
        log.warn(
          { err, uploadId: upload.id, objectPath: upload.objectPath },
          "Failed to remove abandoned document merge object",
        );
      }
    }

    if (!objectDeleted) continue;

    try {
      await database
        .delete(documentMergeUploadsTable)
        .where(eq(documentMergeUploadsTable.id, upload.id));
      deletedCount += 1;
    } catch (err) {
      log.error(
        { err, uploadId: upload.id, objectPath: upload.objectPath },
        "Failed to remove abandoned document merge upload record",
      );
    }
  }

  return deletedCount;
}