import bcrypt from "bcryptjs";
import { Department, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const router = Router();
router.use(authenticate, allowRoles(Role.ADMIN));

router.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, department: true, level: true, cohortVerified: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const parsed = z.object({ role: z.enum(["STUDENT", "LECTURER", "ADMIN"]) }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Choose a valid role.");
    if (req.params.id === req.user!.id && parsed.data.role !== Role.ADMIN) {
      throw new HttpError(409, "You cannot remove your own administrator role.");
    }
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, "User not found.");
    if (existing.role === Role.ADMIN && parsed.data.role !== Role.ADMIN) {
      const administrators = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (administrators < 2) throw new HttpError(409, "At least one administrator account must remain.");
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.patch("/users/:id/cohort", async (req, res, next) => {
  try {
    const parsed = z.object({
      department: z.nativeEnum(Department).optional(),
      level: z.string().trim().min(1).max(32).optional(),
      verified: z.boolean().optional()
    }).refine((value) => Object.keys(value).length > 0).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Enter a valid department, level, or verification state.");
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.role !== Role.STUDENT) throw new HttpError(404, "Student account not found.");

    const cohortChanged = (parsed.data.department !== undefined && parsed.data.department !== existing.department)
      || (parsed.data.level !== undefined && parsed.data.level !== existing.level);
    const { verified, ...cohort } = parsed.data;
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...cohort,
        cohortVerified: verified ?? (cohortChanged ? false : existing.cohortVerified)
      },
      select: { id: true, department: true, level: true, cohortVerified: true }
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const parsed = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().email().max(254),
      password: z.string().min(10).max(128),
      department: z.enum(["NURSING", "MIDWIFERY", "MENTAL_HEALTH"]),
      level: z.string().trim().min(1).max(32),
      role: z.enum(["STUDENT", "LECTURER", "ADMIN"])
    }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Enter valid account details and role.");
    const user = await prisma.user.create({
      data: {
        ...parsed.data,
        email: parsed.data.email.toLowerCase(),
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        cohortVerified: true,
        notificationPreference: { create: {} }
      },
      select: { id: true, name: true, email: true, role: true, department: true, level: true, cohortVerified: true }
    });
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

router.get("/pending-slides", async (_req, res, next) => {
  try {
    const slides = await prisma.slide.findMany({
      where: { approved: false },
      include: { course: { select: { code: true, title: true } }, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" }
    });
    res.json({ slides });
  } catch (error) {
    next(error);
  }
});

router.get("/pending-past-questions", async (_req, res, next) => {
  try {
    const pastQuestions = await prisma.pastQuestion.findMany({
      where: { approved: false },
      include: { course: { select: { code: true, title: true } }, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" }
    });
    res.json({ pastQuestions });
  } catch (error) {
    next(error);
  }
});

export default router;
