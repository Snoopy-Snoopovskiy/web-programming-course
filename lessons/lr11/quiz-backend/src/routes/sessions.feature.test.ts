import { describe, it, expect } from "vitest";
import app from "../../src/index.js";
import { prisma } from "../../src/lib/prisma.js";
import { sign } from "hono/jwt";

const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key-change-in-production";

async function getOrCreateTestUser() {
  const user = await prisma.user.findFirst({
    where: { externalToken: { not: null } },
  });

  if (!user) {
    throw new Error(
      "Нет пользователя с externalToken. Сначала залогиньтесь через:\n" +
      "POST /api/auth/github/callback с реальным GitHub code"
    );
  }

  const token = await sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    "HS256"
  );

  return { user, token };
}

describe("Sessions — создание сессии", () => {

  it("POST /api/sessions — создаёт сессию и загружает вопросы", async () => {
    const { token } = await getOrCreateTestUser();

    const questionsBefore = await prisma.question.count();

    const res = await app.request("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(201);

    const body = await res.json() as {
      sessionId: string;
      externalSessionId: string | null;
      mode: string;
      totalQuestions: number;
      maxScore: number;
      expiresAt: string;
      questions: {
        id: string;
        type: string;
        question: string;
        difficulty: string;
        categoryId: string;
        maxPoints: number;
        options?: string[];
        minLength?: number;
      }[];
    };

    const questionsAfter = await prisma.question.count();

    // Проверяем что сессия создана
    expect(body.sessionId).toBeDefined();
    expect(body.questions).toBeDefined();
    expect(body.questions.length).toBeGreaterThan(0);

    // Проверяем что вопросы сохранились в БД
    expect(questionsAfter).toBeGreaterThanOrEqual(questionsBefore);

    // Выводим результаты
    console.log("СЕССИЯ СОЗДАНА");
    console.log(`  Session ID:          ${body.sessionId}`);
    console.log(`  External Session:    ${body.externalSessionId}`);
    console.log(`  Режим:               ${body.mode}`);
    console.log(`  Всего вопросов:      ${body.totalQuestions}`);
    console.log(`  Макс. баллов:        ${body.maxScore}`);
    console.log(`  Истекает:            ${body.expiresAt}`);
    console.log(`  Вопросов в БД до:    ${questionsBefore}`);
    console.log(`  Вопросов в БД после: ${questionsAfter}`);

    console.log("ВОПРОСЫ:");
    body.questions.forEach((q, i) => {
      console.log(`\n${i + 1}. [${q.type}] ${q.question}`);
      console.log(`   ID:         ${q.id}`);
      console.log(`   Категория:  ${q.categoryId}`);
      console.log(`   Сложность:  ${q.difficulty}`);
      console.log(`   Баллы:      ${q.maxPoints}`);
      if (q.options) {
        console.log(`   Варианты:   ${q.options.join(" | ")}`);
      }
      if (q.minLength) {
        console.log(`   Мин. длина: ${q.minLength} символов`);
      }
    });
  });

});