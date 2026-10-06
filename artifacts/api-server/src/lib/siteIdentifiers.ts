import type { pool as sharedPool } from "@workspace/db";

export function normalizeSiteIdentifierBody(body: Record<string, unknown> | undefined) {
  if (typeof body?.identifier !== "string") return body;
  return { ...body, identifier: body.identifier.trim().toUpperCase() || null };
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
    await client.query(`
      ALTER TABLE sites ALTER COLUMN identifier DROP NOT NULL,
        ALTER COLUMN identifier DROP DEFAULT;
      CREATE UNIQUE INDEX IF NOT EXISTS sites_identifier_unique ON sites (identifier);
      ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_identifier_format;
      ALTER TABLE sites ADD CONSTRAINT sites_identifier_format
        CHECK (identifier ~ '^[A-Z0-9]{1,5}$');
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
