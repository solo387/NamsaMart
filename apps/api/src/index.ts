import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { Role } from "@prisma/client";
import { config } from "./lib/config.js";
import { HttpError } from "./lib/errors.js";
import { prisma } from "./lib/prisma.js";
import { authenticate } from "./middleware/auth.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import classRoutes from "./routes/classes.js";
import courseRoutes from "./routes/courses.js";
import materialRoutes from "./routes/materials.js";
import mediaRoutes from "./routes/media.js";
import newsRoutes from "./routes/news.js";
import notificationRoutes from "./routes/notifications.js";
import quizRoutes from "./routes/quizzes.js";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: config.WEB_ORIGIN, methods: ["GET", "POST", "PATCH", "PUT"] } });

app.set("io", io);
app.set("notifyUser", (userId: string, notification: unknown) => io.to(`user:${userId}`).emit("notification:new", notification));
app.use(helmet());
app.use(cors({ origin: config.WEB_ORIGIN }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/materials", materialRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/admin", adminRoutes);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (typeof token !== "string") {
    next(new Error("Authentication required."));
    return;
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string };
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error("Session is invalid or expired."));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  socket.join(`user:${userId}`);
  socket.on("class:join", async (classId: unknown, callback?: (result: { error?: string }) => void) => {
    try {
      if (typeof classId !== "string") {
        callback?.({ error: "Class id is required." });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { department: true, role: true } });
      const session = await prisma.classSession.findUnique({ where: { id: classId }, include: { course: { select: { department: true } } } });
      if (!user || !session || (user.role !== Role.ADMIN && session.course.department !== user.department)) {
        callback?.({ error: "You cannot access this class chat." });
        return;
      }
      socket.join(`class:${classId}`);
      callback?.({});
    } catch (error) {
      console.error("Class chat authorization failed:", error);
      callback?.({ error: "Unable to join class chat." });
    }
  });
});

app.use((_req, res) => res.status(404).json({ error: "Endpoint not found." }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: error.code === "LIMIT_FILE_SIZE" ? "File exceeds the 100 MB upload limit." : "File upload could not be processed." });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({ error: "That record already exists." });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({ error: "The requested record was not found." });
    return;
  }
  console.error("Unhandled API error:", error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

server.listen(config.PORT, () => {
  console.info(`NamsaMart API listening on port ${config.PORT}`);
});

async function shutdown() {
  io.close();
  await prisma.$disconnect();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
