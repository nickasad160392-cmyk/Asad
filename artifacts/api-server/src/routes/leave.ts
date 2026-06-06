import { Router } from "express";
import { db, leaveRequestsTable, usersTable, attendanceTable, notificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();

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

function formatLeave(
  r: typeof leaveRequestsTable.$inferSelect,
  user?: typeof usersTable.$inferSelect,
) {
  return {
    id: r.id,
    userId: r.userId,
    type: r.type,
    startDate: r.startDate,
    endDate: r.endDate,
    reason: r.reason,
    status: r.status,
    adminNote: r.adminNote,
    rejectionReason: r.rejectionReason,
    reviewedBy: r.reviewedBy,
    reviewedAt: toISO(r.reviewedAt),
    attachmentBase64: r.attachmentBase64,
    createdAt: toISO(r.createdAt)!,
    user: user ? formatUser(user) : undefined,
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const statusFilter = req.query["status"] as string | undefined;
    const conditions: ReturnType<typeof eq>[] = [eq(leaveRequestsTable.userId, req.session.userId!)];
    if (statusFilter) conditions.push(eq(leaveRequestsTable.status, statusFilter));

    const records = await db
      .select()
      .from(leaveRequestsTable)
      .where(and(...conditions))
      .orderBy(leaveRequestsTable.createdAt);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(records.map((r) => formatLeave(r, user)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { type, startDate, endDate, reason, attachmentBase64 } = req.body as {
      type: string;
      startDate: string;
      endDate: string;
      reason: string;
      attachmentBase64?: string;
    };

    if (!type || !startDate || !endDate || !reason) {
      res.status(400).json({ error: "Semua field wajib diisi" });
      return;
    }

    const [record] = await db
      .insert(leaveRequestsTable)
      .values({
        userId: req.session.userId!,
        type,
        startDate,
        endDate,
        reason,
        status: "pending",
        attachmentBase64: attachmentBase64 || null,
      })
      .returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);

    const admins = await db
      .select()
      .from(usersTable)
      .where(sql`${usersTable.role} IN ('admin', 'hr')`);

    for (const admin of admins) {
      await db.insert(notificationsTable).values({
        userId: admin.id,
        title: "Pengajuan Izin Baru",
        message: `${user?.name || "Karyawan"} mengajukan izin ${type} dari ${startDate} s/d ${endDate}`,
        type: "leave_request",
        isRead: false,
      });
    }

    res.status(201).json(formatLeave(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const status = req.query["status"] as string | undefined;
    const userId = req.query["userId"] ? parseInt(req.query["userId"] as string) : undefined;
    const conditions = [];
    if (status) conditions.push(eq(leaveRequestsTable.status, status));
    if (userId) conditions.push(eq(leaveRequestsTable.userId, userId));

    const records = await db
      .select()
      .from(leaveRequestsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(leaveRequestsTable.createdAt);

    const userIds = [...new Set(records.map((r) => r.userId))];
    const users = userIds.length
      ? await db.select().from(usersTable).where(sql`${usersTable.id} = ANY(${userIds})`)
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json(records.map((r) => formatLeave(r, userMap.get(r.userId))));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.patch("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { adminNote } = req.body as { adminNote?: string };

    const [leave] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, id)).limit(1);
    if (!leave) {
      res.status(404).json({ error: "Pengajuan tidak ditemukan" });
      return;
    }

    const [record] = await db
      .update(leaveRequestsTable)
      .set({
        status: "approved",
        adminNote: adminNote || null,
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequestsTable.id, id))
      .returning();

    const leaveStatus = leave.type === "sakit" ? "sakit" : "izin";
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0]!;
      const [existing] = await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.userId, leave.userId), eq(attendanceTable.date, dateStr)))
        .limit(1);

      if (!existing) {
        await db.insert(attendanceTable).values({
          userId: leave.userId,
          date: dateStr,
          status: leaveStatus,
          notes: `${leave.type} - ${leave.reason}`,
        });
      } else {
        await db
          .update(attendanceTable)
          .set({ status: leaveStatus })
          .where(eq(attendanceTable.id, existing.id));
      }
      current.setDate(current.getDate() + 1);
    }

    await db.insert(notificationsTable).values({
      userId: leave.userId,
      title: "Izin Disetujui ✅",
      message: `Pengajuan izin ${leave.type} Anda dari ${leave.startDate} s/d ${leave.endDate} telah disetujui.`,
      type: "leave_approved",
      isRead: false,
    });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, leave.userId)).limit(1);
    res.json(formatLeave(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.patch("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { adminNote } = (req.body as { adminNote?: string }) || {};

    const [record] = await db
      .update(leaveRequestsTable)
      .set({
        status: "rejected",
        adminNote: adminNote || null,
        rejectionReason: adminNote || null,
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequestsTable.id, id))
      .returning();

    if (!record) {
      res.status(404).json({ error: "Pengajuan tidak ditemukan" });
      return;
    }

    await db.insert(notificationsTable).values({
      userId: record.userId,
      title: "Izin Ditolak ❌",
      message: `Pengajuan izin ${record.type} Anda dari ${record.startDate} s/d ${record.endDate} ditolak.${adminNote ? ` Alasan: ${adminNote}` : ""}`,
      type: "leave_rejected",
      isRead: false,
    });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1);
    res.json(formatLeave(record, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
