import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import childrenRouter from "./children";
import guardiansRouter from "./guardians";
import guardianFinancialRouter from "./guardian-financial";
import staffRouter from "./staff";
import outcomesRouter from "./outcomes";
import observationsRouter from "./observations";
import programsRouter from "./programs";
import nqsRouter from "./nqs";
import nqsElementsRouter from "./nqs-elements";
import dashboardRouter from "./dashboard";
import noticesRouter from "./notices";
import jottingsRouter from "./jottings";
import incidentsRouter from "./incidents";
import conditionReportsRouter from "./condition-reports";
import evacuationsRouter from "./evacuations";
import qipRouter from "./qip";
import serviceDocsRouter from "./service-docs";
import wellbeingRouter from "./wellbeing";
import policiesRouter from "./policies";
import fileCategoriesRouter from "./file-categories";
import fileLibraryRouter from "./file-library";
import checklistsRouter from "./checklists";
import postsRouter from "./posts";
import professionalDevelopmentRouter from "./professional-development";
import planningRouter from "./planning";
import reportsRouter from "./reports";
import sitesRouter from "./sites";
import siteInstructionsRouter from "./site-instructions";
import welfareNotesRouter from "./welfare-notes";
import storageRouter from "./storage";
import confidentialNotesRouter from "./confidential-notes";
import staffQualificationsRouter from "./staff-qualifications";
import systemAccessRouter from "./system-access";
import contactEnquiryRouter from "./contact-enquiry";
import appraisalsRouter from "./appraisals";
import emailSettingsRouter from "./email-settings";
import organisationRouter from "./organisation";
import rollSubmissionsRouter from "./roll-submissions";
import weeklyReviewsRouter from "./weekly-reviews";
import settingsAccessRouter from "./settings-access";
import notificationsRouter from "./notifications";
import settingsChildrenRouter from "./settings-children";
import settingsFeaturesRouter from "./settings-features";
import dataImportRouter from "./data-import";
import medicationsRouter from "./medications";
import behaviouralNotificationsRouter from "./behavioural-notifications";
import clickupRouter from "./clickup";
import superAdminRouter from "./super-admin";
import aiToolsRouter from "./ai-tools";
import schoolsRouter from "./schools";
import schoolReportsRouter from "./school-reports";
import schoolReportSummariesRouter from "./school-report-summaries";

const router: IRouter = Router();

// ── Public routes (no auth required) ──────────────────────────────────────────
router.use(healthRouter);
router.use(authRouter);
router.use(contactEnquiryRouter);
router.use(superAdminRouter);

// Allow unauthenticated access to public pages and storage (for public assets)
router.use("/qip/public", (req: Request, res: Response, next: NextFunction) => next());
router.use("/service-docs/public", (req: Request, res: Response, next: NextFunction) => next());
router.use("/email-settings/logo", (req: Request, res: Response, next: NextFunction) => next());
router.use("/storage/objects", (req: Request, res: Response, next: NextFunction) => next());

// ── Auth guard ────────────────────────────────────────────────────────────────
router.use((req: Request, res: Response, next: NextFunction): void => {
  // Skip public paths already handled above
  if (
    req.path.startsWith("/qip/public") ||
    req.path.startsWith("/service-docs/public") ||
    req.path.startsWith("/storage/objects") ||
    req.path === "/email-settings/logo" ||
    req.path === "/contact-enquiry"
  ) {
    next();
    return;
  }
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// School accounts are tenant-scoped and read-only. Keep this boundary central so
// adding a new staff API cannot accidentally expose it to school sessions.
router.use((req: Request, res: Response, next: NextFunction): void => {
  const user = req.session.user;
  if (user?.type !== "school") {
    next();
    return;
  }
  const ownSchoolDocumentPath = new RegExp(`^/schools/${user.siteId}/vital-records/\\d+/document$`);
  const ownSchoolStaffProfilePath = new RegExp(`^/schools/${user.siteId}/staff/\\d+$`);
  const requestedServiceDocsSiteId = typeof req.query.siteId === "string" ? Number(req.query.siteId) : NaN;
  const ownServiceDocsListPath =
    req.path === "/service-docs/public" && requestedServiceDocsSiteId === user.siteId;
  const publicServiceDocsFilePath = req.path.startsWith("/service-docs/public/file/");
  const requestedQipSiteId = typeof req.query.siteId === "string" ? Number(req.query.siteId) : NaN;
  const ownQipPublicPath = req.path === "/qip/public" && requestedQipSiteId === user.siteId;
  if (
    req.method === "GET" &&
    (
      req.path === `/schools/${user.siteId}/portal`
      || ownSchoolStaffProfilePath.test(req.path)
      || ownSchoolDocumentPath.test(req.path)
      || ownServiceDocsListPath
      || publicServiceDocsFilePath
      || ownQipPublicPath
    )
  ) {
    next();
    return;
  }
  res.status(403).json({ error: "School accounts can only access their own school portal" });
});

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(childrenRouter);
router.use(guardianFinancialRouter); // must precede guardiansRouter to avoid /:email wildcard conflicts
router.use(guardiansRouter);
router.use(staffRouter);
router.use(outcomesRouter);
router.use(observationsRouter);
router.use(programsRouter);
router.use(nqsRouter);
router.use(nqsElementsRouter);
router.use(dashboardRouter);
router.use(noticesRouter);
router.use(jottingsRouter);
router.use(incidentsRouter);
router.use(conditionReportsRouter);
router.use(evacuationsRouter);
router.use(qipRouter);
router.use(serviceDocsRouter);
router.use(wellbeingRouter);
router.use(policiesRouter);
router.use(fileCategoriesRouter);
router.use(fileLibraryRouter);
router.use(checklistsRouter);
router.use(postsRouter);
router.use(professionalDevelopmentRouter);
router.use(planningRouter);
router.use(reportsRouter);
router.use(sitesRouter);
router.use(siteInstructionsRouter);
router.use(welfareNotesRouter);
router.use(storageRouter);
router.use(confidentialNotesRouter);
router.use(staffQualificationsRouter);
router.use(systemAccessRouter);
router.use(appraisalsRouter);
router.use(emailSettingsRouter);
router.use(organisationRouter);
router.use(rollSubmissionsRouter);
router.use(weeklyReviewsRouter);
router.use(settingsAccessRouter);
router.use(notificationsRouter);
router.use(settingsChildrenRouter);
router.use(settingsFeaturesRouter);
router.use(dataImportRouter);
router.use(medicationsRouter);
router.use(behaviouralNotificationsRouter);
router.use(clickupRouter);
router.use(aiToolsRouter);
router.use(schoolsRouter);
router.use(schoolReportsRouter);
router.use(schoolReportSummariesRouter);

export default router;
