import { describe, expect, it, vi } from "vitest";
import type { pool as sharedPool } from "@workspace/db";
import { migrateSiteIdentifiers } from "./siteIdentifiers";

describe("Site identifier migration", () => {
  it("allows unassigned codes without changing any existing site data", async () => {
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
    expect(updates).toHaveLength(0);
    const statements = query.mock.calls.map(([sql]) => sql).join("\n");
    expect(statements).toContain("ALTER COLUMN identifier DROP NOT NULL");
    expect(statements).toContain("ALTER COLUMN identifier DROP DEFAULT");
    expect(statements).toContain("DROP CONSTRAINT IF EXISTS sites_identifier_format");
    expect(statements).toContain("CHECK (identifier ~ '^[A-Z0-9]{1,5}$')");
    expect(statements).not.toContain("random()");
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
