import { describe, expect, it, vi } from "vitest";
import type { pool as sharedPool } from "@workspace/db";
import { generateSiteIdentifier, migrateSiteIdentifiers } from "./siteIdentifiers";

describe("Site identifier migration", () => {
  it("generates five-character uppercase alphanumeric identifiers", () => {
    for (let count = 0; count < 100; count++) {
      expect(generateSiteIdentifier()).toMatch(/^[A-Z0-9]{5}$/);
    }
  });

  it("only backfills missing codes and commits constraints in one transaction", async () => {
    const query = vi.fn(async (sql: string) => ({
      rows: sql.startsWith("SELECT id") ? [
        { id: 1, identifier: "KEEPT" },
        { id: 2, identifier: null },
        { id: 3, identifier: null },
      ] : [],
    }));
    const release = vi.fn();
    const pool = { connect: vi.fn(async () => ({ query, release })) } as unknown as typeof sharedPool;
    await migrateSiteIdentifiers(pool);
    const updates = query.mock.calls.filter(([sql]) => sql.startsWith("UPDATE sites"));
    expect(updates).toHaveLength(2);
    const bindings = updates.map((call) => (call as unknown as [string, [string, number]])[1]);
    expect(bindings.map(([, id]) => id)).toEqual([2, 3]);
    expect(new Set(bindings.map(([code]) => code)).size).toBe(2);
    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the connection on failure", async () => {
    const error = new Error("Migration failed");
    const query = vi.fn().mockResolvedValue({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(error);
    const release = vi.fn();
    const pool = { connect: vi.fn(async () => ({ query, release })) } as unknown as typeof sharedPool;
    await expect(migrateSiteIdentifiers(pool)).rejects.toThrow(error);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(query).not.toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalledOnce();
  });
});
