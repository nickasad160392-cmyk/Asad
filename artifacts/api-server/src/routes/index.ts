import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import attendanceRouter from "./attendance.js";
import leaveRouter from "./leave.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(attendanceRouter);
router.use(leaveRouter);
router.use(adminRouter);

export default router;
