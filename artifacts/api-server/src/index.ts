import app from "./app";
import { logger } from "./lib/logger";
import { logEmailConfig } from "./lib/email";
import { migrateSiteIdentifiers } from "./lib/siteIdentifiers";
import { migrateKidsoftRoll } from "./lib/kidsoftMigration";
import { db, notificationSettingsTable, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  cleanupAbandonedDocumentMergeUploads,
  DOCUMENT_MERGE_UPLOAD_CLEANUP_INTERVAL_MS,
} from "./lib/documentMergeCleanup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedNotificationSettings(): Promise<void> {
  const defaults = [
    { type: "post_comment",              label: "Post comment",                     enabled: true,  advanceDays: null },
    { type: "observation_comment",       label: "Observation comment",              enabled: true,  advanceDays: null },
    { type: "appraisal_submitted",       label: "Appraisal stage submitted",        enabled: true,  advanceDays: null },
    { type: "incident_submitted",        label: "Incident log submitted",           enabled: true,  advanceDays: null },
    { type: "incident_closed",           label: "Incident log closed",              enabled: true,  advanceDays: null },
    { type: "condition_submitted",       label: "Condition report submitted",       enabled: true,  advanceDays: null },
    { type: "condition_closed",          label: "Condition report closed",          enabled: true,  advanceDays: null },
    { type: "policy_new",                label: "New policy added",                 enabled: true,  advanceDays: null },
    { type: "policy_updated",            label: "Policy updated",                   enabled: true,  advanceDays: null },
    { type: "planning_published",        label: "Calendar published",                enabled: true,  advanceDays: null },
    { type: "qip_deadline",              label: "QIP deadline approaching",         enabled: true,  advanceDays: 14   },
    { type: "qip_deadline_expired",      label: "QIP deadline expired",             enabled: true,  advanceDays: null },
    { type: "weekly_plan_missing",       label: "No published plan for week",       enabled: true,  advanceDays: null },
    { type: "staff_qualification_expiry",label: "Staff qualification expiring",     enabled: true,  advanceDays: 30  },
    { type: "evacuation_expiry",        label: "Evacuation record expiring",        enabled: true,  advanceDays: 14  },
    { type: "checklist_overdue",         label: "Checklist overdue",                enabled: true,  advanceDays: 3   },
    { type: "welfare_note_submitted",    label: "Welfare note submitted",           enabled: true,  advanceDays: null },
    { type: "welfare_mandatory_report",  label: "Mandatory report submitted",       enabled: true,  advanceDays: null },
    { type: "medication_administered",   label: "Medication administered",          enabled: true,  advanceDays: null },
    { type: "medication_expiry",         label: "Medication expiry alert",          enabled: true,  advanceDays: 14   },
  ];

  for (const row of defaults) {
    await db.execute(sql`
      INSERT INTO notification_settings (type, label, enabled, advance_days)
      VALUES (${row.type}, ${row.label}, ${row.enabled}, ${row.advanceDays})
      ON CONFLICT (type) DO NOTHING
    `);
  }
}

