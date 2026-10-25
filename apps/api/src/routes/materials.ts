import { Department, NotificationType, Role, Semester } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { notifyUsers } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { uploadFile } from "../services/cloudinary.js";
import { courseLevelFilter } from "../lib/access.js";

type EmitNotification = (userId: string, notification: unknown) => void;

const acceptedTypes = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4"
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!acceptedTypes.has(file.mimetype)) {
      callback(new HttpError(400, "Upload a PDF, PowerPoint, Word document, or MP4 video."));
      return;
    }
    callback(null, true);
  }
});

const router = Router();

router.get("/slides", authenticate, async (req, res, next) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.slice(0, 100) : undefined;
    const slides = await prisma.slide.findMany({
      where: {
        approved: req.user!.role === Role.ADMIN ? undefined : true,
        course: {
          ...(req.user!.role === Role.ADMIN && typeof req.query.department === "string"
            ? { department: req.query.department as Department }
            : { department: req.user!.department as Department }),
          ...courseLevelFilter(
            req.user!.role,
            req.user!.level,
            typeof req.query.level === "string" ? req.query.level : undefined
          ),
          ...(typeof req.query.courseId === "string" ? { id: req.query.courseId } : {}),
        },
        ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {})
      },
      include: {
        course: { select: { code: true, title: true, level: true } },
        uploadedBy: { select: { name: true } },
        bookmarks: { where: { userId: req.user!.id }, select: { userId: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ slides: slides.map(({ bookmarks, ...slide }) => ({ ...slide, bookmarked: bookmarks.length > 0 })) });
  } catch (error) {
    next(error);
  }
});

router.post("/slides", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "Choose a file to upload.");
    const fields = z.object({
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().max(1000).optional(),
      courseId: z.string().cuid()
    }).safeParse(req.body);
    if (!fields.success) throw new HttpError(400, "Add a title and choose a valid course.");
    const course = await prisma.course.findUnique({ where: { id: fields.data.courseId } });
    if (!course || (req.user!.role !== Role.ADMIN && course.department !== req.user!.department)) {
      throw new HttpError(404, "Course not found.");
    }
    const remote = await uploadFile(req.file, "slides");
    const slide = await prisma.slide.create({
      data: {
        ...fields.data,
        uploadedById: req.user!.id,
        fileUrl: remote.secure_url,
        publicId: remote.public_id,
        type: req.file.mimetype,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        approved: req.user!.role === Role.ADMIN
      }
    });
    if (slide.approved) await notifyUsers({
      type: NotificationType.NEW_SLIDE,
      message: `New learning material: ${slide.title}`,
      link: "/slides",
      department: course.department
    }, req.app.get("notifyUser") as EmitNotification);
    res.status(201).json({ slide });
  } catch (error) {
    next(error);
  }
});

