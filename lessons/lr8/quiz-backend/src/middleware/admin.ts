import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import { prisma } from '../lib/prisma.js'

const JWT_SECRET =
  process.env['JWT_SECRET'] ?? 'your-secret-key-change-in-production'

export async function adminMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)

  let payload: { userId?: string }

  try {
    payload = (await verify(token, JWT_SECRET, 'HS256')) as { userId: string }
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }

  if (!payload.userId) {
    return c.json({ error: 'Invalid token payload' }, 401)
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true },
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden: admin access required' }, 403)
  }

  // Attach payload so downstream handlers can use it
  c.set('jwtPayload', payload)

  await next()
}
