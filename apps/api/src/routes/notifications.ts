import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } })
    ]);
    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", authenticate, async (req, res, next) => {
  try {
    const isRead = z.boolean().safeParse(req.body?.isRead);
    if (!isRead.success) throw new HttpError(400, "Read state must be true or false.");
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: isRead.data }
    });
    if (!result.count) throw new HttpError(404, "Notification not found.");
    res.json({ isRead: isRead.data });
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ message: "All notifications marked as read." });
  } catch (error) {
    next(error);
  }
});

router.get("/preferences", authenticate, async (req, res, next) => {
  try {
    const preference = await prisma.notificationPreference.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id },
      update: {}
    });
    res.json({ preference });
  } catch (error) {
    next(error);
  }
});

router.patch("/preferences", authenticate, async (req, res, next) => {
  try {
    const parsed = z.object({ emailEnabled: z.boolean(), pushEnabled: z.boolean() }).partial().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Choose at least one notification preference.");
    const preference = await prisma.notificationPreference.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...parsed.data },
      update: parsed.data
    });
    res.json({ preference });
  } catch (error) {
    next(error);
  }
});

export default router;
