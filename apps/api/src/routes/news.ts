import { Department, NotificationType, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { newsSchema } from "@namsamart/shared";
import { authenticate, allowRoles } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { notifyUsers } from "../lib/notifications.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const posts = await prisma.news.findMany({
      where: {
        published: req.user!.role === Role.ADMIN ? undefined : true,
        OR: req.user!.role === Role.ADMIN
          ? undefined
          : [{ department: req.user!.department as Department }, { department: null }]
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: "asc" },
          take: 50
        },
        reactions: true,
        _count: { select: { comments: true, reactions: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json({
      news: posts.map(({ reactions, ...post }) => ({
        ...post,
        reactionCount: reactions.length,
        myReaction: reactions.find(({ userId }) => userId === req.user!.id)?.reaction ?? null
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", authenticate, allowRoles(Role.LECTURER, Role.ADMIN), async (req, res, next) => {
  try {
    const parsed = newsSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Add a title, announcement body, category, and valid department.");
    if (req.user!.role !== Role.ADMIN && parsed.data.department && parsed.data.department !== req.user!.department) {
      throw new HttpError(403, "You can only post announcements for your department.");
    }
    const post = await prisma.news.create({
      data: { ...parsed.data, authorId: req.user!.id },
      include: { author: { select: { name: true } } }
    });
    await notifyUsers({
      type: NotificationType.ANNOUNCEMENT,
      message: post.title,
      link: "/news",
      department: post.department ?? undefined
    }, req.app.get("notifyUser"));
    res.status(201).json({ news: post });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/comments", authenticate, async (req, res, next) => {
  try {
    const body = z.string().trim().min(1).max(2000).safeParse(req.body?.body);
    if (!body.success) throw new HttpError(400, "Comments must contain 1 to 2000 characters.");
    const post = await prisma.news.findFirst({
      where: { id: req.params.id, published: true, OR: [{ department: req.user!.department as Department }, { department: null }] },
      select: { id: true }
    });
    if (!post) throw new HttpError(404, "Announcement not found.");
    const comment = await prisma.newsComment.create({
      data: { newsId: post.id, userId: req.user!.id, body: body.data },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } }
    });
    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

router.put("/:id/reaction", authenticate, async (req, res, next) => {
  try {
    const parsed = z.enum(["HELPFUL", "CELEBRATE", "THANKS"]).safeParse(req.body?.reaction);
    if (!parsed.success) throw new HttpError(400, "Choose a supported reaction.");
    const post = await prisma.news.findFirst({
      where: { id: req.params.id, published: true, OR: [{ department: req.user!.department as Department }, { department: null }] },
      select: { id: true }
    });
    if (!post) throw new HttpError(404, "Announcement not found.");
    const key = { newsId_userId: { newsId: post.id, userId: req.user!.id } };
    const previous = await prisma.newsReaction.findUnique({ where: key });
    if (previous?.reaction === parsed.data) {
      await prisma.newsReaction.delete({ where: key });
      res.json({ reaction: null });
    } else {
      await prisma.newsReaction.upsert({
        where: key,
        create: { newsId: post.id, userId: req.user!.id, reaction: parsed.data },
        update: { reaction: parsed.data }
      });
      res.json({ reaction: parsed.data });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
