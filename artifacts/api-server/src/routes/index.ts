import { Router, type IRouter } from "express";
import healthRouter from "./health";
import childrenRouter from "./children";
import staffRouter from "./staff";
import outcomesRouter from "./outcomes";
import observationsRouter from "./observations";
import programsRouter from "./programs";
import nqsRouter from "./nqs";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(childrenRouter);
router.use(staffRouter);
router.use(outcomesRouter);
router.use(observationsRouter);
router.use(programsRouter);
router.use(nqsRouter);
router.use(dashboardRouter);

export default router;
