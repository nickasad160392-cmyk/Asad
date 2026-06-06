import { Router } from "express";
import { db } from "@workspace/db";
import { leaveRequests, users } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query as { status?: string };
    let query = db.select().from(leaveRequests).where(eq(leaveRequests.userId, req.userId!));
    const results = await query;
    const filtered = status ? results.filter((r) => r.status === status) : results;
    res.json(filtered);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/leave", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, startDate, endDate, reason } = req.body;
    if (!type || !startDate || !endDate || !reason) {
      res.status(400).json({ error: "Semua field wajib diisi" });
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      res.status(400).json({ error: "Tanggal selesai tidak boleh sebelum tanggal mulai" });
      return;
    }

    const [inserted] = await db.insert(leaveRequests).values({
      userId: req.userId!,
      type,
      startDate,
      endDate,
      reason,
      status: "pending",
    }).returning();

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
