import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

function userToProfile(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    jabatan: u.jabatan,
    position: u.jabatan,
    employeeId: u.employeeId,
    phone: u.phone,
    isActive: u.isActive,
  };
}

router.post("/auth/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: "Email/ID dan kata sandi wajib diisi" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.employeeId, identifier)))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Email/ID atau kata sandi salah" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Akun Anda tidak aktif. Hubungi admin." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Email/ID atau kata sandi salah" });
      return;
    }

    const token = signToken(user.id);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ user: userToProfile(user), token });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Nama, email, dan kata sandi wajib diisi" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Kata sandi minimal 6 karakter" });
      return;
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      res.status(409).json({ error: "Email sudah terdaftar" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [user] = await db.insert(users).values({
      name,
      email,
      passwordHash,
      phone: phone || null,
      role: "employee",
    }).returning();

    const token = signToken(user!.id);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ user: userToProfile(user!), token });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(userToProfile(user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
