import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { z } from "zod";
import { config } from "./lib/config.js";
import { canAccessCourse } from "./lib/access.js";
import { HttpError } from "./lib/errors.js";
import { prisma } from "./lib/prisma.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import classRoutes from "./routes/classes.js";
import courseRoutes from "./routes/courses.js";
import materialRoutes from "./routes/materials.js";
import mediaRoutes from "./routes/media.js";
import newsRoutes from "./routes/news.js";
import notificationRoutes from "./routes/notifications.js";
import quizRoutes from "./routes/quizzes.js";

type ApiOptions = { checkDatabase?: () => Promise<unknown> };

export function createApi({ checkDatabase = () => prisma.$queryRaw`SELECT 1` }: ApiOptions = {}) {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: config.WEB_ORIGIN, methods: ["GET", "POST", "PATCH", "PUT"] }
  });

  app.set("io", io);
  app.set("notifyUser", (userId: string, notification: unknown) =>
    io.to(`user:${userId}`).emit("notification:new", notification)
  );
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.WEB_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false
  }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/api/health/live", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/health/ready", async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "unavailable", error: "Database is not ready." });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/courses", courseRoutes);
  app.use("/api/materials", materialRoutes);
  app.use("/api/quizzes", quizRoutes);
  app.use("/api/classes", classRoutes);
  app.use("/api/news", newsRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/media", mediaRoutes);
  app.use("/api/admin", adminRoutes);

  io.use(async (socket, next) => {
    const parsedToken = z.string().min(1).safeParse(socket.handshake.auth?.token);
    if (!parsedToken.success) {
      next(new Error("Authentication required."));
      return;
    }
    let userId: string;
    try {
      const payload = jwt.verify(parsedToken.data, config.JWT_SECRET);
      if (typeof payload === "string" || typeof payload.sub !== "string") {
        next(new Error("Session is invalid or expired."));
        return;
      }
      userId = payload.sub;
    } catch {
      next(new Error("Session is invalid or expired."));
      return;
    }
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
      if (!user) {
        next(new Error("Account not found."));
        return;
      }
      socket.data.userId = user.id;
      next();
    } catch (error) {
      console.error("Socket authentication failed:", error);
      next(new Error("Unable to verify session."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    socket.on("class:join", async (classId: unknown, callback?: (result: { error?: string }) => void) => {
      const parsedClassId = z.string().cuid().safeParse(classId);
      if (!parsedClassId.success) {
        callback?.({ error: "A valid class id is required." });
        return;
      }
      try {
        const [user, session] = await Promise.all([
          prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, department: true, level: true }
          }),
          prisma.classSession.findUnique({
            where: { id: parsedClassId.data },
            select: {
              isLive: true,
              course: { select: { department: true, level: true } }
            }
          })
        ]);
        if (!user || !session || !session.isLive || !canAccessCourse(
          user.role,
          user.department,
          user.level,
          session.course.department,
          session.course.level
        )) {
          callback?.({ error: "You cannot access this class chat." });
          return;
        }
        await socket.join(`class:${parsedClassId.data}`);
        callback?.({});
      } catch (error) {
        console.error("Class chat authorization failed:", error);
        callback?.({ error: "Unable to join class chat." });
      }
    });
  });

  app.use((_req, res) => res.status(404).json({ error: "Endpoint not found." }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ error: "Request body must contain valid JSON." });
      return;
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? "File exceeds the 100 MB upload limit." : "File upload could not be processed."
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError) {
      res.status(503).json({ error: "The database is temporarily unavailable. Please try again." });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (["P1001", "P1002", "P1008", "P1017"].includes(error.code)) {
        res.status(503).json({ error: "The database is temporarily unavailable. Please try again." });
        return;
      }
      const status = error.code === "P2002" ? 409 : error.code === "P2025" ? 404 : error.code === "P2003" ? 400 : 500;
      if (status !== 500) {
        res.status(status).json({
          error: status === 409 ? "That record already exists." : status === 404 ? "The requested record was not found." : "The request references a record that does not exist."
        });
        return;
      }
    }
    if (
      typeof error === "object"
      && error !== null
      && "type" in error
      && (error.type === "entity.too.large" || error.type === "entity.parse.failed")
    ) {
      const tooLarge = error.type === "entity.too.large";
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? "Request body exceeds the 1 MB limit." : "Request body must contain valid JSON."
      });
      return;
    }
    console.error("Unhandled API error:", error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  return { app, server, io };
}
