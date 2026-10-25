import { Role } from "@prisma/client";

export function canAccessCourse(
  role: Role,
  userDepartment: string,
  userLevel: string,
  courseDepartment: string,
  courseLevel: string
) {
  return role === Role.ADMIN
    || (userDepartment === courseDepartment && (role !== Role.STUDENT || userLevel === courseLevel));
}

export function courseLevelFilter(role: Role, userLevel: string, requestedLevel?: string) {
  const level = role === Role.STUDENT ? userLevel : requestedLevel;
  return level ? { level } : {};
}

export function canRevealQuizAnswers(isPublished: boolean, role: Role, quizCreatorId: string, userId: string) {
  return !isPublished || role === Role.ADMIN || quizCreatorId === userId;
}
