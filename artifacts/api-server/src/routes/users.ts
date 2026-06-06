import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
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

router.get("/", requireAdmin, async (req, res) => {
  try {
    const isActiveFilter = req.query["isActive"];
    let query = db.select().from(usersTable).orderBy(usersTable.name);

    if (isActiveFilter !== undefined) {
      const isActive = isActiveFilter === "true";
      const users = await db.select().from(usersTable).where(eq(usersTable.isActive, isActive)).orderBy(usersTable.name);
      res.json(users.map(formatUser));
      return;
    }

    const users = await query;
    res.json(users.map(formatUser));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const { name, phone } = req.body as { name?: string; phone?: string };

    const [user] = await db
      .update(usersTable)
      .set({
        ...(name ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, req.session.userId!))
      .returning();

    if (!user) {
      res.status(404).json({ error: "Pengguna tidak ditemukan" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);

    if (!user) {
      res.status(404).json({ error: "Karyawan tidak ditemukan" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, jabatan, department, phone, isActive } = req.body as {
      name?: string;
      jabatan?: string;
      department?: string;
      phone?: string;
      isActive?: boolean;
    };

    const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (jabatan !== undefined) updates.jabatan = jabatan;
    if (department !== undefined) updates.department = department;
    if (phone !== undefined) updates.phone = phone;
    if (isActive !== undefined) updates.isActive = isActive;

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) {
      res.status(404).json({ error: "Karyawan tidak ditemukan" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { newPassword } = req.body as { newPassword: string };

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "Password minimal 6 karakter" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const [user] = await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) {
      res.status(404).json({ error: "Karyawan tidak ditemukan" });
      return;
    }

    res.json({ message: "Password berhasil direset" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
