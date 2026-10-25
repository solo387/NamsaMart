import dotenv from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import {
  Department,
  NewsCategory,
  NotificationType,
  PrismaClient,
  QuestionType,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();
dotenv.config({ path: resolve(process.cwd(), "../../.env") });
dotenv.config();
const password = process.env.SEED_PASSWORD || "StudyNamsa!2026";

async function seedUser(email: string, name: string, role: Role, department: Department, level: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, department, level, passwordHash, cohortVerified: true },
    create: {
      email, name, role, department, level, passwordHash, cohortVerified: true,
      notificationPreference: { create: {} }
    }
  });
}

async function main() {
  const [admin, lecturer, nursingStudent, midwiferyStudent, mentalHealthStudent] = await Promise.all([
    seedUser("admin@namsamart.edu", "Ama Ofori", Role.ADMIN, Department.NURSING, "Level 300"),
    seedUser("lecturer@namsamart.edu", "Dr. Kofi Mensah", Role.LECTURER, Department.NURSING, "Level 300"),
    seedUser("student@namsamart.edu", "Abena Owusu", Role.STUDENT, Department.NURSING, "Level 300"),
    seedUser("midwifery@namsamart.edu", "Esi Boateng", Role.STUDENT, Department.MIDWIFERY, "Level 200"),
    seedUser("mentalhealth@namsamart.edu", "Yaw Asante", Role.STUDENT, Department.MENTAL_HEALTH, "Level 300")
  ]);

  const courses = await Promise.all([
    prisma.course.upsert({
      where: { code: "NUR 314" },
      update: {},
      create: {
        code: "NUR 314", title: "Adult Health Nursing II", department: Department.NURSING, level: "Level 300",
        description: "Evidence-based nursing care for adults with complex medical and surgical conditions."
      }
    }),
    prisma.course.upsert({
      where: { code: "NUR 306" },
      update: {},
      create: {
        code: "NUR 306", title: "Pharmacology for Nurses", department: Department.NURSING, level: "Level 300",
        description: "Safe medication administration, dosage calculations, and monitoring for therapeutic effects."
      }
    }),
    prisma.course.upsert({
      where: { code: "MID 208" },
      update: {},
      create: {
        code: "MID 208", title: "Antenatal and Intrapartum Care", department: Department.MIDWIFERY, level: "Level 200",
        description: "Holistic antenatal assessment, birth planning, and respectful intrapartum care."
      }
    }),
    prisma.course.upsert({
      where: { code: "MHS 312" },
      update: {},
      create: {
        code: "MHS 312", title: "Psychiatric and Mental Health Nursing", department: Department.MENTAL_HEALTH, level: "Level 300",
        description: "Therapeutic communication, recovery-oriented care, and common mental health conditions."
      }
    })
  ]);
  const [adultHealth, pharmacology, antenatal, mentalHealth] = courses;

  await prisma.enrollment.createMany({
    data: [
      { userId: nursingStudent.id, courseId: adultHealth.id },
      { userId: nursingStudent.id, courseId: pharmacology.id },
      { userId: midwiferyStudent.id, courseId: antenatal.id },
      { userId: mentalHealthStudent.id, courseId: mentalHealth.id }
    ],
    skipDuplicates: true
  });

  await prisma.slide.upsert({
    where: { id: "seed-slide-sepsis" },
    update: {},
    create: {
      id: "seed-slide-sepsis",
      title: "WHO clinical reference: early sepsis recognition",
      description: "Official clinical guidance on early identification and management of sepsis.",
      courseId: adultHealth.id,
      uploadedById: lecturer.id,
      fileUrl: "https://www.who.int/publications/i/item/9789240011632",
      publicId: "seed/early-recognition-sepsis",
      type: "application/pdf",
      mimeType: "application/pdf",
      fileSize: 0,
      approved: true
    }
  });

  await prisma.quiz.upsert({
    where: { id: "seed-quiz-sepsis" },
    update: {},
    create: {
      id: "seed-quiz-sepsis",
      title: "Sepsis recognition and first response",
      description: "Review early recognition, escalation, and safe nursing priorities.",
      courseId: adultHealth.id,
      createdById: lecturer.id,
      durationMinutes: 12,
      isPublished: true,
      questions: {
        create: [
          {
            order: 0,
            type: QuestionType.MCQ,
            text: "Which finding in a patient with suspected infection requires the most urgent escalation?",
            options: ["New confusion with falling blood pressure", "Mild thirst after walking", "Chronic joint stiffness", "A stable appetite"],
            correctAnswer: "New confusion with falling blood pressure",
            points: 2
          },
          {
            order: 1,
            type: QuestionType.TRUE_FALSE,
            text: "A nurse should promptly escalate a new change in mental status when sepsis is suspected.",
            options: ["True", "False"],
            correctAnswer: "true",
            points: 1
          },
          {
            order: 2,
            type: QuestionType.SHORT_ANSWER,
            text: "What is the name of the structured approach used to communicate urgent clinical concerns?",
            correctAnswer: "SBAR",
            points: 1
          }
        ]
      }
    }
  });

  await prisma.classSession.upsert({
    where: { id: "seed-class-clinical-reasoning" },
    update: {},
    create: {
      id: "seed-class-clinical-reasoning",
      title: "Clinical reasoning: recognising patient deterioration",
      courseId: adultHealth.id,
      hostId: lecturer.id,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    }
  });

  await prisma.news.upsert({
    where: { id: "seed-news-skills-lab" },
    update: {},
    create: {
      id: "seed-news-skills-lab",
      title: "Clinical skills laboratory: medication safety refresher",
      body: "Level 300 Nursing students are invited to a practical medication-safety refresher this Friday at 10:00 in the clinical skills laboratory. Bring your drug calculation workbook and student identification. The session will cover patient identification, allergy checks, dose calculations, and clear documentation.",
      category: NewsCategory.EVENT,
      department: Department.NURSING,
      authorId: admin.id
    }
  });

  await prisma.notification.upsert({
    where: { id: "seed-notification-welcome" },
    update: {},
    create: {
      id: "seed-notification-welcome",
      userId: nursingStudent.id,
      type: NotificationType.SYSTEM,
      message: "Welcome to NamsaMart. Your Adult Health Nursing learning space is ready.",
      link: "/dashboard"
    }
  });

  console.info(`Seeded ${courses.length} courses and 5 development accounts.`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
