import app from "./app";
import { logger } from "./lib/logger";
import { logEmailConfig } from "./lib/email";
import { db, notificationSettingsTable, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

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
    { type: "checklist_overdue",         label: "Checklist overdue",                enabled: true,  advanceDays: 3   },
    { type: "welfare_note_submitted",    label: "Welfare note submitted",           enabled: true,  advanceDays: null },
    { type: "welfare_mandatory_report",  label: "Mandatory report submitted",       enabled: true,  advanceDays: null },
    { type: "medication_administered",   label: "Medication administered",          enabled: true,  advanceDays: null },
  ];

  for (const row of defaults) {
    await db.execute(sql`
      INSERT INTO notification_settings (type, label, enabled, advance_days)
      VALUES (${row.type}, ${row.label}, ${row.enabled}, ${row.advanceDays})
      ON CONFLICT (type) DO NOTHING
    `);
  }
}

async function seedElysiumOshc(): Promise<void> {
  const client = await pool.connect();
  try {
    // Insert Elysium OSHC into super_admin_orgs if it doesn't already exist
    const result = await client.query(`
      INSERT INTO super_admin_orgs (name, domain, contact_name, contact_email, status, notes, portal_org_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      "Elysium OSHC",
      "https://edu-care-framework.replit.app",
      "Matthew Hine",
      "matt@elysiumoshc.com.au",
      "active",
      "Primary development organisation",
      "565659A",
    ]);

    // Determine the org id (either just inserted or pre-existing)
    let orgId: number;
    if (result.rows.length > 0) {
      orgId = result.rows[0].id;
    } else {
      const existing = await client.query(
        `SELECT id FROM super_admin_orgs WHERE name = $1 LIMIT 1`,
        ["Elysium OSHC"],
      );
      if (existing.rows.length === 0) return;
      orgId = existing.rows[0].id;
    }

    // Link any unlinked sites to this org
    await client.query(
      `UPDATE sites SET org_id = $1 WHERE org_id IS NULL`,
      [orgId],
    );

    // Seed the super admin staff account using the same credentials as the
    // super admin dashboard. Uses ON CONFLICT (email) DO NOTHING so it is
    // safe to run on every restart.
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminHash  = process.env.SUPER_ADMIN_PASSWORD_HASH;
    if (superAdminEmail && superAdminHash) {
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
    }
  } finally {
    client.release();
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logEmailConfig();

  try {
    await seedNotificationSettings();
    logger.info("Notification settings seeded");
  } catch (seedErr) {
    logger.warn({ err: seedErr }, "Failed to seed notification settings");
  }

  try {
    await seedElysiumOshc();
    logger.info("Elysium OSHC org seeded");
  } catch (seedErr) {
    logger.warn({ err: seedErr }, "Failed to seed Elysium OSHC org");
  }
});
