import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export interface FeatureSettings {
  // Guardians
  guardianAllowComments?: boolean;
  guardianWelcomeMessage?: string | null;
  guardianShowLearningStories?: boolean;
  guardianShowObservations?: boolean;
  guardianRequireEmail?: boolean;
  // Staff
  staffRequireWwcc?: boolean;
  staffAppraisalCycleDays?: number;
  staffProfilesVisibleToPeers?: boolean;
  staffCustomRoles?: string[];
  // Children
  childrenRequireMedicalNotes?: boolean;
  childrenShowDobOnProfile?: boolean;
  childDocumentTypes?: string[];
  // Posts
  postsAllowGuardianComments?: boolean;
  postsDefaultScope?: "all_sites" | "own_site";
  postsRequireCommentApproval?: boolean;
  // Observations
  observationsRequireMtop?: boolean;
  observationsDefaultType?: "individual" | "group";
  observationsVisibleToPeers?: boolean;
  // Learning Stories
  storiesIncludeMtop?: boolean;
  storiesIncludePhoto?: boolean;
  storiesDefaultSharing?: "staff_only" | "guardians";
  // Incidents
  incidentNotifyGuardians?: boolean;
  incidentRequireFollowUp?: boolean;
  incidentNotifyAllSites?: boolean;
  // Condition Reports
  conditionNotifyGuardians?: boolean;
  conditionRequireFollowUp?: boolean;
  // Calendar
  calendarDefaultView?: "week" | "month";
  calendarPublishByDefault?: boolean;
  calendarShowPublicHolidays?: boolean;
  // Checklists
  checklistReminderDays?: number;
  checklistAutoClose?: boolean;
  // Planning
  planningCycleDurationWeeks?: number;
  planningRequireOutcomes?: boolean;
  planningLockAfterPublish?: boolean;
  // Service Compliance
  complianceReviewCycleDays?: number;
  // Staff Compliance
  staffComplianceWarnDays?: number;
  staffComplianceSuspendOnExpiry?: boolean;
  // Jottings
  jottingsVisibleToGuardians?: boolean;
  jottingsRequireChild?: boolean;
  // Safety Evacuation
  evacuationDrillFrequencyDays?: number;
  evacuationDrillReminderDays?: number;
  // Policies
  policiesRequireAcknowledgement?: boolean;
  policiesAcknowledgementDays?: number;
}

export const organisationTable = pgTable("organisation", {
  id: serial("id").primaryKey(),
  organisationId: text("organisation_id").unique(),
  name: text("name"),
  childDisplayMode: text("child_display_mode").notNull().default("letter_icon"),
  approvalNumber: text("approval_number"),
  abn: text("abn"),
  servicePhone: text("service_phone"),
  serviceEmail: text("service_email"),
  featureSettings: jsonb("feature_settings")
    .$type<FeatureSettings>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organisation = typeof organisationTable.$inferSelect;
