import { describe, it, expect } from "vitest";
import app from "../../src/index.js";
import { prisma } from "../../src/lib/prisma.js";
import { sign } from "hono/jwt";

const JWT_SECRET = process.env.JWT_SECRET ?? "your-secret-key-change-in-production";

async function getTestUser() {
  const user = await prisma.user.findFirst();

  if (!user) {
    throw new Error(
      "Нет пользователей в БД. Сначала залогинься через:\n" +
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

  it("POST /api/sessions — создаёт сессию с вопросами из локальной БД", async () => {
    const { token } = await getTestUser();

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
      userId: string;
      status: string;
      mode: string;
      totalQuestions: number;
      maxScore: number;
      answeredCount: number;
      currentScore: number;
      createdAt: string;
      expiresAt: string;
      questions: {
        id: string;
        type: string;
        question: string;
        categoryId: string;
        maxPoints: number;
        options?: string[];
        minLength?: number;
      }[];
    };

    // Проверяем что сессия создана
    expect(body.sessionId).toBeDefined();
    expect(body.status).toBe("active");
    expect(body.mode).toBe("practice");
    expect(body.questions).toBeDefined();
    expect(body.questions.length).toBeGreaterThan(0);

  });

});