import { Hono } from 'hono'
import { adminMiddleware } from '../middleware/admin.js'
import { prisma } from '../lib/prisma.js'
import {
  questionSchema,
  updateQuestionSchema,
  gradeSchema,
  paginationSchema,
  toPrismaPage,
} from '../utils/validation.js'
import { scoringService } from '../services/scoringService.js'
import type { EssayGrade, RubricItem } from '../services/scoringService.js'

const admin = new Hono()

admin.use('*', adminMiddleware)

function getUserId(c: Parameters<typeof adminMiddleware>[0]): string {
  const payload = c.get('jwtPayload') as { userId: string }
  return payload.userId
}

admin.get('/questions', async c => {
  const pagination = paginationSchema.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  })

  const { skip, take } = pagination.success
    ? toPrismaPage(pagination.data)
    : { skip: 0, take: 20 }

  const categoryId = c.req.query('categoryId')
  const type = c.req.query('type')

  const where = {
    ...(categoryId ? { categoryId } : {}),
    ...(type ? { type } : {}),
  }

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        text: true,
        type: true,
        points: true,
        correctAnswer: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { answers: true },
        },
      },
    }),
    prisma.question.count({ where }),
  ])

  return c.json({
    questions,
    pagination: {
      total,
      page: pagination.success ? pagination.data.page : 1,
      limit: take,
      pages: Math.ceil(total / take),
    },
  })
})

admin.post('/questions', async c => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = questionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    )
  }

  const { text, type, categoryId, correctAnswer, points } = parsed.data

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  })
  if (!category) {
    return c.json({ error: `Category "${categoryId}" not found` }, 404)
  }

  const question = await prisma.question.create({
    data: {
      text,
      type,
      categoryId,
      correctAnswer: correctAnswer
        ? JSON.stringify(correctAnswer)
        : null,
      points,
    },
    select: {
      id: true,
      text: true,
      type: true,
      points: true,
      correctAnswer: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  })

  return c.json({ question }, 201)
})

admin.put('/questions/:id', async c => {
  const questionId = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = updateQuestionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    )
  }

  const existing = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  })
  if (!existing) {
    return c.json({ error: `Question "${questionId}" not found` }, 404)
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
      select: { id: true },
    })
    if (!category) {
      return c.json(
        { error: `Category "${parsed.data.categoryId}" not found` },
        404,
      )
    }
  }

  const question = await prisma.question.update({
    where: { id: questionId },
    data: {
      ...(parsed.data.text !== undefined ? { text: parsed.data.text } : {}),
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.categoryId !== undefined
        ? { categoryId: parsed.data.categoryId }
        : {}),
      ...(parsed.data.correctAnswer !== undefined
        ? {
            correctAnswer:
              parsed.data.correctAnswer != null
                ? JSON.stringify(parsed.data.correctAnswer)
                : null,
          }
        : {}),
      ...(parsed.data.points !== undefined
        ? { points: parsed.data.points }
        : {}),
    },
    select: {
      id: true,
      text: true,
      type: true,
      points: true,
      correctAnswer: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  })

  return c.json({ question })
})

admin.delete('/questions/:id', async c => {
  const questionId = c.req.param('id')

  const existing = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  })
  if (!existing) {
    return c.json({ error: `Question "${questionId}" not found` }, 404)
  }

  await prisma.question.delete({ where: { id: questionId } })

  return c.json({ message: 'Question deleted successfully' })
})

admin.get('/categories', async c => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      _count: { select: { questions: true } },
    },
  })

  return c.json({ categories })
})

admin.post('/categories', async c => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { categorySchema } = await import('../utils/validation.js')
  const parsed = categorySchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    )
  }

  const existing = await prisma.category.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  })
  if (existing) {
    return c.json(
      { error: `Category with slug "${parsed.data.slug}" already exists` },
      409,
    )
  }

  const category = await prisma.category.create({
    data: parsed.data,
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  })

  return c.json({ category }, 201)
})

admin.get('/answers/pending', async c => {
  const pagination = paginationSchema.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  })

  const { skip, take } = pagination.success
    ? toPrismaPage(pagination.data)
    : { skip: 0, take: 20 }

  const where = {
    score: null,
    question: { type: 'essay' },
  }

  const [answers, total] = await Promise.all([
    prisma.answer.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
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
            correctAnswer: true,
            category: { select: { id: true, name: true, slug: true } },
          },
        },
        session: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    }),
    prisma.answer.count({ where }),
  ])

  return c.json({
    answers,
    pagination: {
      total,
      page: pagination.success ? pagination.data.page : 1,
      limit: take,
      pages: Math.ceil(total / take),
    },
  })
})

