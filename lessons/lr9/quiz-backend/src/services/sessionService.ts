import { scoringService } from "./scoringService.js";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/index.js";

export class SessionNotFoundError extends Error {
  constructor() { super("Session not found"); }
}
export class SessionExpiredError extends Error {
  constructor() { super("Session has expired"); }
}
export class SessionAlreadyCompletedError extends Error {
  constructor() { super("Session already completed"); }
}
export class QuestionNotFoundError extends Error {
  constructor() { super("Question not found"); }
}
export class DuplicateAnswerError extends Error {
  constructor() { super("Answer already submitted for this question"); }
}

export class SessionService {
  async createSession(userId: string) {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1 час
    return await prisma.session.create({
      data: { userId, expiresAt },
    });
  }

  async getSession(sessionId: string, userId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        answers: {
          include: {
            question: {
              select: { id: true, text: true, type: true, points: true },
            },
          },
        },
      },
    });

    if (!session || session.userId !== userId) throw new SessionNotFoundError();
    return session;
  }

  async submitAnswer(sessionId: string, questionId: string, userAnswer: string[]) {
return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session) throw new SessionNotFoundError();
      if (session.status !== "in_progress") throw new SessionAlreadyCompletedError();
      if (session.expiresAt < new Date()) throw new SessionExpiredError();

      const question = await tx.question.findUnique({ where: { id: questionId } });
      if (!question) throw new QuestionNotFoundError();

      let score: number | null = null;
      let isCorrect: boolean | null = null;

      if (question.type === "single-select" && question.correctAnswer) {
        const correct = JSON.parse(question.correctAnswer) as string[];
        isCorrect = correct[0] === userAnswer[0];
        score = isCorrect ? question.points : 0;
      } else if (question.type === "multiple-select" && question.correctAnswer) {
        const correct = JSON.parse(question.correctAnswer) as string[];
        score = scoringService.scoreMultipleSelect(correct, userAnswer);
        isCorrect = score === question.points;
      }

      const answer = await tx.answer.upsert({
        where: { sessionId_questionId: { sessionId, questionId } },
        create: { sessionId, questionId, userAnswer: JSON.stringify(userAnswer), score, isCorrect },
        update: { userAnswer: JSON.stringify(userAnswer), score, isCorrect },
      });

      return answer;
    });
  }

  async submitSession(sessionId: string) {
return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { answers: true },
      });

      if (!session) throw new SessionNotFoundError();
      if (session.status !== "in_progress") throw new SessionAlreadyCompletedError();
      if (session.expiresAt < new Date()) throw new SessionExpiredError();

      const score = session.answers
        .filter((a: { score: number | null }) => a.score !== null)
        .reduce((sum: number, a: { score: number | null }) => sum + (a.score ?? 0), 0);

      return await tx.session.update({
        where: { id: sessionId },
        data: { status: "completed", score, completedAt: new Date() },
      });
    });
  }
}

export const sessionService = new SessionService();