async function migrateSitesColumns(): Promise<void> {
  // Additive migration: adds grouping, status, and is_doscel columns introduced
  // alongside the Sites management UI. Idempotent — safe to run on any database.
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE sites
        ADD COLUMN IF NOT EXISTS grouping  text,
        ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS is_doscel boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS service_start_date date
    `);
  } finally {
    client.release();
  }
}

async function migratePolicyDistribution(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE policies
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS distribution_initialized boolean NOT NULL DEFAULT false
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS policy_distributions (
        id serial PRIMARY KEY,
        policy_id integer NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
        staff_id integer NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT policy_distributions_policy_staff_unique UNIQUE (policy_id, staff_id)
      )
    `);

    // Backfill only policies that existed before their distribution was initialized.
    // Existing acknowledgers are retained as recipients even if no longer active.
    await client.query(`
      INSERT INTO policy_distributions (policy_id, staff_id)
      SELECT p.id, s.id
      FROM policies p
      JOIN staff s ON s.status = 'active'
      WHERE NOT p.distribution_initialized
        AND EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(p.notify_roles, ''), ',') AS split_role(role_name)
          WHERE btrim(split_role.role_name) = s.role
        )
      ON CONFLICT (policy_id, staff_id) DO NOTHING
    `);
    await client.query(`
      INSERT INTO policy_distributions (policy_id, staff_id)
      SELECT DISTINCT a.policy_id, a.staff_id
      FROM policy_acknowledgments a
      JOIN staff s ON s.id = a.staff_id
      JOIN policies p ON p.id = a.policy_id
      WHERE NOT p.distribution_initialized
      ON CONFLICT (policy_id, staff_id) DO NOTHING
    `);
    await client.query(`
      UPDATE policies
      SET distribution_initialized = true
      WHERE NOT distribution_initialized
    `);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function fixRollSubmissionWeekStarts(): Promise<void> {
  // One-time repair: rows stored with Sunday dates instead of Monday due to a
  // client timezone bug (toISOString() converting local Monday to UTC Sunday).
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE roll_submissions
      SET week_start = CASE
        WHEN week_start = '2026-06-07' THEN '2026-06-08'::date
        WHEN week_start = '2026-05-10' THEN '2026-05-11'::date
      END
      WHERE week_start IN ('2026-06-07', '2026-05-10')
    `);
  } finally {
    client.release();
  }
}

async function seedSuperAdminStaff(): Promise<void> {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminHash  = process.env.SUPER_ADMIN_PASSWORD_HASH;
  if (!superAdminEmail || !superAdminHash) return;

  const client = await pool.connect();
  try {
    // Upsert the hidden EduCare Support staff account so it always exists
    // with the correct credentials. It is invisible in the staff list and
    // cannot be edited or deleted via the portal.
    await client.query(`
      INSERT INTO staff
        (first_name, last_name, email, role, qualifications, status,
         password_hash, is_super_admin, site_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NULL)
      ON CONFLICT (email) DO UPDATE
        SET is_super_admin = true,
            password_hash  = EXCLUDED.password_hash,
            role           = EXCLUDED.role
    `, [
      "EduCare",
      "Support",
      superAdminEmail.toLowerCase().trim(),
      "admin",
      "",
      "active",
      superAdminHash,
    ]);
  } finally {
    client.release();
  }
}

function startDocumentMergeUploadCleanup(): void {
  let cleanupInProgress = false;

  const runCleanup = async (): Promise<void> => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;
    try {
      const deletedCount = await cleanupAbandonedDocumentMergeUploads();
      logger.info({ deletedCount }, "Document merge upload cleanup completed");
    } catch (err) {
      // Keep scheduled maintenance failures isolated from the API server and
      // from merges currently being processed.
      logger.error({ err }, "Document merge upload cleanup failed");
    } finally {
      cleanupInProgress = false;
    }
  };

  void runCleanup();
  const cleanupInterval = setInterval(() => {
    void runCleanup();
  }, DOCUMENT_MERGE_UPLOAD_CLEANUP_INTERVAL_MS);
  cleanupInterval.unref();
}

async function startServer(): Promise<void> {
  try {
    await migratePolicyDistribution();
    logger.info("Policy distribution migration applied");
  } catch (migrationError) {
    logger.error({ err: migrationError }, "Failed to apply policy distribution migration");
    process.exit(1);
  }

  await migrateSitesColumns();
  logger.info("Sites columns migration applied");
  await pool.query("ALTER TABLE staff ADD COLUMN IF NOT EXISTS emergency_record_headings jsonb");
  await migrateSiteIdentifiers(pool);
  logger.info("Site identifiers migration applied");
  await migrateKidsoftRoll(pool);
  logger.info("Kidsoft Roll schema ready");

  app.listen(port, async (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    logEmailConfig();

    try {
      await fixRollSubmissionWeekStarts();
      logger.info("Roll submission week starts verified");
    } catch (fixErr) {
      logger.warn({ err: fixErr }, "Failed to fix roll submission week starts");
    }

    try {
      await seedNotificationSettings();
      logger.info("Notification settings seeded");
    } catch (seedErr) {
      logger.warn({ err: seedErr }, "Failed to seed notification settings");
    }

    try {
      await seedSuperAdminStaff();
      logger.info("Super admin staff account ensured");
    } catch (seedErr) {
      logger.warn({ err: seedErr }, "Failed to seed super admin staff account");
    }

    startDocumentMergeUploadCleanup();
  });
}

void startServer();
