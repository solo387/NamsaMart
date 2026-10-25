import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { uploadFile } from "../services/cloudinary.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new HttpError(400, "Profile photos must be JPG, PNG, or WebP."));
      return;
    }
    callback(null, true);
  }
});

router.post("/avatar", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "Choose a profile photo.");
    const remote = await uploadFile(req.file, "avatars");
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: remote.secure_url },
      select: { id: true, avatarUrl: true }
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
