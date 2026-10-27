import { Department, NotificationType, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { notifyUsers } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { courseLevelFilter } from "../lib/access.js";
import { getIntegrationConfig } from "../services/provider-settings.js";

const router = Router();

interface DailyRecording {
  id: string;
  start_ts: number;
  status: string;
}

interface DailyResponse {
  error?: string;
  info?: string;
  name?: string;
  url?: string;
  token?: string;
  data?: DailyRecording[];
  download_link?: string;
  expires?: number;
}

async function dailyRequest(path: string, method: "GET" | "POST", body?: object): Promise<DailyResponse> {
  const credentials = await getIntegrationConfig("daily");
  const response = await fetch(`https://api.daily.co/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${credentials.apiKey}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json() as DailyResponse;
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
    const room = await dailyRequest("/rooms", "POST", {
      name: `nm-${session.id}`.slice(0, 64),
      privacy: "private",
      properties: { enable_chat: true, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 }
    });
    if (!room.name || !room.url) throw new HttpError(502, "Daily.co returned an invalid room.");
    const token = await dailyRequest("/meeting-tokens", "POST", {
      properties: {
        room_name: room.name,
        is_owner: true,
        enable_recording: "cloud",
        start_cloud_recording: true,
        exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
      }
    });
    if (!token.token) throw new HttpError(502, "Daily.co did not return a host meeting token.");
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
    res.json({ classSession: updated, meetingUrl: `${room.url}?t=${encodeURIComponent(token.token)}` });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/join", authenticate, async (req, res, next) => {
  try {
    const session = await prisma.classSession.findFirst({
      where: { id: req.params.id, isLive: true,       course: {
        department: req.user!.department as Department,
        ...courseLevelFilter(req.user!.role, req.user!.level)
      } }
    });
    if (!session || !session.roomName || !session.roomUrl) throw new HttpError(404, "This class is not live.");
    const token = await dailyRequest("/meeting-tokens", "POST", {
      properties: {
        room_name: session.roomName,
        user_name: req.user!.name.slice(0, 64),
        ...(session.hostId === req.user!.id ? { is_owner: true } : {}),
        exp: Math.floor(Date.now() / 1000) + 4 * 60 * 60
      }
    });
    if (!token.token) throw new HttpError(502, "Daily.co did not return a participant meeting token.");
    res.json({ meetingUrl: `${session.roomUrl}?t=${encodeURIComponent(token.token)}` });
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
    if (session.isLive && session.roomName) {
      await dailyRequest(`/rooms/${encodeURIComponent(session.roomName)}/recordings/stop`, "POST", {});
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

router.get("/:id/recording", authenticate, async (req, res, next) => {
  try {
    const session = await prisma.classSession.findFirst({
      where: {
        id: req.params.id,
        course: {
          department: req.user!.department as Department,
          ...courseLevelFilter(req.user!.role, req.user!.level)
        }
      },
      select: { roomName: true, recordingUrl: true }
    });
    if (!session) throw new HttpError(404, "Class session not found.");
    if (session.recordingUrl) {
      res.json({ recordingUrl: session.recordingUrl });
      return;
    }
    if (!session.roomName) throw new HttpError(404, "No recording is available for this class.");

    const recordings = await dailyRequest(
      `/recordings?room_name=${encodeURIComponent(session.roomName)}&limit=100`,
      "GET"
    );
    const recording = recordings.data
      ?.filter((item) => item.status === "finished")
      .sort((left, right) => right.start_ts - left.start_ts)[0];
    if (!recording) {
      throw new HttpError(409, "The recording is still processing or is not available yet. Try again shortly.");
    }

    const accessLink = await dailyRequest(
      `/recordings/${encodeURIComponent(recording.id)}/access-link`,
      "GET"
    );
    if (!accessLink.download_link) throw new HttpError(502, "Daily.co did not return a recording download link.");
    res.json({ recordingUrl: accessLink.download_link, expires: accessLink.expires });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/messages", authenticate, async (req, res, next) => {
  try {
    const session = await prisma.classSession.findFirst({
      where: {
        id: req.params.id,
        course: {
          department: req.user!.department as Department,
          ...courseLevelFilter(req.user!.role, req.user!.level)
        }
      },
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
      where: {
        id: req.params.id,
        isLive: true,
        course: {
          department: req.user!.department as Department,
          ...courseLevelFilter(req.user!.role, req.user!.level)
        }
      }
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