router.get("/past-questions", authenticate, async (req, res, next) => {
  try {
    const year = typeof req.query.year === "string" ? Number(req.query.year) : undefined;
    const questions = await prisma.pastQuestion.findMany({
      where: {
        course: {
          ...(req.user!.role === Role.ADMIN && typeof req.query.department === "string"
            ? { department: req.query.department as Department }
            : { department: req.user!.department as Department }),
          ...courseLevelFilter(
            req.user!.role,
            req.user!.level,
            typeof req.query.level === "string" ? req.query.level : undefined
          ),
          ...(typeof req.query.courseId === "string" ? { id: req.query.courseId } : {})
        },
        approved: req.user!.role === Role.ADMIN ? undefined : true,
        ...(year && Number.isInteger(year) ? { year } : {}),
        ...(req.query.semester === "FIRST" || req.query.semester === "SECOND"
          ? { semester: req.query.semester as Semester }
          : {})
      },
      include: {
        course: { select: { code: true, title: true } },
        studyProgress: { where: { userId: req.user!.id }, select: { userId: true } }
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }]
    });
    res.json({
      pastQuestions: questions.map(({ studyProgress, ...question }) => ({
        ...question,
        studied: studyProgress.length > 0
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post("/past-questions", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file || req.file.mimetype !== "application/pdf") throw new HttpError(400, "Choose a PDF exam paper.");
    const fields = z.object({
      courseId: z.string().cuid(),
      year: z.coerce.number().int().min(2000).max(new Date().getFullYear() + 1),
      semester: z.enum(["FIRST", "SECOND"])
    }).safeParse(req.body);
    if (!fields.success) throw new HttpError(400, "Choose a course, year, and semester.");
    const course = await prisma.course.findUnique({ where: { id: fields.data.courseId } });
    if (!course || (req.user!.role !== Role.ADMIN && course.department !== req.user!.department)) {
      throw new HttpError(404, "Course not found.");
    }
    const remote = await uploadFile(req.file, "past-questions");
    const question = await prisma.pastQuestion.create({
      data: {
        ...fields.data,
        uploadedById: req.user!.id,
        fileUrl: remote.secure_url,
        publicId: remote.public_id,
        approved: req.user!.role === Role.ADMIN
      }
    });
    if (question.approved) await notifyUsers({
      type: NotificationType.NEW_PAST_QUESTION,
      message: `New past paper: ${course.code} ${question.year}`,
      link: "/past-questions",
      department: course.department
    }, req.app.get("notifyUser") as EmitNotification);
    res.status(201).json({ pastQuestion: question });
  } catch (error) {
    next(error);
  }
});

router.put("/past-questions/:id/studied", authenticate, async (req, res, next) => {
  try {
    const found = await prisma.pastQuestion.findFirst({
      where: {
        id: req.params.id,
        ...(req.user!.role === Role.ADMIN ? {} : { course: { department: req.user!.department as Department } }),
        approved: req.user!.role === Role.ADMIN ? undefined : true
      }
    });
    if (!found) throw new HttpError(404, "Past question not found.");
    const existing = await prisma.studyProgress.findUnique({
      where: { userId_pastQuestionId: { userId: req.user!.id, pastQuestionId: found.id } }
    });
    if (existing) {
      await prisma.studyProgress.delete({ where: { userId_pastQuestionId: { userId: req.user!.id, pastQuestionId: found.id } } });
      res.json({ studied: false });
    } else {
      await prisma.studyProgress.create({ data: { userId: req.user!.id, pastQuestionId: found.id } });
      res.json({ studied: true });
    }
  } catch (error) {
    next(error);
  }
});

router.put("/slides/:id/bookmark", authenticate, async (req, res, next) => {
  try {
    const slide = await prisma.slide.findFirst({
      where: {
        id: req.params.id,
        ...(req.user!.role === Role.ADMIN ? {} : { course: { department: req.user!.department as Department } }),
        approved: true
      }
    });
    if (!slide) throw new HttpError(404, "Slide not found.");
    const key = { userId_slideId: { userId: req.user!.id, slideId: slide.id } };
    const existing = await prisma.bookmark.findUnique({ where: key });
    if (existing) {
      await prisma.bookmark.delete({ where: key });
      res.json({ bookmarked: false });
    } else {
      await prisma.bookmark.create({ data: { userId: req.user!.id, slideId: slide.id } });
      res.json({ bookmarked: true });
    }
  } catch (error) {
    next(error);
  }
});

router.patch("/slides/:id/approval", authenticate, allowRoles(Role.ADMIN), async (req, res, next) => {
  try {
    const approved = z.boolean().safeParse(req.body?.approved);
    if (!approved.success) throw new HttpError(400, "Approval must be true or false.");
    const slide = await prisma.slide.update({
      where: { id: req.params.id },
      data: { approved: approved.data },
      include: { course: { select: { department: true } } }
    });
    if (slide.approved) await notifyUsers({
      type: NotificationType.NEW_SLIDE,
      message: `New learning material: ${slide.title}`,
      link: "/slides",
      department: slide.course.department
    }, req.app.get("notifyUser") as EmitNotification);
    res.json({ slide });
  } catch (error) {
    next(error);
  }
});

router.patch("/past-questions/:id/approval", authenticate, allowRoles(Role.ADMIN), async (req, res, next) => {
  try {
    const approved = z.boolean().safeParse(req.body?.approved);
    if (!approved.success) throw new HttpError(400, "Approval must be true or false.");
    const question = await prisma.pastQuestion.update({
      where: { id: req.params.id },
      data: { approved: approved.data },
      include: { course: { select: { code: true, department: true } } }
    });
    if (question.approved) await notifyUsers({
      type: NotificationType.NEW_PAST_QUESTION,
      message: `New past paper: ${question.course.code} ${question.year}`,
      link: "/past-questions",
      department: question.course.department
    }, req.app.get("notifyUser") as EmitNotification);
    res.json({ pastQuestion: question });
  } catch (error) {
    next(error);
  }
});

export default router;
