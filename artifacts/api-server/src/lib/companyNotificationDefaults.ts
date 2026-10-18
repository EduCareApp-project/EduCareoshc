type Query = (text: string, values: unknown[]) => Promise<unknown>;
const defaults = [
  ["post_comment", "Post comment", null],
  ["observation_comment", "Observation comment", null],
  ["appraisal_submitted", "Appraisal stage submitted", null],
  ["incident_submitted", "Incident log submitted", null],
  ["incident_closed", "Incident log closed", null],
  ["condition_submitted", "Condition report submitted", null],
  ["condition_closed", "Condition report closed", null],
  ["policy_new", "New policy added", null],
  ["policy_updated", "Policy updated", null],
  ["planning_published", "Calendar published", null],
  ["qip_deadline", "QIP deadline approaching", 14],
  ["qip_deadline_expired", "QIP deadline expired", null],
  ["weekly_plan_missing", "No published plan for week", null],
  ["staff_qualification_expiry", "Staff qualification expiring", 30],
  ["evacuation_expiry", "Evacuation record expiring", 14],
  ["checklist_overdue", "Checklist overdue", 3],
  ["welfare_note_submitted", "Welfare note submitted", null],
  ["welfare_mandatory_report", "Mandatory report submitted", null],
  ["medication_administered", "Medication administered", null],
  ["medication_expiry", "Medication expiry alert", 14],
] as const;

export async function seedCompanyNotificationDefaults(query: Query, ownerId: number): Promise<void> {
  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) throw new Error("Explicit company ownership is required");
  for (const [type, label, advanceDays] of defaults) {
    await query(`INSERT INTO notification_settings (organisation_id,type,label,enabled,advance_days)
      VALUES($1,$2,$3,true,$4)
      ON CONFLICT(organisation_id,type) WHERE site_id IS NULL DO NOTHING`, [ownerId, type, label, advanceDays]);
  }
}
