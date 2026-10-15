import type { pool as sharedPool } from "@workspace/db";

/** Additive startup migration, including published environments, before serving requests. */
export async function migrateKidsoftRoll(pool: typeof sharedPool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kidsoft_service_mappings (
      site_id integer PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      service_id text NOT NULL UNIQUE,
      service_name text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS kidsoft_roll_snapshots (
      site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      roll_date date NOT NULL,
      service_id text NOT NULL,
      bookings jsonb NOT NULL,
      refreshed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT kidsoft_roll_site_date_unique UNIQUE (site_id, roll_date)
    );
  `);
}
