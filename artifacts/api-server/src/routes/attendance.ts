import { Router } from "express";
import { db, attendanceTable, usersTable, leaveRequestsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import { haversineDistance, OFFICE_LAT, OFFICE_LNG, GEOFENCE_RADIUS_METERS } from "../lib/geo.js";

const router = Router();

const SHIFT_START_HOUR = 8;
const SHIFT_START_MINUTE = 0;
const OVERTIME_START_HOUR = 18;

function getToday(): string {
  return new Date().toISOString().split("T")[0]!;
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
    department: u.department,
    position: u.position,
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
    checkOutLat: r.checkOutLat,
    checkOutLng: r.checkOutLng,
    status: r.status,
    latenessMinutes: r.latenessMinutes,
    overtimeMinutes: r.overtimeMinutes,
    workHours: r.workHours,
    notes: r.notes,
    user: user ? formatUser(user) : undefined,
  };
}

function calcLateness(checkIn: Date): number {
  const shiftStart = new Date(checkIn);
  shiftStart.setHours(SHIFT_START_HOUR, SHIFT_START_MINUTE, 0, 0);
  const diffMs = checkIn.getTime() - shiftStart.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
}

function calcOvertime(checkOut: Date): number {
  const overtimeStart = new Date(checkOut);
  overtimeStart.setHours(OVERTIME_START_HOUR, 0, 0, 0);
  const diffMs = checkOut.getTime() - overtimeStart.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 60000) : 0;
}

function calcWorkHours(checkIn: Date, checkOut: Date): number {
  return (checkOut.getTime() - checkIn.getTime()) / 3600000;
}

router.post("/check-in", requireAuth, async (req, res) => {
  try {
    const { selfieBase64, latitude, longitude, notes } = req.body as {
      selfieBase64: string;
      latitude: number;
      longitude: number;
      notes?: string;
    };

    const distance = haversineDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
    if (distance > GEOFENCE_RADIUS_METERS) {
      res.status(400).json({
        error: `You are ${Math.round(distance)}m from the office. Must be within ${GEOFENCE_RADIUS_METERS}m to check in.`,
      });
      return;
    }

    const today = getToday();
    const [existing] = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.session.userId!), eq(attendanceTable.date, today)))
      .limit(1);

    if (existing?.checkInTime) {
      res.status(400).json({ error: "Already checked in today" });
      return;
    }

    const now = new Date();
    const latenessMinutes = calcLateness(now);
    const status = latenessMinutes > 0 ? "late" : "present";

    let record;
    if (existing) {
      [record] = await db
        .update(attendanceTable)
        .set({
          checkInTime: now,
          checkInSelfie: selfieBase64,
          checkInLat: latitude,
          checkInLng: longitude,
          status,
          latenessMinutes,
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
          status,
          latenessMinutes,
          notes: notes || null,
        })
        .returning();
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.status(201).json(formatRecord(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/check-out", requireAuth, async (req, res) => {
  try {
    const { selfieBase64, latitude, longitude, notes } = req.body as {
      selfieBase64: string;
      latitude: number;
      longitude: number;
      notes?: string;
    };

    const distance = haversineDistance(latitude, longitude, OFFICE_LAT, OFFICE_LNG);
    if (distance > GEOFENCE_RADIUS_METERS) {
      res.status(400).json({
        error: `You are ${Math.round(distance)}m from the office. Must be within ${GEOFENCE_RADIUS_METERS}m to check out.`,
      });
      return;
    }

    const today = getToday();
    const [existing] = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.session.userId!), eq(attendanceTable.date, today)))
      .limit(1);

    if (!existing?.checkInTime) {
      res.status(400).json({ error: "Must check in before checking out" });
      return;
    }

    if (existing.checkOutTime) {
      res.status(400).json({ error: "Already checked out today" });
      return;
    }

    const now = new Date();
    const overtimeMinutes = calcOvertime(now);
    const workHours = calcWorkHours(existing.checkInTime, now);

    const [record] = await db
      .update(attendanceTable)
      .set({
        checkOutTime: now,
        checkOutSelfie: selfieBase64,
        checkOutLat: latitude,
        checkOutLng: longitude,
        overtimeMinutes,
        workHours,
      })
      .where(eq(attendanceTable.id, existing.id))
      .returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(formatRecord(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/today", requireAuth, async (req, res) => {
  try {
    const today = getToday();
    const [record] = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.userId, req.session.userId!), eq(attendanceTable.date, today)))
      .limit(1);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(record ? formatRecord(record, user) : null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const month = (req.query["month"] as string) || getToday().slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.split("-")[0]!), parseInt(month.split("-")[1]!), 0)
      .toISOString()
      .split("T")[0]!;

    const records = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.userId, req.session.userId!),
          gte(attendanceTable.date, startDate),
          lte(attendanceTable.date, endDate),
        ),
      )
      .orderBy(attendanceTable.date);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(records.map((r) => formatRecord(r, user)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/monthly-summary", requireAuth, async (req, res) => {
  try {
    const month = (req.query["month"] as string) || getToday().slice(0, 7);
    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.split("-")[0]!), parseInt(month.split("-")[1]!), 0)
      .toISOString()
      .split("T")[0]!;

    const records = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.userId, req.session.userId!),
          gte(attendanceTable.date, startDate),
          lte(attendanceTable.date, endDate),
        ),
      )
      .orderBy(attendanceTable.date);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);

    const present = records.filter((r) => r.status === "present").length;
    const late = records.filter((r) => r.status === "late").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const permit = records.filter((r) => r.status === "permit").length;
    const totalWorkHours = records.reduce((sum, r) => sum + (r.workHours || 0), 0);
    const totalOvertime = records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0);
    const totalLateness = records.reduce((sum, r) => sum + (r.latenessMinutes || 0), 0);

    res.json({
      month,
      totalWorkDays: records.length,
      presentDays: present,
      lateDays: late,
      absentDays: absent,
      permitDays: permit,
      totalWorkHours,
      totalOvertimeMinutes: totalOvertime,
      totalLatenessMinutes: totalLateness,
      records: records.map((r) => formatRecord(r, user)),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const month = (req.query["month"] as string) || getToday().slice(0, 7);
    const userId = req.query["userId"] ? parseInt(req.query["userId"] as string) : undefined;

    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.split("-")[0]!), parseInt(month.split("-")[1]!), 0)
      .toISOString()
      .split("T")[0]!;

    const conditions = [
      gte(attendanceTable.date, startDate),
      lte(attendanceTable.date, endDate),
    ];
    if (userId) {
      conditions.push(eq(attendanceTable.userId, userId));
    }

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
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/all", requireAdmin, async (req, res) => {
  try {
    const month = (req.query["month"] as string) || getToday().slice(0, 7);
    const userId = req.query["userId"] ? parseInt(req.query["userId"] as string) : undefined;

    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(month.split("-")[0]!), parseInt(month.split("-")[1]!), 0)
      .toISOString()
      .split("T")[0]!;

    const conditions = [
      gte(attendanceTable.date, startDate),
      lte(attendanceTable.date, endDate),
    ];
    if (userId) {
      conditions.push(eq(attendanceTable.userId, userId));
    }

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
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
