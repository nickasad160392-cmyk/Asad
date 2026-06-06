import { Router } from "express";
import { db, attendanceTable, usersTable, leaveRequestsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

const SHIFT_START_HOUR = 8;
const OVERTIME_START_HOUR = 18;
const TOLERANCE_END_HOUR = 16;
const LUNCH_START = 12;
const LUNCH_END = 13;

function getWIBNow(): Date {
  const now = new Date();
  return now;
}

function getWIBDateStr(d?: Date): string {
  const date = d || getWIBNow();
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

function getCurrentCycle(date: Date): { start: string; end: string; label: string } {
  const jakartaStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const [year, month, day] = jakartaStr.split("-").map(Number) as [number, number, number];

  let startMonth = month - 1;
  let startYear = year;

  if (day < 7) {
    startMonth -= 1;
    if (startMonth < 0) { startMonth = 11; startYear -= 1; }
  }

  const endMonth = startMonth + 1 > 11 ? 0 : startMonth + 1;
  const endYear = startMonth + 1 > 11 ? startYear + 1 : startYear;

  const start = `${startYear}-${String(startMonth + 1).padStart(2, "0")}-07`;
  const end = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-06`;

  const startDate = new Date(startYear, startMonth, 7);
  const label = startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return { start, end, label };
}

function toISO(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : d;
}

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    employeeId: u.employeeId,
    name: u.name,
    email: u.email,
    role: u.role,
    jabatan: u.jabatan || "",
    department: u.department,
    position: u.position,
    phone: u.phone,
    isActive: u.isActive,
    avatarUrl: u.avatarUrl,
    createdAt: toISO(u.createdAt)!,
  };
}

function formatRecord(
  r: typeof attendanceTable.$inferSelect,
  user?: typeof usersTable.$inferSelect,
) {
  return {
    id: r.id,
    userId: r.userId,
    date: r.date,
    checkInTime: toISO(r.checkInTime),
    checkOutTime: toISO(r.checkOutTime),
    checkInSelfie: r.checkInSelfie,
    checkOutSelfie: r.checkOutSelfie,
    checkInLat: r.checkInLat,
    checkInLng: r.checkInLng,
    checkInAccuracy: r.checkInAccuracy,
    checkOutLat: r.checkOutLat,
    checkOutLng: r.checkOutLng,
    checkOutAccuracy: r.checkOutAccuracy,
    status: r.status,
    latenessMinutes: r.latenessMinutes,
    overtimeMinutes: r.overtimeMinutes,
    workMinutes: r.workMinutes,
    cycleStart: r.cycleStart,
    cycleEnd: r.cycleEnd,
    notes: r.notes,
    createdAt: toISO(r.createdAt)!,
    user: user ? formatUser(user) : undefined,
  };
}

function calcLatenessMinutes(checkIn: Date): number {
  const shiftStart = new Date(checkIn);
  shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
  const diffMs = checkIn.getTime() - shiftStart.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
}

function calcOvertimeMinutes(checkOut: Date): number {
  const overtimeStart = new Date(checkOut);
  overtimeStart.setHours(OVERTIME_START_HOUR, 0, 0, 0);
  const diffMs = checkOut.getTime() - overtimeStart.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
}

function calcWorkMinutes(checkIn: Date, checkOut: Date): number {
  const effectiveEnd = new Date(checkOut);
  if (effectiveEnd.getHours() > TOLERANCE_END_HOUR || 
      (effectiveEnd.getHours() === TOLERANCE_END_HOUR && effectiveEnd.getMinutes() > 0)) {
    effectiveEnd.setHours(TOLERANCE_END_HOUR, 0, 0, 0);
  }

  let workMs = Math.max(0, effectiveEnd.getTime() - checkIn.getTime());

  const inHour = checkIn.getHours() + checkIn.getMinutes() / 60;
  const outHour = effectiveEnd.getHours() + effectiveEnd.getMinutes() / 60;
  if (inHour < LUNCH_END && outHour > LUNCH_START) {
    const overlapStart = Math.max(inHour, LUNCH_START);
    const overlapEnd = Math.min(outHour, LUNCH_END);
    if (overlapEnd > overlapStart) {
      workMs -= (overlapEnd - overlapStart) * 3600000;
    }
  }

  return Math.max(0, Math.floor(workMs / 60000));
}

router.post("/check-in", requireAuth, async (req, res) => {
  try {
    const { selfieBase64, latitude, longitude, accuracy, notes } = req.body as {
      selfieBase64: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      notes?: string;
    };

    const today = getWIBDateStr();
    const cycle = getCurrentCycle(getWIBNow());

    const [existing] = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.session.userId!), eq(attendanceTable.date, today)))
      .limit(1);

    if (existing?.checkInTime) {
      res.status(400).json({ error: "Anda sudah absen masuk hari ini" });
      return;
    }

    const now = getWIBNow();
    const latenessMinutes = calcLatenessMinutes(now);
    const status = latenessMinutes > 0 ? "terlambat" : "hadir";

    let record;
    if (existing) {
      [record] = await db
        .update(attendanceTable)
        .set({
          checkInTime: now,
          checkInSelfie: selfieBase64,
          checkInLat: latitude,
          checkInLng: longitude,
          checkInAccuracy: accuracy || null,
          status,
          latenessMinutes,
          cycleStart: cycle.start,
          cycleEnd: cycle.end,
          notes: notes || null,
        })
        .where(eq(attendanceTable.id, existing.id))
        .returning();
    } else {
      [record] = await db
        .insert(attendanceTable)
        .values({
          userId: req.session.userId!,
          date: today,
          checkInTime: now,
          checkInSelfie: selfieBase64,
          checkInLat: latitude,
          checkInLng: longitude,
          checkInAccuracy: accuracy || null,
          status,
          latenessMinutes,
          cycleStart: cycle.start,
          cycleEnd: cycle.end,
          notes: notes || null,
        })
        .returning();
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.status(201).json(formatRecord(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/check-out", requireAuth, async (req, res) => {
  try {
    const { selfieBase64, latitude, longitude, accuracy, notes } = req.body as {
      selfieBase64: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      notes?: string;
    };

    const today = getWIBDateStr();
    const [existing] = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.session.userId!), eq(attendanceTable.date, today)))
      .limit(1);

    if (!existing?.checkInTime) {
      res.status(400).json({ error: "Anda belum absen masuk hari ini" });
      return;
    }

    if (existing.checkOutTime) {
      res.status(400).json({ error: "Anda sudah absen keluar hari ini" });
      return;
    }

    const now = getWIBNow();
    const overtimeMinutes = calcOvertimeMinutes(now);
    const workMinutes = calcWorkMinutes(existing.checkInTime, now);
    const status = overtimeMinutes > 0 ? "lembur" : existing.status;

    const [record] = await db
      .update(attendanceTable)
      .set({
        checkOutTime: now,
        checkOutSelfie: selfieBase64,
        checkOutLat: latitude,
        checkOutLng: longitude,
        checkOutAccuracy: accuracy || null,
        overtimeMinutes,
        workMinutes,
        workHours: workMinutes / 60,
        status,
        notes: notes || existing.notes,
      })
      .where(eq(attendanceTable.id, existing.id))
      .returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(formatRecord(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/today", requireAuth, async (req, res) => {
  try {
    const today = getWIBDateStr();
    const [record] = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.session.userId!), eq(attendanceTable.date, today)))
      .limit(1);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(record ? formatRecord(record, user) : null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/cycle-summary", requireAuth, async (req, res) => {
  try {
    const now = getWIBNow();
    let { start, end, label } = getCurrentCycle(now);

    if (req.query["cycleStart"]) {
      const cs = req.query["cycleStart"] as string;
      start = cs;
      const [y, m] = cs.split("-").map(Number) as [number, number];
      const endMonth = m > 11 ? 0 : m;
      const endYear = m > 11 ? y + 1 : y;
      end = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-06`;
      label = new Date(y, m - 1, 7).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }

    const records = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.userId, req.session.userId!),
          gte(attendanceTable.date, start),
          lte(attendanceTable.date, end),
        ),
      )
      .orderBy(attendanceTable.date);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);

    const totalWorkMinutes = records.reduce((sum, r) => sum + (r.workMinutes || 0), 0);
    const totalOvertimeMinutes = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
    const totalLatenessMinutes = records.reduce((sum, r) => sum + (r.latenessMinutes || 0), 0);
    const presentDays = records.filter((r) => r.status === "hadir" || r.status === "lembur").length;
    const lateDays = records.filter((r) => r.status === "terlambat").length;
    const permitDays = records.filter((r) => r.status === "izin" || r.status === "sakit").length;
    const absentDays = records.filter((r) => r.status === "alpha").length;

    res.json({
      cycleStart: start,
      cycleEnd: end,
      cycleLabel: label,
      totalWorkMinutes,
      totalOvertimeMinutes,
      totalLatenessMinutes,
      presentDays,
      lateDays,
      permitDays,
      absentDays,
      records: records.map((r) => formatRecord(r, user)),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const now = getWIBNow();
    let { start, end } = getCurrentCycle(now);

    if (req.query["cycleStart"]) {
      const cs = req.query["cycleStart"] as string;
      start = cs;
      const [y, m] = cs.split("-").map(Number) as [number, number];
      const endMonth = m > 11 ? 0 : m;
      const endYear = m > 11 ? y + 1 : y;
      end = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-06`;
    }

    const records = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.userId, req.session.userId!),
          gte(attendanceTable.date, start),
          lte(attendanceTable.date, end),
        ),
      )
      .orderBy(attendanceTable.date);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(records.map((r) => formatRecord(r, user)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/admin/today", requireAdmin, async (req, res) => {
  try {
    const today = getWIBDateStr();
    const allUsers = await db.select().from(usersTable).where(eq(usersTable.isActive, true));

    const records = await db
      .select()
      .from(attendanceTable)
      .where(eq(attendanceTable.date, today));

    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    res.json({
      date: today,
      totalEmployees: allUsers.length,
      checkedIn: records.filter((r) => r.checkInTime).length,
      checkedOut: records.filter((r) => r.checkOutTime).length,
      notYet: allUsers.length - records.filter((r) => r.checkInTime).length,
      records: records.map((r) => formatRecord(r, userMap.get(r.userId))),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const now = getWIBNow();
    let { start, end } = getCurrentCycle(now);

    if (req.query["cycleStart"]) {
      const cs = req.query["cycleStart"] as string;
      start = cs;
      const [y, m] = cs.split("-").map(Number) as [number, number];
      const endMonth = m > 11 ? 0 : m;
      const endYear = m > 11 ? y + 1 : y;
      end = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-06`;
    }

    if (req.query["date"]) {
      start = req.query["date"] as string;
      end = req.query["date"] as string;
    }

    const userId = req.query["userId"] ? parseInt(req.query["userId"] as string) : undefined;

    const conditions = [
      gte(attendanceTable.date, start),
      lte(attendanceTable.date, end),
    ];
    if (userId) conditions.push(eq(attendanceTable.userId, userId));

    const records = await db
      .select()
      .from(attendanceTable)
      .where(and(...conditions))
      .orderBy(attendanceTable.date);

    const userIds = [...new Set(records.map((r) => r.userId))];
    const users = userIds.length
      ? await db.select().from(usersTable).where(sql`${usersTable.id} = ANY(${userIds})`)
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json(records.map((r) => formatRecord(r, userMap.get(r.userId))));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
