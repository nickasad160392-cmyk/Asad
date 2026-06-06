import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { attendanceRecords, users, leaveRequests } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireAdmin, loadUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth, loadUser, requireAdmin);

function userToProfile(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    jabatan: u.jabatan,
    employeeId: u.employeeId,
    phone: u.phone,
    isActive: u.isActive,
  };
}

router.get("/admin/attendance/today", async (req: AuthRequest, res) => {
  try {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

    const records = await db
      .select({
        id: attendanceRecords.id,
        userId: attendanceRecords.userId,
        date: attendanceRecords.date,
        checkInTime: attendanceRecords.checkInTime,
        checkOutTime: attendanceRecords.checkOutTime,
        status: attendanceRecords.status,
        workMinutes: attendanceRecords.workMinutes,
        overtimeMinutes: attendanceRecords.overtimeMinutes,
        latenessMinutes: attendanceRecords.latenessMinutes,
        userName: users.name,
        userJabatan: users.jabatan,
        userEmployeeId: users.employeeId,
      })
      .from(attendanceRecords)
      .leftJoin(users, eq(attendanceRecords.userId, users.id))
      .where(eq(attendanceRecords.date, today));

    const formatted = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      date: r.date,
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime,
      status: r.status,
      workMinutes: r.workMinutes,
      overtimeMinutes: r.overtimeMinutes,
      latenessMinutes: r.latenessMinutes,
      user: { id: r.userId, name: r.userName ?? "", jabatan: r.userJabatan, employeeId: r.userEmployeeId },
    }));

    res.json({ date: today, records: formatted });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/admin/attendance", async (req: AuthRequest, res) => {
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
      .select({
        id: attendanceRecords.id,
        userId: attendanceRecords.userId,
        date: attendanceRecords.date,
        checkInTime: attendanceRecords.checkInTime,
        checkOutTime: attendanceRecords.checkOutTime,
        status: attendanceRecords.status,
        workMinutes: attendanceRecords.workMinutes,
        overtimeMinutes: attendanceRecords.overtimeMinutes,
        latenessMinutes: attendanceRecords.latenessMinutes,
        userName: users.name,
        userJabatan: users.jabatan,
        userEmployeeId: users.employeeId,
      })
      .from(attendanceRecords)
      .leftJoin(users, eq(attendanceRecords.userId, users.id));

    const filtered = records
      .filter((r) => r.date >= cycleStart && r.date < cycleEnd)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        date: r.date,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        status: r.status,
        workMinutes: r.workMinutes,
        overtimeMinutes: r.overtimeMinutes,
        latenessMinutes: r.latenessMinutes,
        user: { id: r.userId, name: r.userName ?? "", jabatan: r.userJabatan, employeeId: r.userEmployeeId },
      }));

    res.json(filtered);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/admin/leave", async (req: AuthRequest, res) => {
  try {
    const { status } = req.query as { status?: string };

    const leaves = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        type: leaveRequests.type,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        adminNote: leaveRequests.adminNote,
        createdAt: leaveRequests.createdAt,
        userName: users.name,
        userJabatan: users.jabatan,
        userEmployeeId: users.employeeId,
      })
      .from(leaveRequests)
      .leftJoin(users, eq(leaveRequests.userId, users.id));

    const filtered = status ? leaves.filter((l) => l.status === status) : leaves;
    const formatted = filtered.map((l) => ({
      id: l.id,
      userId: l.userId,
      type: l.type,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
      status: l.status,
      adminNote: l.adminNote,
      createdAt: l.createdAt,
      user: { id: l.userId, name: l.userName ?? "", jabatan: l.userJabatan, employeeId: l.userEmployeeId },
    }));

    res.json(formatted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/admin/leave/:id/approve", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { adminNote } = req.body;

    const [updated] = await db
      .update(leaveRequests)
      .set({ status: "approved", adminNote: adminNote || null })
      .where(eq(leaveRequests.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Pengajuan tidak ditemukan" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/admin/leave/:id/reject", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { adminNote } = req.body;

    const [updated] = await db
      .update(leaveRequests)
      .set({ status: "rejected", adminNote: adminNote || null })
      .where(eq(leaveRequests.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Pengajuan tidak ditemukan" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/admin/users", async (req: AuthRequest, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers.map(userToProfile));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.patch("/admin/users/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { jabatan, role, isActive } = req.body;

    const updates: Partial<typeof users.$inferInsert> = {};
    if (jabatan !== undefined) updates.jabatan = jabatan;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Karyawan tidak ditemukan" });
      return;
    }

    res.json(userToProfile(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/admin/users/:id/reset-password", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "Kata sandi minimal 6 karakter" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const [updated] = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Karyawan tidak ditemukan" });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