admin.post('/answers/:id/grade', async c => {
  const answerId = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = gradeSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    )
  }

  const { grades, comment: _comment } = parsed.data

  const result = await prisma.$transaction(async tx => {
    const answer = await tx.answer.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        sessionId: true,
        score: true,
        question: {
          select: {
            id: true,
            type: true,
            points: true,
            correctAnswer: true,
          },
        },
      },
    })

    if (!answer) return null

    if (answer.question.type !== 'essay') {
      throw new Error('Only essay answers can be graded with this endpoint')
    }

    const rubric: RubricItem[] = Array.isArray(answer.question.correctAnswer)
      ? (answer.question.correctAnswer as unknown as RubricItem[])
      : grades.map(g => ({
          criterion: g.criterion,
          maxPoints: answer.question.points,
        }))

    const essayGrades: EssayGrade[] = grades.map(g => ({
      criterion: g.criterion,
      points: g.points,
    }))

    const raw = scoringService.scoreEssay(essayGrades, rubric)
    const maxScore = scoringService.maxEssayScore(rubric)
    const scaled =
      maxScore > 0
        ? Math.round((raw / maxScore) * answer.question.points * 100) / 100
        : 0

    const updatedAnswer = await tx.answer.update({
      where: { id: answerId },
      data: { score: scaled, isCorrect: scaled >= answer.question.points },
      select: {
        id: true,
        sessionId: true,
        questionId: true,
        userAnswer: true,
        score: true,
        isCorrect: true,
        updatedAt: true,
      },
    })

    const sessionAnswers = await tx.answer.findMany({
      where: { sessionId: answer.sessionId },
      select: { score: true },
    })

    const allGraded = sessionAnswers.every(a => a.score !== null)

    if (allGraded) {
      const totalScore = sessionAnswers.reduce(
        (sum, a) => sum + (a.score ?? 0),
        0,
      )
      await tx.session.update({
        where: { id: answer.sessionId },
        data: {
          score: Math.round(totalScore * 100) / 100,
          status: 'completed',
          completedAt: new Date(),
        },
      })
    }

    return updatedAnswer
  })

  if (!result) {
    return c.json({ error: `Answer "${answerId}" not found` }, 404)
  }

  return c.json({ answer: result })
})

admin.get('/students/:userId/stats', async c => {
  const targetUserId = c.req.param('userId')

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  if (!user) {
    return c.json({ error: `User "${targetUserId}" not found` }, 404)
  }

  const sessions = await prisma.session.findMany({
    where: { userId: targetUserId, status: 'completed' },
    select: {
      id: true,
      score: true,
      startedAt: true,
      completedAt: true,
      answers: {
        select: {
          score: true,
          isCorrect: true,
          question: {
            select: {
              type: true,
              points: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  })

  const totalSessions = sessions.length
  const scores = sessions.map(s => s.score ?? 0)
  const averageScore =
    totalSessions > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / totalSessions) * 100) /
        100
      : 0
  const bestScore = totalSessions > 0 ? Math.max(...scores) : 0
  const worstScore = totalSessions > 0 ? Math.min(...scores) : 0

  const allAnswers = sessions.flatMap(s => s.answers)
  const totalAnswers = allAnswers.length
  const correctAnswers = allAnswers.filter(a => a.isCorrect === true).length

  const categoryMap = new Map<
    string,
    { name: string; slug: string; total: number; correct: number }
  >()

  for (const answer of allAnswers) {
    const cat = answer.question.category
    const entry = categoryMap.get(cat.id) ?? {
      name: cat.name,
      slug: cat.slug,
      total: 0,
      correct: 0,
    }
    entry.total += 1
    if (answer.isCorrect) entry.correct += 1
    categoryMap.set(cat.id, entry)
  }

  const categoryStats = Array.from(categoryMap.entries()).map(([id, data]) => ({
    categoryId: id,
    ...data,
    accuracy:
      data.total > 0
        ? Math.round((data.correct / data.total) * 10000) / 100
        : 0,
  }))

  const [inProgressCount, expiredCount] = await Promise.all([
    prisma.session.count({
      where: { userId: targetUserId, status: 'in_progress' },
    }),
    prisma.session.count({
      where: { userId: targetUserId, status: 'expired' },
    }),
  ])

  return c.json({
    user,
    stats: {
      sessions: {
        completed: totalSessions,
        inProgress: inProgressCount,
        expired: expiredCount,
        total: totalSessions + inProgressCount + expiredCount,
      },
      scores: {
        average: averageScore,
        best: bestScore,
        worst: worstScore,
      },
      answers: {
        total: totalAnswers,
        correct: correctAnswers,
        accuracy:
          totalAnswers > 0
            ? Math.round((correctAnswers / totalAnswers) * 10000) / 100
            : 0,
      },
      byCategory: categoryStats,
    },
    recentSessions: sessions.slice(0, 5).map(s => ({
      id: s.id,
      score: s.score,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      answerCount: s.answers.length,
    })),
  })
})

admin.get('/students', async c => {
  const pagination = paginationSchema.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  })

  const { skip, take } = pagination.success
    ? toPrismaPage(pagination.data)
    : { skip: 0, take: 20 }

  const [students, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'student' },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    }),
    prisma.user.count({ where: { role: 'student' } }),
  ])

  return c.json({
    students,
    pagination: {
      total,
      page: pagination.success ? pagination.data.page : 1,
      limit: take,
      pages: Math.ceil(total / take),
    },
  })
})

export default admin
