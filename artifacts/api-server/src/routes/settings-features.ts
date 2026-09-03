import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organisationTable, type FeatureSettings } from "@workspace/db";

const router: IRouter = Router();

const DEFAULTS: Required<FeatureSettings> = {
  guardianAllowComments: true,
  guardianWelcomeMessage: null,
  guardianShowLearningStories: true,
  guardianShowObservations: false,
  guardianRequireEmail: true,
  staffRequireWwcc: true,
  staffAppraisalCycleDays: 365,
  staffProfilesVisibleToPeers: false,
  staffQualificationNames: [],
  staffCannotWorkQuals: [],
  staffResponsiblePersonQuals: [],
  staffEducatorQuals: [],
  childrenRequireMedicalNotes: false,
  childrenShowDobOnProfile: false,
  childDocumentTypes: ["Medical", "Behaviour", "MTOP Evidence"],
  notificationChannelMap: {},
  postsAllowGuardianComments: true,
  postsDefaultScope: "all_sites",
  postsRequireCommentApproval: false,
  observationsRequireMtop: false,
  observationsDefaultType: "individual",
  observationsVisibleToPeers: true,
  storiesIncludeMtop: true,
  storiesIncludePhoto: true,
  storiesDefaultSharing: "staff_only",
  incidentNotifyGuardians: false,
  incidentRequireFollowUp: true,
  incidentNotifyAllSites: false,
  conditionNotifyGuardians: false,
  conditionRequireFollowUp: true,
  calendarDefaultView: "week",
  calendarPublishByDefault: false,
  calendarShowPublicHolidays: true,
  checklistReminderDays: 3,
  checklistAutoClose: false,
  planningCycleDurationWeeks: 2,
  planningRequireOutcomes: false,
  planningLockAfterPublish: false,
  complianceReviewCycleDays: 90,
  staffComplianceWarnDays: 60,
  staffComplianceSuspendOnExpiry: false,
  jottingsVisibleToGuardians: false,
  jottingsRequireChild: false,
  evacuationDrillFrequencyDays: 90,
  evacuationDrillReminderDays: 14,
  policiesRequireAcknowledgement: true,
  policiesAcknowledgementDays: 7,
  staffCustomRoles: [],
  webmailEnabled: false,
  webmailUrl: "https://sh00070.cd.ds.network:2096/",
};

router.get("/settings/features", async (req, res): Promise<void> => {
  try {
    const [row] = await db
      .select({ featureSettings: organisationTable.featureSettings })
      .from(organisationTable)
      .limit(1);
    const merged = { ...DEFAULTS, ...(row?.featureSettings ?? {}) };
    res.json(merged);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch feature settings");
    res.status(500).json({ error: "Failed to fetch feature settings" });
  }
});

router.put("/settings/features", async (req, res): Promise<void> => {
  const patch = req.body ?? {};

  try {
    const [existing] = await db.select().from(organisationTable).limit(1);

    if (existing) {
      const current = existing.featureSettings ?? {};
      const updated = { ...current, ...patch };
      await db
        .update(organisationTable)
        .set({ featureSettings: updated, updatedAt: new Date() })
        .where(eq(organisationTable.id, existing.id));
      res.json({ ...DEFAULTS, ...updated });
    } else {
      await db.insert(organisationTable).values({
        featureSettings: patch,
        updatedAt: new Date(),
      } as any);
      res.json({ ...DEFAULTS, ...patch });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update feature settings");
    res.status(500).json({ error: "Failed to update feature settings" });
  }
});

export default router;
