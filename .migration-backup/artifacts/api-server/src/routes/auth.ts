import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

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
    createdAt: u.createdAt.toISOString(),
  };
}

router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body as { identifier: string; password: string };

    if (!identifier || !password) {
      res.status(400).json({ error: "Identifier dan password wajib diisi" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, identifier), eq(usersTable.employeeId, identifier)))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Email atau ID karyawan tidak ditemukan" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Akun Anda telah dinonaktifkan. Hubungi Admin HR." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Password salah" });
      return;
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;

    res.json({ user: formatUser(user), message: "Login berhasil" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body as {
      name: string;
      email: string;
      password: string;
      phone?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password minimal 6 karakter" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (existing) {
      res.status(400).json({ error: "Email sudah terdaftar" });
      return;
    }

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const count = Number(countResult[0]?.count || 0);
    const employeeId = `EMP${String(count + 1).padStart(3, "0")}`;

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        employeeId,
        name,
        email,
        passwordHash,
        role: "employee",
        jabatan: "",
        department: "General",
        position: "Karyawan",
        phone: phone || null,
        isActive: true,
      })
      .returning();

    req.session.userId = user!.id;
    req.session.userRole = user!.role;

    res.status(201).json({ user: formatUser(user!), message: "Registrasi berhasil" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logout berhasil" });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Pengguna tidak ditemukan" });
      return;
    }

    res.json(formatUser(user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
