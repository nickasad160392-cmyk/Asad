import { Router } from "express";
import { db, attendanceTable, usersTable, leaveRequestsTable } from "@workspace/db";
import { eq, and, gte, lte, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function getToday(): string {
  return new Date().toISOString().split("T")[0]!;
}

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const month = (req.query["month"] as string) || getToday().slice(0, 7);
    const today = getToday();
    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.split("-")[0]!), parseInt(month.split("-")[1]!), 0)
      .toISOString()
      .split("T")[0]!;

    const [totalResult] = await db.select({ count: count() }).from(usersTable);
    const totalEmployees = totalResult?.count ?? 0;

    const todayRecords = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, today));

    const presentToday = todayRecords.filter((r) => r.status === "present" || r.status === "late").length;
    const lateToday = todayRecords.filter((r) => r.status === "late").length;
    const absentToday = Number(totalEmployees) - presentToday;

    const [pendingResult] = await db
      .select({ count: count() })
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.status, "pending"));
    const pendingLeaveRequests = pendingResult?.count ?? 0;

    const monthlyRecords = await db
      .select()
      .from(attendanceTable)
      .where(and(gte(attendanceTable.date, startDate), lte(attendanceTable.date, endDate)));

    const workingDays = monthlyRecords.length;
    const presentRecords = monthlyRecords.filter((r) => r.status === "present" || r.status === "late" || r.status === "permit").length;
    const monthlyAttendanceRate = workingDays > 0 ? (presentRecords / workingDays) * 100 : 0;

    const totalWorkHours = monthlyRecords.reduce((sum, r) => sum + (r.workHours || 0), 0);
    const avgWorkHours = workingDays > 0 ? totalWorkHours / workingDays : 0;

    res.json({
      month,
      totalEmployees: Number(totalEmployees),
      presentToday,
      lateToday,
      absentToday: Math.max(0, absentToday),
      pendingLeaveRequests: Number(pendingLeaveRequests),
      monthlyAttendanceRate: Math.round(monthlyAttendanceRate * 10) / 10,
      avgWorkHours: Math.round(avgWorkHours * 10) / 10,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
