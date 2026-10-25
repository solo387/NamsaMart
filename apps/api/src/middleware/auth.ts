import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";

type TokenPayload = { sub: string };

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  let payload: TokenPayload;
  try {
    const verified = jwt.verify(header.slice(7), config.JWT_SECRET);
    if (typeof verified === "string" || typeof verified.sub !== "string") {
      res.status(401).json({ error: "Session is invalid or expired. Please sign in again." });
      return;
    }
    payload = { sub: verified.sub };
  } catch {
    res.status(401).json({ error: "Session is invalid or expired. Please sign in again." });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, department: true, level: true, cohortVerified: true, email: true, name: true }
    });
    if (!user) {
      res.status(401).json({ error: "Account not found." });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function allowRoles(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}
