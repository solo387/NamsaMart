import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "Please check the submitted information.",
        details: result.error.flatten().fieldErrors
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
