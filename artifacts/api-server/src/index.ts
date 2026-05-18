import app from "./app";
import { logger } from "./lib/logger";
import { logEmailConfig } from "./lib/email";
import { db, notificationSettingsTable } from "@workspace/db";
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
    { type: "appraisal_submitted",       label: "Appraisal stage submitted",        enabled: true,  advanceDays: null },
    { type: "incident_submitted",        label: "Incident log submitted",           enabled: true,  advanceDays: null },
    { type: "incident_closed",           label: "Incident log closed",              enabled: true,  advanceDays: null },
    { type: "condition_submitted",       label: "Condition report submitted",       enabled: true,  advanceDays: null },
    { type: "condition_closed",          label: "Condition report closed",          enabled: true,  advanceDays: null },
    { type: "policy_new",                label: "New policy added",                 enabled: true,  advanceDays: null },
    { type: "policy_updated",            label: "Policy updated",                   enabled: true,  advanceDays: null },
    { type: "planning_published",        label: "Weekly program published",          enabled: true,  advanceDays: null },
    { type: "qip_deadline",              label: "QIP deadline approaching",         enabled: true,  advanceDays: 14   },
    { type: "qip_deadline_expired",      label: "QIP deadline expired",             enabled: true,  advanceDays: null },
    { type: "weekly_plan_missing",       label: "No published plan for week",       enabled: true,  advanceDays: null },
    { type: "staff_qualification_expiry",label: "Staff qualification expiring",     enabled: true,  advanceDays: 30  },
    { type: "checklist_overdue",         label: "Checklist overdue",                enabled: true,  advanceDays: 3   },
  ];

  for (const row of defaults) {
    await db.execute(sql`
      INSERT INTO notification_settings (type, label, enabled, advance_days)
      VALUES (${row.type}, ${row.label}, ${row.enabled}, ${row.advanceDays})
      ON CONFLICT (type) DO NOTHING
    `);
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
});
