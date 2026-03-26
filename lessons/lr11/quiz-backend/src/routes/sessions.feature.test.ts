import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../src/index.js";
import { prisma } from "../../src/lib/prisma.js";
import { sign } from "hono/jwt";


describe("Sessions API — авторизация", () => {
  it("GET /api/sessions — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(401);
  });

  it("POST /api/sessions — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("POST /api/sessions/:id/answers — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions/some-id/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: "q1", userAnswer: ["a"] }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /api/sessions/:id/submit — без токена возвращает 401", async () => {
    const res = await app.request("/api/sessions/some-id/submit", { method: "POST" });
    expect(res.status).toBe(401);
  });
});

const JWT_SECRET = "your-secret-key-change-in-production";

// Тестовые данные — создаём один раз перед всеми тестами
let testUserId: string;
let testToken: string;
let testCategoryId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: "session-test@example.com",
      name: "Session Test User",
      githubId: 77777,
      role: "student",
    },
  });
  testUserId = user.id;

  testToken = await sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    "HS256"
  );

  const category = await prisma.category.create({
    data: {
      name: "Test Category",
      slug: "test-category-session",
    },
  });
  testCategoryId = category.id;

  await prisma.question.createMany({
    data: [
      {
        text: "Что такое HTTP?",
        type: "multiple-select",
        categoryId: category.id,
        correctAnswer: JSON.stringify(["a"]),
        points: 1,
      },
      {
        text: "Что такое REST?",
        type: "essay",
        categoryId: category.id,
        points: 2,
      },
    ],
  });
});

afterAll(async () => {
  // Очищаем тестовые данные после всех тестов, чтобы не было мусора
  await prisma.answer.deleteMany({ where: { session: { userId: testUserId } } });
  await prisma.session.deleteMany({ where: { userId: testUserId } });
  await prisma.question.deleteMany({ where: { categoryId: testCategoryId } });
  await prisma.category.delete({ where: { id: testCategoryId } });
  await prisma.user.delete({ where: { id: testUserId } });
});

describe("Sessions API — создание сессии с вопросами", () => {
  it("POST /api/sessions — возвращает сессию с пользователем и вопросами", async () => {
    const res = await app.request("/api/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${testToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ categoryId: testCategoryId }),
    });

    expect(res.status).toBe(201);

    const body = await res.json();

    // Проверяем что сессия создана
    expect(body.session).toBeDefined();
    expect(body.session.id).toBeDefined();
    expect(body.session.status).toBe("in_progress");

    // Проверяем что пользователь включён в ответ
    expect(body.session.user).toBeDefined();
    expect(body.session.user.id).toBe(testUserId);
    expect(body.session.user.email).toBe("session-test@example.com");

    // Проверяем что ответы - пустой массив, так как сессия только началсь
    expect(body.session.answers).toEqual([]);

    // Проверяем что вопросы возвращаются
    expect(body.questions).toBeDefined();
    expect(body.questions.length).toBe(2);

    // Проверяем структуру вопроса
    expect(body.questions[0].text).toBeDefined();
    expect(body.questions[0].type).toBeDefined();
    expect(body.questions[0].points).toBeDefined();

    // Проверяем количество вопросов и время выполнения
    expect(body.meta.availableQuestions).toBe(2);
    expect(body.meta.expiresIn).toBe("1 hour");
  });
});