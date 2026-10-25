import dotenv from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
dotenv.config();

export const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32).refine((secret) => !/\s/.test(secret), "JWT_SECRET must not contain whitespace."),
  JWT_EXPIRES_IN: z.string().regex(/^\d+(ms|s|m|h|d|w|y)$/).default("1d"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("NamsaMart <no-reply@example.com>"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  DAILY_API_KEY: z.string().optional()
}).superRefine((values, context) => {
  if (values.NODE_ENV === "production" && /^(replace|change-this|development|test)/i.test(values.JWT_SECRET)) {
    context.addIssue({
      code: "custom",
      path: ["JWT_SECRET"],
      message: "Replace the example JWT_SECRET with a unique production secret."
    });
  }
});

export const config = configSchema.parse(process.env);
