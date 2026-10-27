import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { Router } from "express";
import nodemailer from "nodemailer";
import { loginSchema, profileSchema, registerSchema } from "@namsamart/shared";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { config } from "../lib/config.js";
import { HttpError } from "../lib/errors.js";
import { createAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { getIntegrationConfig } from "../services/provider-settings.js";

const router = Router();
const safeUser = {
  id: true, name: true, email: true, role: true, department: true, level: true, cohortVerified: true, avatarUrl: true
} as const;
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
});
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/register", registrationLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, department, level } = req.body as ReturnType<typeof registerSchema.parse>;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name, email: email.toLowerCase(), passwordHash, department, level,
        notificationPreference: { create: {} }
      },
      select: safeUser
    });
    res.status(201).json({ token: createAccessToken(user.id), user });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      next(new HttpError(409, "An account with that email already exists."));
      return;
    }
    next(error);
  }
});

router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as ReturnType<typeof loginSchema.parse>;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "Email or password is incorrect.");
    }
    const { passwordHash: _, ...safe } = user;
    res.json({ token: createAccessToken(user.id), user: safe });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: safeUser });
    if (!user) throw new HttpError(404, "Account not found.");
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.patch("/profile", authenticate, validateBody(profileSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: req.body as ReturnType<typeof profileSchema.parse>,
      select: safeUser
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const payload = req.body as { currentPassword?: unknown; newPassword?: unknown };
    if (typeof payload.currentPassword !== "string" || typeof payload.newPassword !== "string" || payload.newPassword.length < 10 || payload.newPassword.length > 128) {
      throw new HttpError(400, "Enter your current password and a new password of at least 10 characters.");
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(payload.currentPassword, user.passwordHash))) {
      throw new HttpError(400, "Current password is incorrect.");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(payload.newPassword, 12) }
    });
    res.json({ message: "Password updated." });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const emailResult = loginSchema.pick({ email: true }).safeParse({ email: req.body?.email });
    if (!emailResult.success) throw new HttpError(400, "Enter a valid email address.");
    const smtp = await getIntegrationConfig("smtp");
    const user = await prisma.user.findUnique({ where: { email: emailResult.data.email.toLowerCase() } });
    if (user) {
      const token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        }
      });
      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password }
      });
      await transport.sendMail({
        from: smtp.from,
        to: user.email,
        subject: "Reset your NamsaMart password",
        text: `Use this link within 30 minutes to set a new password: ${config.APP_URL}/reset-password?token=${token}`
      });
    }
    res.json({ message: "If the account exists, a password reset link will be sent." });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || password.length < 10 || password.length > 128) {
      throw new HttpError(400, "The reset link or new password is invalid.");
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.expiresAt < new Date()) {
      throw new HttpError(400, "This password reset link has expired or was already used.");
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.passwordResetToken.deleteMany({
        where: { tokenHash, expiresAt: { gt: new Date() } }
      });
      if (consumed.count !== 1) {
        throw new HttpError(400, "This password reset link has expired or was already used.");
      }
      await transaction.user.update({
        where: { id: record.userId },
        data: { passwordHash }
      });
      await transaction.passwordResetToken.deleteMany({ where: { userId: record.userId } });
    });
    res.json({ message: "Password reset. You can now sign in." });
  } catch (error) {
    next(error);
  }
});

export default router;
