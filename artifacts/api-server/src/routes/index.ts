import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import attendanceRouter from "./attendance.js";
import leaveRouter from "./leave.js";
import usersRouter from "./users.js";
import notificationsRouter from "./notifications.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/attendance", attendanceRouter);
router.use("/leave", leaveRouter);
router.use("/users", usersRouter);
router.use("/notifications", notificationsRouter);

export default router;
