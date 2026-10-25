import { Department, NotificationType } from "@prisma/client";
import { prisma } from "./prisma.js";

type NotificationInput = {
  type: NotificationType;
  message: string;
  link?: string;
  department?: Department;
};

export async function notifyUsers(input: NotificationInput, emit: (userId: string, notification: unknown) => void) {
  const users = await prisma.user.findMany({
    where: input.department ? { department: input.department } : {},
    select: { id: true }
  });
  if (!users.length) return;
  const created = await prisma.notification.createManyAndReturn({
    data: users.map(({ id }) => ({ userId: id, type: input.type, message: input.message, link: input.link }))
  });
  for (const notification of created) emit(notification.userId, notification);
}
