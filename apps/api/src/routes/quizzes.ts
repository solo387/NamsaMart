import { Department, NotificationType, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { notifyUsers } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";
import { quizAnswerSchema } from "@namsamart/shared";
import { scoreQuiz } from "../services/quiz-scoring.js";
import { canRevealQuizAnswers, courseLevelFilter } from "../lib/access.js";

const router = Router();
const questionInput = z.object({
  text: z.string().trim().min(5).max(1500),
  type: z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER"]),
  options: z.array(z.string().trim().min(1).max(300)).max(8).optional(),
  correctAnswer: z.string().trim().min(1).max(2000),
  points: z.number().int().min(1).max(100).default(1)
});
const createQuizSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  courseId: z.string().cuid(),
  durationMinutes: z.number().int().min(1).max(240),
  availableAt: z.string().datetime().optional(),
  isPublished: z.boolean().default(false),
  questions: z.array(questionInput).min(1).max(100)
});

router.get("/", authenticate, async (req, res, next) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: {
        ...(req.user!.role === Role.ADMIN
          ? {}
          : req.user!.role === Role.LECTURER
            ? { course: { department: req.user!.department as Department }, OR: [{ isPublished: true }, { createdById: req.user!.id }] }
            : {
              course: {
                department: req.user!.department as Department,
                ...courseLevelFilter(req.user!.role, req.user!.level)
              },
              OR: [
                { isPublished: true },
                { attempts: { some: { userId: req.user!.id, submittedAt: { not: null } } } }
              ]
            }),
        ...(typeof req.query.courseId === "string" ? { courseId: req.query.courseId } : {})
      },
      include: {
        course: { select: { code: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
        attempts: {
          where: { userId: req.user!.id, submittedAt: { not: null } },
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { id: true, score: true, submittedAt: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({ quizzes });
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), async (req, res, next) => {
  try {
    const parsed = createQuizSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Add a title, course, duration, and at least one valid question.");
    const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
    if (!course || (req.user!.role !== Role.ADMIN && course.department !== req.user!.department)) {
      throw new HttpError(404, "Course not found.");
    }
    for (const question of parsed.data.questions) {
      if (question.type === "MCQ" && (!question.options || question.options.length < 2 || !question.options.includes(question.correctAnswer))) {
        throw new HttpError(400, "Multiple-choice questions need at least two options and a correct answer from those options.");
      }
      if (question.type === "TRUE_FALSE" && !["true", "false"].includes(question.correctAnswer.toLowerCase())) {
        throw new HttpError(400, "True/false answers must be true or false.");
      }
    }
    const { questions, availableAt, ...data } = parsed.data;
    const quiz = await prisma.quiz.create({
      data: {
        ...data,
        createdById: req.user!.id,
        availableAt: availableAt ? new Date(availableAt) : undefined,
        questions: { create: questions.map((question, order) => ({ ...question, order })) }
      },
      include: { course: { select: { code: true, title: true } }, _count: { select: { questions: true } } }
    });
    if (quiz.isPublished) await notifyUsers({
      type: NotificationType.NEW_QUIZ,
      message: `New quiz: ${quiz.title}`,
      link: "/quizzes",
      department: course.department
    }, req.app.get("notifyUser"));
    res.status(201).json({ quiz });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.id,
        ...(req.user!.role === Role.ADMIN ? {} : req.user!.role === Role.LECTURER
          ? { course: { department: req.user!.department as Department }, OR: [{ isPublished: true }, { createdById: req.user!.id }] }
          : {
            course: {
              department: req.user!.department as Department,
              ...courseLevelFilter(req.user!.role, req.user!.level)
            },
            OR: [
              { isPublished: true },
              { attempts: { some: { userId: req.user!.id, submittedAt: { not: null } } } }
            ]
          })
      },
      include: {
        course: { select: { code: true, title: true } },
        questions: { orderBy: { order: "asc" }, select: { id: true, text: true, type: true, options: true, points: true, order: true } },
        attempts: {
          where: { userId: req.user!.id, submittedAt: { not: null } },
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { id: true, score: true, submittedAt: true, startedAt: true }
        }
      }
    });
    if (!quiz) throw new HttpError(404, "Quiz not found.");
    res.json({ quiz });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/publish", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), async (req, res, next) => {
  try {
    const isPublished = z.boolean().safeParse(req.body?.isPublished);
    if (!isPublished.success) throw new HttpError(400, "Publish state must be true or false.");
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { course: { select: { department: true } } }
    });
    if (!quiz || (req.user!.role !== Role.ADMIN && quiz.createdById !== req.user!.id)) {
      throw new HttpError(404, "Quiz not found.");
    }
    if (req.user!.role !== Role.ADMIN && quiz.course.department !== req.user!.department) {
      throw new HttpError(403, "You can only publish quizzes for your department.");
    }
    const updated = await prisma.quiz.update({
      where: { id: quiz.id },
      data: { isPublished: isPublished.data }
    });
    if (updated.isPublished && !quiz.isPublished) await notifyUsers({
      type: NotificationType.NEW_QUIZ,
      message: `New quiz: ${quiz.title}`,
      link: "/quizzes",
      department: quiz.course.department
    }, req.app.get("notifyUser"));
    res.json({ quiz: updated });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/attempts", authenticate, async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.id,
        isPublished: true,
        course: {
          department: req.user!.department as Department,
          ...courseLevelFilter(req.user!.role, req.user!.level)
        },
        OR: [{ availableAt: null }, { availableAt: { lte: new Date() } }]
      },
      select: { id: true }
    });
    if (!quiz) throw new HttpError(404, "Quiz is not available.");
    const attempt = await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId: req.user!.id } });
    res.status(201).json({ attempt });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/attempts/:attemptId/submit", authenticate, async (req, res, next) => {
  try {
    const parsed = z.object({ answers: z.array(quizAnswerSchema).max(100) }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "One or more answers are invalid.");
    const attempt = await prisma.quizAttempt.findFirst({
      where: { id: req.params.attemptId, quizId: req.params.id, userId: req.user!.id, submittedAt: null },
      include: { quiz: { include: { questions: true } } }
    });
    if (!attempt) throw new HttpError(404, "Active quiz attempt not found.");
    if (Date.now() > attempt.startedAt.getTime() + attempt.quiz.durationMinutes * 60_000 + 30_000) {
      throw new HttpError(409, "Time is up. Submit before the quiz timer expires.");
    }
    const questionMap = new Map(attempt.quiz.questions.map((question) => [question.id, question]));
    const answerIds = new Set(parsed.data.answers.map(({ questionId }) => questionId));
    if (answerIds.size !== parsed.data.answers.length || [...answerIds].some((id) => !questionMap.has(id))) {
      throw new HttpError(400, "Answers contain repeated or unrelated questions.");
    }
    const scored = scoreQuiz(attempt.quiz.questions, parsed.data.answers);
    const submittedAt = new Date();
    const update = await prisma.quizAttempt.updateMany({
      where: { id: attempt.id, submittedAt: null },
      data: { score: scored.score, answers: parsed.data.answers, submittedAt }
    });
    if (!update.count) throw new HttpError(409, "This quiz attempt has already been submitted.");
    const updated = await prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      select: { id: true, score: true, startedAt: true, submittedAt: true }
    });
    res.json({ attempt: updated, pointsEarned: scored.pointsEarned, totalPoints: scored.totalPoints });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/attempts/:attemptId/review", authenticate, async (req, res, next) => {
  try {
    const attempt = await prisma.quizAttempt.findFirst({
      where: { id: req.params.attemptId, quizId: req.params.id, userId: req.user!.id, submittedAt: { not: null } },
      include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } }
    });
    if (!attempt) throw new HttpError(404, "Submitted attempt not found.");
    if (!canRevealQuizAnswers(attempt.quiz.isPublished, req.user!.role, attempt.quiz.createdById, req.user!.id)) {
      throw new HttpError(403, "Answer review will be available after the lecturer closes the quiz.");
    }
    const answers = Array.isArray(attempt.answers) ? attempt.answers as Array<{ questionId: string; answer: string | string[] }> : [];
    res.json({
      score: attempt.score,
      submittedAt: attempt.submittedAt,
      review: attempt.quiz.questions.map((question) => ({
        id: question.id,
        text: question.text,
        type: question.type,
        options: question.options,
        correctAnswer: question.correctAnswer,
        yourAnswer: answers.find((item) => item.questionId === question.id)?.answer ?? null,
        points: question.points
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/leaderboard", authenticate, async (req, res, next) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId: req.params.id,
        submittedAt: { not: null },
        quiz: {
          course: {
            department: req.user!.department as Department,
            ...courseLevelFilter(req.user!.role, req.user!.level)
          },
          isPublished: true
        }
      },
      orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
      distinct: ["userId"],
      take: 20,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } }
    });
    res.json({ leaderboard: attempts.map(({ user, score, submittedAt }) => ({ user, score, submittedAt })) });
  } catch (error) {
    next(error);
  }
});

export default router;
