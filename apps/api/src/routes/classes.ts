import { Department, NotificationType, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { config } from "../lib/config.js";
import { HttpError } from "../lib/errors.js";
import { notifyUsers } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

async function dailyRequest(path: string, body: object) {
  if (!config.DAILY_API_KEY) throw new HttpError(503, "Live classes are not configured. Contact your administrator.");
  const response = await fetch(`https://api.daily.co/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.DAILY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json() as { error?: string; info?: string; name?: string; url?: string; token?: string };
  if (!response.ok) throw new HttpError(502, result.info || result.error || "Live class provider request failed.");
  return result;
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const sessions = await prisma.classSession.findMany({
      where: {
        course: {
          department: req.user!.department as Department,
          ...(req.user!.role === Role.STUDENT ? { level: req.user!.level } : {})
        }
      },
      include: { course: { select: { code: true, title: true } }, host: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" }
    });
    res.json({ classes: sessions });
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), async (req, res, next) => {
  try {
    const parsed = z.object({
      title: z.string().trim().min(3).max(160),
      courseId: z.string().cuid(),
      scheduledAt: z.string().datetime()
    }).safeParse(req.body);
    if (!parsed.success || new Date(parsed.data.scheduledAt) <= new Date()) {
      throw new HttpError(400, "Enter a title, course, and future class date.");
    }
    const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
    if (!course || (req.user!.role !== Role.ADMIN && course.department !== req.user!.department)) {
      throw new HttpError(404, "Course not found.");
    }
    const session = await prisma.classSession.create({
      data: { ...parsed.data, scheduledAt: new Date(parsed.data.scheduledAt), hostId: req.user!.id },
      include: { course: { select: { code: true, title: true } } }
    });
    res.status(201).json({ classSession: session });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/start", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), async (req, res, next) => {
  try {
    const session = await prisma.classSession.findUnique({ where: { id: req.params.id }, include: { course: true } });
    if (!session || (req.user!.role !== Role.ADMIN && session.hostId !== req.user!.id)) {
      throw new HttpError(404, "Class session not found.");
    }
    const room = await dailyRequest("/rooms", {
      name: `nm-${session.id}`.slice(0, 64),
      privacy: "private",
      properties: { enable_chat: true, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 }
    });
    const token = await dailyRequest("/meeting-tokens", {
      properties: { room_name: room.name, is_owner: true, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 }
    });
    const updated = await prisma.classSession.update({
      where: { id: session.id },
      data: { roomName: room.name, roomUrl: room.url, isLive: true }
    });
    await notifyUsers({
      type: NotificationType.CLASS_STARTING,
      message: `${session.title} is live now.`,
      link: "/classes",
      department: session.course.department
    }, req.app.get("notifyUser"));
    res.json({ classSession: updated, meetingUrl: `${room.url}?t=${encodeURIComponent(token.token || "")}` });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/join", authenticate, async (req, res, next) => {
  try {
    const session = await prisma.classSession.findFirst({
      where: { id: req.params.id, isLive: true, course: { department: req.user!.department as Department } }
    });
    if (!session || !session.roomName || !session.roomUrl) throw new HttpError(404, "This class is not live.");
    const token = await dailyRequest("/meeting-tokens", {
      properties: {
        room_name: session.roomName,
        user_name: req.user!.name.slice(0, 64),
        exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60
      }
    });
    res.json({ meetingUrl: `${session.roomUrl}?t=${encodeURIComponent(token.token || "")}` });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/end", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), async (req, res, next) => {
  try {
    const parsed = z.object({ recordingUrl: z.string().url().optional() }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Enter a valid recording URL.");
    const session = await prisma.classSession.findUnique({ where: { id: req.params.id } });
    if (!session || (req.user!.role !== Role.ADMIN && session.hostId !== req.user!.id)) {
      throw new HttpError(404, "Class session not found.");
    }
    const updated = await prisma.classSession.update({
      where: { id: session.id },
      data: { isLive: false, recordingUrl: parsed.data.recordingUrl }
    });
    res.json({ classSession: updated });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/messages", authenticate, async (req, res, next) => {
  try {
    const session = await prisma.classSession.findFirst({
      where: { id: req.params.id, course: { department: req.user!.department as Department } },
      select: { id: true }
    });
    if (!session) throw new HttpError(404, "Class session not found.");
    const messages = await prisma.chatMessage.findMany({
      where: { classId: session.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
      take: 100
    });
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/messages", authenticate, async (req, res, next) => {
  try {
    const body = z.string().trim().min(1).max(1000).safeParse(req.body?.body);
    if (!body.success) throw new HttpError(400, "Chat messages must contain 1 to 1000 characters.");
    const session = await prisma.classSession.findFirst({
      where: { id: req.params.id, isLive: true, course: { department: req.user!.department as Department } }
    });
    if (!session) throw new HttpError(404, "This class is not live.");
    const message = await prisma.chatMessage.create({
      data: { classId: session.id, userId: req.user!.id, body: body.data },
      include: { user: { select: { id: true, name: true } } }
    });
    const io = req.app.get("io");
    io.to(`class:${session.id}`).emit("class:message", message);
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

export default router;
