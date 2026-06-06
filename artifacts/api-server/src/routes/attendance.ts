import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceRecords, users, leaveRequests } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const CHECK_IN_HOUR = 8;
const CHECK_IN_MINUTE = 0;
const STANDARD_WORK_HOURS = 8;
const OVERTIME_THRESHOLD_HOURS = 9;

function getJakartaDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function calcStatus(checkInTime: Date, latenessMinutes: number): string {
  if (latenessMinutes > 0) return "terlambat";
  return "hadir";
}

function calcMinutes(checkIn: Date, checkOut: Date) {
  const totalMinutes = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000);
  const workMinutes = Math.min(totalMinutes, STANDARD_WORK_HOURS * 60 + 60);

  const expectedCheckInJakarta = new Date(checkIn);
  const jakartaHour = new Date(checkIn.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getHours();
  const jakartaMinute = new Date(checkIn.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })).getMinutes();
  const latenessMinutes = Math.max(0, (jakartaHour - CHECK_IN_HOUR) * 60 + (jakartaMinute - CHECK_IN_MINUTE));

  const overtimeMinutes = totalMinutes > OVERTIME_THRESHOLD_HOURS * 60
    ? totalMinutes - OVERTIME_THRESHOLD_HOURS * 60
    : 0;

  return {
    workMinutes: Math.max(0, workMinutes),
    latenessMinutes,
    overtimeMinutes,
  };
}

router.post("/attendance/check-in", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { selfieBase64, latitude, longitude, accuracy } = req.body;
    const today = getJakartaDate();

    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, req.userId!), eq(attendanceRecords.date, today)))
      .limit(1);

    if (existing?.checkInTime) {
      res.status(409).json({ error: "Anda sudah absen masuk hari ini" });
      return;
    }

    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const latenessMinutes = Math.max(0, (jakartaTime.getHours() - CHECK_IN_HOUR) * 60 + (jakartaTime.getMinutes() - CHECK_IN_MINUTE));
    const status = latenessMinutes > 0 ? "terlambat" : "hadir";

    let record;
    if (existing) {
      const [updated] = await db
        .update(attendanceRecords)
        .set({
          checkInTime: now,
          checkInSelfie: selfieBase64 || null,
          checkInLatitude: latitude || null,
          checkInLongitude: longitude || null,
          checkInAccuracy: accuracy || null,
          status,
          latenessMinutes,
        })
        .where(eq(attendanceRecords.id, existing.id))
        .returning();
      record = updated;
    } else {
      const [inserted] = await db
        .insert(attendanceRecords)
        .values({
          userId: req.userId!,
          date: today,
          checkInTime: now,
          checkInSelfie: selfieBase64 || null,
          checkInLatitude: latitude || null,
          checkInLongitude: longitude || null,
          checkInAccuracy: accuracy || null,
          status,
          latenessMinutes,
        })
        .returning();
      record = inserted;
    }

    res.json(record);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/attendance/check-out", requireAuth, async (req: AuthRequest, res) => {
  try {
    const today = getJakartaDate();

    const [existing] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, req.userId!), eq(attendanceRecords.date, today)))
      .limit(1);

    if (!existing?.checkInTime) {
      res.status(400).json({ error: "Anda belum absen masuk hari ini" });
      return;
    }

    if (existing.checkOutTime) {
      res.status(409).json({ error: "Anda sudah absen keluar hari ini" });
      return;
    }

    const now = new Date();
    const { workMinutes, latenessMinutes, overtimeMinutes } = calcMinutes(existing.checkInTime, now);

    let status = existing.status;
    if (overtimeMinutes > 0) status = "lembur";

    const [updated] = await db
      .update(attendanceRecords)
      .set({
        checkOutTime: now,
        workMinutes,
        latenessMinutes,
        overtimeMinutes,
        status,
      })
      .where(eq(attendanceRecords.id, existing.id))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/attendance/today", requireAuth, async (req: AuthRequest, res) => {
  try {
    const today = getJakartaDate();
    const [record] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, req.userId!), eq(attendanceRecords.date, today)))
      .limit(1);

    res.json(record || null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/attendance/history", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { cycleStart } = req.query as { cycleStart: string };
    if (!cycleStart) {
      res.status(400).json({ error: "cycleStart diperlukan" });
      return;
    }

    const cycleStartDate = new Date(cycleStart);
    const cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
    const cycleEnd = cycleEndDate.toLocaleDateString("en-CA");

    const records = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.userId, req.userId!));

    const filtered = records.filter((r) => r.date >= cycleStart && r.date < cycleEnd);
    res.json(filtered);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/attendance/cycle-summary", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { cycleStart } = req.query as { cycleStart: string };
    if (!cycleStart) {
      res.status(400).json({ error: "cycleStart diperlukan" });
      return;
    }

    const cycleStartDate = new Date(cycleStart);
    const cycleEndDate = new Date(cycleStartDate);
    cycleEndDate.setMonth(cycleEndDate.getMonth() + 1);
    const cycleEnd = cycleEndDate.toLocaleDateString("en-CA");

    const records = await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.userId, req.userId!));

    const filtered = records.filter((r) => r.date >= cycleStart && r.date < cycleEnd);

    const presentDays = filtered.filter((r) => r.status === "hadir" || r.status === "lembur").length;
    const lateDays = filtered.filter((r) => r.status === "terlambat").length;
    const permitDays = filtered.filter((r) => r.status === "izin" || r.status === "sakit").length;
    const absentDays = filtered.filter((r) => r.status === "alpha").length;
    const totalWorkMinutes = filtered.reduce((s, r) => s + (r.workMinutes ?? 0), 0);
    const totalOvertimeMinutes = filtered.reduce((s, r) => s + (r.overtimeMinutes ?? 0), 0);
    const totalLatenessMinutes = filtered.reduce((s, r) => s + (r.latenessMinutes ?? 0), 0);

    const labelDate = new Date(cycleStart);
    const cycleLabel = labelDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    res.json({
      cycleLabel,
      cycleStart,
      presentDays,
      lateDays,
      permitDays,
      absentDays,
      totalWorkMinutes,
      totalOvertimeMinutes,
      totalLatenessMinutes,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
