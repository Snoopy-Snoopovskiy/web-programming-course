import { prisma } from '../lib/prisma.js'
import { scoringService } from './scoringService.js'

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Session "${id}" not found`)
    this.name = 'SessionNotFoundError'
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Session has expired')
    this.name = 'SessionExpiredError'
  }
}

export class SessionAlreadyCompletedError extends Error {
  constructor() {
    super('Session is already completed')
    this.name = 'SessionAlreadyCompletedError'
  }
}

export class QuestionNotFoundError extends Error {
  constructor(id: string) {
    super(`Question "${id}" not found`)
    this.name = 'QuestionNotFoundError'
  }
}

export class DuplicateAnswerError extends Error {
  constructor(questionId: string) {
    super(`Question "${questionId}" has already been answered in this session`)
    this.name = 'DuplicateAnswerError'
  }
}

interface QuestionRow {
  id: string
  type: string
  points: number
  correctAnswer: unknown
}

function autoScore(
  question: QuestionRow,
  userAnswer: unknown,
): { score: number | null; isCorrect: boolean | null } {
  const type = question.type

  if (type === 'essay') {
    return { score: null, isCorrect: null }
  }

  const correct = question.correctAnswer

  if (!correct || !Array.isArray(correct)) {
    return { score: null, isCorrect: null }
  }

  const correctStrings: string[] = correct.map(String)
  const studentStrings: string[] = Array.isArray(userAnswer)
    ? userAnswer.map(String)
    : [String(userAnswer)]

  if (type === 'single-select') {
    const studentAnswer = studentStrings[0] ?? ''
    const isCorrect =
      scoringService.scoreSingleSelect(
        correctStrings[0] ?? '',
        studentAnswer,
      ) === 1
    return {
      score: isCorrect ? question.points : 0,
      isCorrect,
    }
  }

  if (type === 'multiple-select') {
    const raw = scoringService.scoreMultipleSelect(
      correctStrings,
      studentStrings,
    )
    const maxRaw = correctStrings.length
    const scaled = maxRaw > 0 ? (raw / maxRaw) * question.points : 0
    const rounded = Math.round(scaled * 100) / 100
    return {
      score: rounded,
      isCorrect: rounded >= question.points,
    }
  }

  return { score: null, isCorrect: null }
}

export class SessionService {
  async createSession(userId: string) {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    const session = await prisma.session.create({
      data: {
        userId,
        status: 'in_progress',
        expiresAt,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        score: true,
        startedAt: true,
        expiresAt: true,
        completedAt: true,
        createdAt: true,
      },
    })

    return session
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    userAnswer: unknown,
  ) {
    return prisma.$transaction(async tx => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        select: { id: true, status: true, expiresAt: true },
      })

      if (!session) throw new SessionNotFoundError(sessionId)
      if (session.status === 'completed')
        throw new SessionAlreadyCompletedError()
      if (session.status === 'expired' || session.expiresAt < new Date()) {
        await tx.session.update({
          where: { id: sessionId },
          data: { status: 'expired' },
        })
        throw new SessionExpiredError()
      }

      const question = await tx.question.findUnique({
        where: { id: questionId },
        select: {
          id: true,
          type: true,
          points: true,
          correctAnswer: true,
        },
      })

      if (!question) throw new QuestionNotFoundError(questionId)

      const existing = await tx.answer.findUnique({
        where: { sessionId_questionId: { sessionId, questionId } },
        select: { id: true },
      })

      if (existing) throw new DuplicateAnswerError(questionId)

      const { score, isCorrect } = autoScore(question, userAnswer)

      const answer = await tx.answer.create({
        data: {
          sessionId,
          questionId,
          userAnswer: userAnswer as never,
          score,
          isCorrect,
        },
        select: {
          id: true,
          sessionId: true,
          questionId: true,
          userAnswer: true,
          score: true,
          isCorrect: true,
          createdAt: true,
          question: {
            select: {
              id: true,
              text: true,
              type: true,
              points: true,
            },
          },
        },
      })

      return answer
    })
  }

  async submitSession(sessionId: string) {
    return prisma.$transaction(async tx => {
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: {
          answers: {
            select: {
              id: true,
              score: true,
              isCorrect: true,
              question: {
                select: { type: true, points: true },
              },
            },
          },
        },
      })

      if (!session) throw new SessionNotFoundError(sessionId)
      if (session.status === 'completed')
        throw new SessionAlreadyCompletedError()
      if (session.status === 'expired' || session.expiresAt < new Date()) {
        await tx.session.update({
          where: { id: sessionId },
          data: { status: 'expired' },
        })
        throw new SessionExpiredError()
      }

      const totalScore = this.calculateScore(session.answers)

      const updated = await tx.session.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          score: totalScore,
          completedAt: new Date(),
        },
        select: {
          id: true,
          userId: true,
          status: true,
          score: true,
          startedAt: true,
          expiresAt: true,
          completedAt: true,
          createdAt: true,
          answers: {
            select: {
              id: true,
              questionId: true,
              userAnswer: true,
              score: true,
              isCorrect: true,
            },
          },
        },
      })

      return updated
    })
  }

  /**
   * Get a session with all answers and their questions.
   * Verifies the session belongs to the given userId.
   */
  async getSession(sessionId: string, userId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        status: true,
        score: true,
        startedAt: true,
        expiresAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        answers: {
          select: {
            id: true,
            questionId: true,
            userAnswer: true,
            score: true,
            isCorrect: true,
            createdAt: true,
            question: {
              select: {
                id: true,
                text: true,
                type: true,
                points: true,
                category: {
                  select: { id: true, name: true, slug: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session) throw new SessionNotFoundError(sessionId)

    if (session.userId !== userId) {
      throw new SessionNotFoundError(sessionId)
    }

    return session
  }

  private calculateScore(
    answers: Array<{
      score: number | null
      question: { type: string; points: number }
    }>,
  ): number {
    let total = 0

    for (const answer of answers) {
      if (answer.score !== null) {
        total += answer.score
      }
    }

    return Math.round(total * 100) / 100
  }
}

export const sessionService = new SessionService()
