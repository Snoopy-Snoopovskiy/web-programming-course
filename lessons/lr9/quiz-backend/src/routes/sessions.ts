import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { sessionService } from '../services/sessionService.js'
import {
  answerSchema,
  createSessionSchema,
  paginationSchema,
  toPrismaPage,
} from '../utils/validation.js'
import {
  SessionNotFoundError,
  SessionExpiredError,
  SessionAlreadyCompletedError,
  QuestionNotFoundError,
  DuplicateAnswerError,
} from '../services/sessionService.js'
import { prisma } from '../lib/prisma.js'

const sessions = new Hono()

sessions.use('*', authMiddleware)

function getUserId(c: Parameters<typeof authMiddleware>[0]): string {
  const payload = c.get('jwtPayload') as { userId: string }
  return payload.userId
}

sessions.post('/', async c => {
  let body: unknown = {}

  try {
    body = await c.req.json()
  } catch {
    // body
  }

  const parsed = createSessionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    )
  }

  const userId = getUserId(c)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })
  if (!user) return c.json({ error: 'User not found' }, 404)

  const questionCount = await prisma.question.count(
    parsed.data.categoryId
      ? { where: { categoryId: parsed.data.categoryId } }
      : undefined,
  )

  const session = await sessionService.createSession(userId)

  return c.json(
    {
      session,
      meta: {
        availableQuestions: questionCount,
        expiresIn: '1 hour',
      },
    },
    201,
  )
})

sessions.get('/', async c => {
  const userId = getUserId(c)

  const pagination = paginationSchema.safeParse({
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  })

  const { skip, take } = pagination.success
    ? toPrismaPage(pagination.data)
    : { skip: 0, take: 20 }

  const [items, total] = await Promise.all([
    prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        status: true,
        score: true,
        startedAt: true,
        expiresAt: true,
        completedAt: true,
        createdAt: true,
        _count: { select: { answers: true } },
      },
    }),
    prisma.session.count({ where: { userId } }),
  ])

  return c.json({
    sessions: items,
    pagination: {
      total,
      page: pagination.success ? pagination.data.page : 1,
      limit: take,
      pages: Math.ceil(total / take),
    },
  })
})

sessions.get('/:id', async c => {
  const sessionId = c.req.param('id')
  const userId = getUserId(c)

  try {
    const session = await sessionService.getSession(sessionId, userId)
    return c.json({ session })
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      return c.json({ error: err.message }, 404)
    }
    throw err
  }
})

sessions.post('/:id/answers', async c => {
  const sessionId = c.req.param('id')
  const userId = getUserId(c)

  const ownership = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  })
  if (!ownership) return c.json({ error: 'Session not found' }, 404)
  if (ownership.userId !== userId)
    return c.json({ error: 'Session not found' }, 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = answerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    )
  }

  const { questionId, userAnswer } = parsed.data

  try {
    const answer = await sessionService.submitAnswer(
      sessionId,
      questionId,
      userAnswer,
    )
    return c.json({ answer }, 201)
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      return c.json({ error: err.message }, 404)
    }
    if (err instanceof SessionExpiredError) {
      return c.json({ error: err.message }, 410)
    }
    if (err instanceof SessionAlreadyCompletedError) {
      return c.json({ error: err.message }, 409)
    }
    if (err instanceof QuestionNotFoundError) {
      return c.json({ error: err.message }, 404)
    }
    if (err instanceof DuplicateAnswerError) {
      return c.json({ error: err.message }, 409)
    }
    throw err
  }
})

sessions.post('/:id/submit', async c => {
  const sessionId = c.req.param('id')
  const userId = getUserId(c)

  const ownership = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  })
  if (!ownership) return c.json({ error: 'Session not found' }, 404)
  if (ownership.userId !== userId)
    return c.json({ error: 'Session not found' }, 404)

  try {
    const session = await sessionService.submitSession(sessionId)
    return c.json({ session })
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      return c.json({ error: err.message }, 404)
    }
    if (err instanceof SessionExpiredError) {
      return c.json({ error: err.message }, 410)
    }
    if (err instanceof SessionAlreadyCompletedError) {
      return c.json({ error: err.message }, 409)
    }
    throw err
  }
})

export default sessions
