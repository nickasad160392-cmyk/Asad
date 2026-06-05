import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import attendanceRouter from "./attendance.js";
import leaveRouter from "./leave.js";
import usersRouter from "./users.js";
import dashboardRouter from "./dashboard.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/attendance", attendanceRouter);
router.use("/leave-requests", leaveRouter);
router.use("/users", usersRouter);
router.use("/dashboard", dashboardRouter);

export default router;
