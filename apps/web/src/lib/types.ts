export type Role = "STUDENT" | "LECTURER" | "ADMIN";
export type Department = "NURSING" | "MIDWIFERY" | "MENTAL_HEALTH";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department;
  level: string;
  cohortVerified: boolean;
  avatarUrl: string | null;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department: Department;
  level: string;
  description?: string | null;
  _count?: { slides: number; pastQuestions: number; quizzes: number };
}

export interface Slide {
  id: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  approved: boolean;
  bookmarked: boolean;
  course: Pick<Course, "code" | "title" | "level">;
  uploadedBy: { name: string };
}

export interface PastQuestion {
  id: string;
  year: number;
  semester: "FIRST" | "SECOND";
  fileUrl: string;
  studied: boolean;
  course: Pick<Course, "code" | "title">;
}

export interface QuizSummary {
  id: string;
  createdById?: string;
  isPublished: boolean;
  title: string;
  description?: string | null;
  durationMinutes: number;
  createdAt: string;
  course: Pick<Course, "code" | "title">;
  _count: { questions: number; attempts: number };
  attempts: { id: string; score: number | null; submittedAt: string | null }[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER";
  options: string[] | null;
  points: number;
  order: number;
}

export interface ClassSession {
  id: string;
  title: string;
  scheduledAt: string;
  roomUrl: string | null;
  isLive: boolean;
  recordingUrl: string | null;
  course: Pick<Course, "code" | "title">;
  host: { id: string; name: string };
}

export interface NewsPost {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  category: string;
  department: Department | null;
  createdAt: string;
  author: { id: string; name: string; role?: Role };
  comments: { id: string; body: string; createdAt: string; user: { id: string; name: string; avatarUrl: string | null } }[];
  reactionCount: number;
  myReaction: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}
