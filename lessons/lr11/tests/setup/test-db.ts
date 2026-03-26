import { prisma } from "../../quiz-backend/src/lib/prisma";

// Очищает все таблицы между тестами
export async function cleanDatabase() {
  await prisma.answer.deleteMany();
  await prisma.session.deleteMany();
  await prisma.question.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

// Создаёт тестового пользователя-студента
export async function createTestUser() {
  return await prisma.user.create({
    data: {
      email: "test@example.com",
      name: "Test User",
      githubId: 12345,
      role: "student",
    },
  });
}

// Создаёт тестового администратора
export async function createTestAdmin() {
  return await prisma.user.create({
    data: {
      email: "admin@example.com",
      name: "Admin User",
      githubId: 99999,
      role: "admin",
    },
  });
}