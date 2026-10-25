import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        department: string;
        level: string;
        email: string;
        name: string;
      };
    }
  }
}

export {};
