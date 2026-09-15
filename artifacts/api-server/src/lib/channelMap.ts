import { db } from "@workspace/db";
import { organisationTable } from "@workspace/db";

const DEFAULTS: Record<string, { email: boolean; inApp: boolean }> = {
  guardian_notice:      { email: true,  inApp: false },
  guardian_post:        { email: true,  inApp: false },
  guardian_weekly_plan: { email: true,  inApp: false },
  guardian_medication:  { email: true,  inApp: false },
  guardian_behavioural: { email: true,  inApp: false },
  guardian_welcome:     { email: true,  inApp: false },
  guardian_excursion:   { email: true,  inApp: false },
  incident_submitted:   { email: false, inApp: true },
  incident_closed:      { email: false, inApp: true },
  condition_submitted:  { email: false, inApp: true },
  condition_closed:     { email: false, inApp: true },
  post_comment:         { email: false, inApp: true },
  observation_comment:  { email: false, inApp: true },
  appraisal_submitted:  { email: false, inApp: true },
  policy_new:           { email: false, inApp: true },
  policy_updated:       { email: false, inApp: true },
  welfare_note_submitted:    { email: false, inApp: true },
  welfare_mandatory_report:  { email: false, inApp: true },
  medication_administered:   { email: false, inApp: true },
  medication_expiry:         { email: true,  inApp: true },
  qip_deadline:              { email: false, inApp: true },
  qip_deadline_expired:      { email: false, inApp: true },
  staff_qualification_expiry:{ email: false, inApp: true },
  weekly_plan_missing:       { email: false, inApp: true },
  checklist_overdue:         { email: false, inApp: true },
};

async function fetchChannelMap(): Promise<Record<string, { email?: boolean; inApp?: boolean }>> {
  const [row] = await db.select({ fs: organisationTable.featureSettings }).from(organisationTable).limit(1);
  return ((row?.fs as any)?.notificationChannelMap ?? {}) as Record<string, { email?: boolean; inApp?: boolean }>;
}

export async function isEmailChannelEnabled(key: string): Promise<boolean> {
  const map = await fetchChannelMap();
  const entry = map[key];
  if (entry === undefined || entry.email === undefined) return DEFAULTS[key]?.email ?? true;
  return entry.email;
}

export async function isInAppChannelEnabled(key: string): Promise<boolean> {
  const map = await fetchChannelMap();
  const entry = map[key];
  if (entry === undefined || entry.inApp === undefined) return DEFAULTS[key]?.inApp ?? true;
  return entry.inApp;
}
