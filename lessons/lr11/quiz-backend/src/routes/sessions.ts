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
const EXTERNAL_API = 'http://dancv.ddns.net'
 
sessions.use('*', authMiddleware)
 
function getUserId(c: Parameters<typeof authMiddleware>[0]): string {
  const payload = c.get('jwtPayload') as { userId: string }
  return payload.userId
}
 
type ExternalQuestion = {
  id: string
  type: 'single-select' | 'multiple-select' | 'essay'
  question: string
  categoryId?: string
  difficulty?: string
  maxPoints?: number
  options?: string[]
  minLength?: number
}
 
type ExternalSessionResponse = {
  sessionId: string
  userId: string
  status: string
  mode: string
  questionIds: string[]
  questions: ExternalQuestion[]
  totalQuestions: number
  answeredCount: number
  maxScore: number
  currentScore: number
  createdAt: string
  completedAt: string | null
  expiresAt: string
}
 
async function createExternalSession(
  externalToken: string,
  categoryId?: string,
): Promise<ExternalSessionResponse | null> {
  try {
    const res = await fetch(`${EXTERNAL_API}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${externalToken}`,
      },
      body: JSON.stringify(categoryId ? { categoryId } : {}),
    })
    if (!res.ok) return null
    return (await res.json()) as ExternalSessionResponse
  } catch {
    return null
  }
}
 
async function syncQuestionsFromExternal(
  questions: ExternalQuestion[],
): Promise<void> {
  // Сначала все уникальные категории
  const categoryIds = [...new Set(questions.map(q => q.categoryId ?? 'default'))]
  for (const categoryId of categoryIds) {
    await prisma.category.upsert({
      where: { slug: categoryId },
      update: {},
      create: { slug: categoryId, name: categoryId },
    })
  }
 
  // Затем вопросы — используем id категории из БД
  for (const q of questions) {
    const categoryId = q.categoryId ?? 'default'
    const cat = await prisma.category.findUnique({ where: { slug: categoryId } })
    await prisma.question.upsert({
      where: { id: q.id },
      update: {},
      create: {
        id: q.id,
        text: q.question,
        type: q.type,
        categoryId: cat?.id ?? categoryId,
        points: q.maxPoints ?? 1,
      },
    })
  }
}
 
sessions.post('/', async c => {
  let body: unknown = {}
  try {
    body = await c.req.json()
  } catch {
    // пустое тело — ок
  }
 
  const parsed = createSessionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      400,
    )
  }
 
  const userId = getUserId(c)
 
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, externalToken: true },
  })
  if (!user) return c.json({ error: 'User not found' }, 404)
 
  let externalSession: ExternalSessionResponse | null = null
  let questions: ExternalQuestion[] = []
 
  if (user.externalToken) {
    externalSession = await createExternalSession(
      user.externalToken,
      parsed.data.categoryId,
    )
    if (externalSession) {
      questions = externalSession.questions
      await syncQuestionsFromExternal(questions)
    }
  }
 
  // Fallback — вопросы из своей БД
  if (questions.length === 0) {
    const dbQuestions = await prisma.question.findMany(
      parsed.data.categoryId
        ? { where: { categoryId: parsed.data.categoryId } }
        : undefined,
    )
    questions = dbQuestions.map(q => ({
      id: q.id,
      type: q.type as ExternalQuestion['type'],
      question: q.text,
      categoryId: q.categoryId,
      maxPoints: q.points,
    }))
  }
 
  const session = await sessionService.createSession(userId)
  const maxScore = questions.reduce((sum, q) => sum + (q.maxPoints ?? 1), 0)
 
  return c.json(
    {
      sessionId: session.id,
      externalSessionId: externalSession?.sessionId ?? null,
      userId: session.userId,
      status: 'active',
      mode: externalSession?.mode ?? 'practice',
      questions: questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        difficulty: q.difficulty ?? 'medium',
        categoryId: q.categoryId,
        maxPoints: q.maxPoints ?? 1,
        options: q.options,
        minLength: q.minLength,
      })),
      totalQuestions: questions.length,
      answeredCount: 0,
      maxScore,
      currentScore: 0,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
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
  if (ownership.userId !== userId) return c.json({ error: 'Session not found' }, 404)
 
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
 
  const parsed = answerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      400,
    )
  }
 
  const { questionId, userAnswer } = parsed.data
 
  try {
    const answer = await sessionService.submitAnswer(sessionId, questionId, userAnswer)
    return c.json({ answer }, 201)
  } catch (err) {
    if (err instanceof SessionNotFoundError) return c.json({ error: err.message }, 404)
    if (err instanceof SessionExpiredError) return c.json({ error: err.message }, 410)
    if (err instanceof SessionAlreadyCompletedError) return c.json({ error: err.message }, 409)
    if (err instanceof QuestionNotFoundError) return c.json({ error: err.message }, 404)
    if (err instanceof DuplicateAnswerError) return c.json({ error: err.message }, 409)
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
  if (ownership.userId !== userId) return c.json({ error: 'Session not found' }, 404)
 
  try {
    const session = await sessionService.submitSession(sessionId)
    return c.json({ session })
  } catch (err) {
    if (err instanceof SessionNotFoundError) return c.json({ error: err.message }, 404)
    if (err instanceof SessionExpiredError) return c.json({ error: err.message }, 410)
    if (err instanceof SessionAlreadyCompletedError) return c.json({ error: err.message }, 409)
    throw err
  }
})
 
export default sessions