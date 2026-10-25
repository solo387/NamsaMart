import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

export function requireVerifiedCohort(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === Role.STUDENT && !req.user.cohortVerified) {
    res.status(403).json({ error: "Your department and study level are awaiting administrator verification." });
    return;
  }
  next();
}
