import { z } from "zod";

export const roles = ["STUDENT", "LECTURER", "ADMIN"] as const;
export const departments = ["NURSING", "MIDWIFERY", "MENTAL_HEALTH"] as const;
export const materialTypes = ["PDF", "PRESENTATION", "DOCUMENT", "VIDEO"] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128),
  department: z.enum(departments),
  level: z.string().trim().min(1).max(32)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  department: z.enum(departments),
  level: z.string().trim().min(1).max(32),
  avatarUrl: z.string().url().nullable().optional()
});

export const courseSchema = z.object({
  code: z.string().trim().min(2).max(20),
  title: z.string().trim().min(3).max(160),
  department: z.enum(departments),
  level: z.string().trim().min(1).max(32),
  description: z.string().trim().max(1000).optional()
});

export const newsSchema = z.object({
  title: z.string().trim().min(5).max(180),
  body: z.string().trim().min(20).max(12000),
  imageUrl: z.string().url().optional(),
  category: z.enum(["ACADEMIC", "GENERAL", "EVENT", "URGENT"]),
  department: z.enum(departments).nullable().optional()
});

export const quizAnswerSchema = z.object({
  questionId: z.string().cuid(),
  answer: z.union([z.string().max(2000), z.array(z.string().max(300)).max(20)])
});

export type Role = (typeof roles)[number];
export type Department = (typeof departments)[number];
export type MaterialType = (typeof materialTypes)[number];
