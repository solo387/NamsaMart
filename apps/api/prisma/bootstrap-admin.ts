import dotenv from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { Department, PrismaClient, Role } from "@prisma/client";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
dotenv.config();

const inputSchema = z.object({
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(100),
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email().max(254),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128)
});
const prisma = new PrismaClient();

async function main() {
  const parsed = inputSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and a 12-128 character BOOTSTRAP_ADMIN_PASSWORD.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.BOOTSTRAP_ADMIN_PASSWORD, 12);
  const user = await prisma.$transaction(async (transaction) => {
    const existingAdmin = await transaction.user.findFirst({
      where: { role: Role.ADMIN },
      select: { id: true }
    });
    if (existingAdmin) {
      throw new Error("An administrator already exists. Bootstrap is allowed only for the first administrator.");
    }

    return transaction.user.create({
      data: {
        name: parsed.data.BOOTSTRAP_ADMIN_NAME,
        email: parsed.data.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: Role.ADMIN,
        department: Department.NURSING,
        level: "Level 100",
        cohortVerified: true,
        notificationPreference: { create: {} }
      },
      select: { id: true, name: true, email: true }
    });
  }, { isolationLevel: "Serializable" });

  console.info(`Created the initial administrator account for ${user.email}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Administrator bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
