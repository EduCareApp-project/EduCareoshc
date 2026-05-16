import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import childrenRouter from "./children";
import guardiansRouter from "./guardians";
import staffRouter from "./staff";
import outcomesRouter from "./outcomes";
import observationsRouter from "./observations";
import programsRouter from "./programs";
import nqsRouter from "./nqs";
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
import welfareNotesRouter from "./welfare-notes";
import storageRouter from "./storage";
import confidentialNotesRouter from "./confidential-notes";
import staffQualificationsRouter from "./staff-qualifications";
import systemAccessRouter from "./system-access";

const router: IRouter = Router();

// ── Public routes (no auth required) ──────────────────────────────────────────
router.use(healthRouter);
router.use(authRouter);

// Allow unauthenticated access to public pages and storage (for public assets)
router.use("/qip/public", (req: Request, res: Response, next: NextFunction) => next());
router.use("/service-docs/public", (req: Request, res: Response, next: NextFunction) => next());

// ── Auth guard ────────────────────────────────────────────────────────────────
router.use((req: Request, res: Response, next: NextFunction): void => {
  // Skip public paths already handled above
  if (req.path === "/qip/public" || req.path === "/service-docs/public") {
    next();
    return;
  }
  if (!req.session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(childrenRouter);
router.use(guardiansRouter);
router.use(staffRouter);
router.use(outcomesRouter);
router.use(observationsRouter);
router.use(programsRouter);
router.use(nqsRouter);
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
router.use(welfareNotesRouter);
router.use(storageRouter);
router.use(confidentialNotesRouter);
router.use(staffQualificationsRouter);
router.use(systemAccessRouter);

export default router;
