import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

function formatNotif(n: typeof notificationsTable.$inferSelect) {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    message: n.message,
    type: n.type,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const unreadOnly = req.query["unreadOnly"] === "true";
    const conditions = [eq(notificationsTable.userId, req.session.userId!)];
    if (unreadOnly) conditions.push(eq(notificationsTable.isRead, false));

    const notifs = await db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(notificationsTable.createdAt);

    res.json(notifs.map(formatNotif));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);

    const [notif] = await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.session.userId!)))
      .returning();

    if (!notif) {
      res.status(404).json({ error: "Notifikasi tidak ditemukan" });
      return;
    }

    res.json(formatNotif(notif));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

router.post("/read-all", requireAuth, async (req, res) => {
  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.session.userId!));

    res.json({ message: "Semua notifikasi ditandai sudah dibaca" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Terjadi kesalahan server" });
  }
});

export default router;
