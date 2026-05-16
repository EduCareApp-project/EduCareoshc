/**
 * One-time script to set initial passwords for staff and/or guardians.
 * Usage:  pnpm --filter @workspace/scripts run seed-admin-password
 *
 * Edit ENTRIES below before running.
 */
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const STAFF_PASSWORDS: Array<{ email: string; password: string }> = [
  { email: "matt@elysiumoshc.com.au", password: "Admin1234!" },
  { email: "jack@eoshc.com.au",       password: "Admin1234!" },
];

const GUARDIAN_PASSWORDS: Array<{ email: string; password: string }> = [];

async function run() {
  const ROUNDS = 12;

  for (const { email, password } of STAFF_PASSWORDS) {
    const hash = await bcrypt.hash(password, ROUNDS);
    const result = await pool.query(
      "UPDATE staff SET password_hash = $1 WHERE email = $2",
      [hash, email.toLowerCase()],
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`✓ Staff password set for ${email}`);
    } else {
      console.warn(`⚠  Staff not found: ${email}`);
    }
  }

  for (const { email, password } of GUARDIAN_PASSWORDS) {
    const hash = await bcrypt.hash(password, ROUNDS);
    const result = await pool.query(
      "UPDATE parent_accounts SET password_hash = $1 WHERE guardian_email = $2",
      [hash, email.toLowerCase()],
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`✓ Guardian password set for ${email}`);
    } else {
      console.warn(`⚠  Guardian not found: ${email}`);
    }
  }

  await pool.end();
  console.log("Done.");
}

run().catch((err) => { console.error(err); process.exit(1); });
