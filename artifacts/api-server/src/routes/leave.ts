import { Router } from "express";
import { db, leaveRequestsTable, usersTable, attendanceTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
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
    department: u.department,
    position: u.position,
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
    const month = req.query["month"] as string | undefined;
    let conditions = [eq(leaveRequestsTable.userId, req.session.userId!)];

    if (month) {
      const startDate = `${month}-01`;
      const endDate = new Date(parseInt(month.split("-")[0]!), parseInt(month.split("-")[1]!), 0)
        .toISOString()
        .split("T")[0]!;
      conditions.push(gte(leaveRequestsTable.startDate, startDate));
      conditions.push(lte(leaveRequestsTable.endDate, endDate));
    }

    const records = await db
      .select()
      .from(leaveRequestsTable)
      .where(and(...conditions))
      .orderBy(leaveRequestsTable.createdAt);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
    res.json(records.map((r) => formatLeave(r, user)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
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
    res.status(201).json(formatLeave(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const status = req.query["status"] as string | undefined;
    const conditions = status ? [eq(leaveRequestsTable.status, status)] : [];

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
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);

    const [leave] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, id)).limit(1);
    if (!leave) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }

    const [record] = await db
      .update(leaveRequestsTable)
      .set({
        status: "approved",
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequestsTable.id, id))
      .returning();

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
          status: "permit",
          notes: `${leave.type} - ${leave.reason}`,
        });
      } else {
        await db
          .update(attendanceTable)
          .set({ status: "permit" })
          .where(eq(attendanceTable.id, existing.id));
      }
      current.setDate(current.getDate() + 1);
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, leave.userId)).limit(1);
    res.json(formatLeave(record!, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"]!);
    const { reason } = (req.body as { reason?: string }) || {};

    const [record] = await db
      .update(leaveRequestsTable)
      .set({
        status: "rejected",
        rejectionReason: reason || null,
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequestsTable.id, id))
      .returning();

    if (!record) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId)).limit(1);
    res.json(formatLeave(record, user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
