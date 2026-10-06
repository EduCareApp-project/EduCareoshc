import { randomInt } from "node:crypto";
import type { pool as sharedPool } from "@workspace/db";

export function generateSiteIdentifier(): string {
  return randomInt(36 ** 5).toString(36).toUpperCase().padStart(5, "0");
}

export function normalizeSiteIdentifierBody(body: Record<string, unknown> | undefined) {
  if (typeof body?.identifier !== "string") return body;
  return { ...body, identifier: body.identifier.trim().toUpperCase() };
}

export function isDuplicateSiteIdentifier(error: unknown): boolean {
  // Drizzle wraps the PostgreSQL error in cause.
  const outer = error as { code?: string; constraint?: string; cause?: unknown };
  const detail = (outer?.cause ?? outer) as { code?: string; constraint?: string };
  return detail?.code === "23505" && detail.constraint === "sites_identifier_unique";
}

/** Additive, transactional, and completed before the API accepts requests. */
export async function migrateSiteIdentifiers(pool: typeof sharedPool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE sites ADD COLUMN IF NOT EXISTS identifier text");
    await client.query("LOCK TABLE sites IN ACCESS EXCLUSIVE MODE");
    const { rows } = await client.query<{ id: number; identifier: string | null }>(
      "SELECT id, identifier FROM sites ORDER BY id",
    );
    const used = new Set(rows.flatMap((row) => row.identifier ? [row.identifier] : []));
    for (const row of rows) {
      if (row.identifier) continue;
      let identifier = generateSiteIdentifier();
      while (used.has(identifier)) identifier = generateSiteIdentifier();
      used.add(identifier);
      await client.query("UPDATE sites SET identifier = $1 WHERE id = $2", [identifier, row.id]);
    }
    await client.query(`
      ALTER TABLE sites ALTER COLUMN identifier SET NOT NULL,
        ALTER COLUMN identifier SET DEFAULT upper(substr(md5(random()::text), 1, 5));
      CREATE UNIQUE INDEX IF NOT EXISTS sites_identifier_unique ON sites (identifier);
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conrelid = 'sites'::regclass
            AND conname = 'sites_identifier_format'
        ) THEN
          ALTER TABLE sites ADD CONSTRAINT sites_identifier_format
            CHECK (identifier ~ '^[A-Z0-9]{5}$');
        END IF;
      END $$;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
