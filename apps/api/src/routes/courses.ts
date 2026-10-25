import { Department, Role } from "@prisma/client";
import { courseSchema } from "@namsamart/shared";
import { Router } from "express";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { prisma } from "../lib/prisma.js";
import { courseLevelFilter } from "../lib/access.js";

const router = Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const department = req.user!.role === Role.ADMIN
      ? (typeof req.query.department === "string" ? req.query.department as Department : undefined)
      : req.user!.department as Department;
    const courses = await prisma.course.findMany({
      where: {
        ...(department ? { department } : {}),
        ...courseLevelFilter(
          req.user!.role,
          req.user!.level,
          typeof req.query.level === "string" ? req.query.level : undefined
        )
      },
      include: { _count: { select: { slides: true, pastQuestions: true, quizzes: true } } },
      orderBy: [{ level: "asc" }, { code: "asc" }]
    });
    res.json({ courses });
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, allowRoles(Role.ADMIN), validateBody(courseSchema), async (req, res, next) => {
  try {
    const course = await prisma.course.create({ data: req.body as ReturnType<typeof courseSchema.parse> });
    res.status(201).json({ course });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", authenticate, allowRoles(Role.ADMIN), validateBody(courseSchema), async (req, res, next) => {
  try {
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: req.body as ReturnType<typeof courseSchema.parse>
    });
    res.json({ course });
  } catch (error) {
    next(error);
  }
});

export default router;
