import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { prisma } from '../lib/prisma.js'
import { githubCallbackSchema } from '../utils/validation.js'

const auth = new Hono()

const JWT_SECRET =
  process.env['JWT_SECRET'] ?? 'your-secret-key-change-in-production'
const GITHUB_CLIENT_ID = process.env['GITHUB_CLIENT_ID'] ?? ''
const GITHUB_CLIENT_SECRET = process.env['GITHUB_CLIENT_SECRET'] ?? ''

interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
}

<<<<<<< HEAD
function getMockGitHubUser(code: string): GitHubUser {
  const suffix = code.replace(/^test_/, '') || 'user'
  const githubId =
    Array.from(suffix).reduce(
      (acc, ch) => (acc * 31 + ch.charCodeAt(0)) & 0x7fffffff,
      0,
    ) || 1
  return {
    id: githubId,
    login: `mock_${suffix}`,
    name: `Mock User (${suffix})`,
    email: `mock_${suffix}@example.com`,
=======
    const result = githubCodeSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: "Invalid code" }, 400)
    }
    const { code } = result.data

    const githubUser = await getGitHubUserByCode(code)

    const user = await prisma.user.upsert({
      where: { githubId: githubUser.id.toString() },
      update: {
        email: githubUser.email ?? "no-email@github.com",
        name: githubUser.name
      },
      create: {
        githubId: githubUser.id.toString() ,
        email: githubUser.email  ?? "no-email@github.com",
        name: githubUser.name
      }
    })

    const token = await sign(
      {
        userId: user.id,
        email: user.email
      },
      JWT_SECRET,
      "HS256"
    )

    return c.json({
      token,
      user
    })

  } catch (error) {
    return c.json({ error: "Server error" }, 500)
>>>>>>> labWork8
  }
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    access_token?: string
    error?: string
  }

  if (data.error || !data.access_token) {
    throw new Error(data.error ?? 'No access_token returned from GitHub')
  }

  return data.access_token
}

async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    }),
  ])

  if (!userRes.ok) {
    throw new Error(`Failed to fetch GitHub user: ${userRes.status}`)
  }

  const user = (await userRes.json()) as GitHubUser

  if (!user.email && emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{
      email: string
      primary: boolean
      verified: boolean
    }>
    const primary = emails.find(e => e.primary && e.verified)
    if (primary) {
      user.email = primary.email
    }
  }

  return user
}

auth.post('/github/callback', async c => {
  let body: unknown

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const parsed = githubCallbackSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    )
  }

  const { code } = parsed.data

  let githubUser: GitHubUser

  try {
    if (code.startsWith('test_')) {
      githubUser = getMockGitHubUser(code)
    } else {
      const accessToken = await exchangeCodeForToken(code)
      githubUser = await fetchGitHubUser(accessToken)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub OAuth failed'
    return c.json({ error: message }, 502)
  }

  const user = await prisma.user.upsert({
    where: { githubId: String(githubUser.id) },
    update: {
      name: githubUser.name ?? githubUser.login,
      email: githubUser.email,
    },
    create: {
      githubId: String(githubUser.id),
      name: githubUser.name ?? githubUser.login,
      email: githubUser.email,
      role: 'student',
    },
  })

  const token = await sign(
    {
      userId: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    JWT_SECRET,
  )

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      githubId: user.githubId,
      role: user.role,
      createdAt: user.createdAt,
    },
  })
})

auth.get('/me', async c => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)

  let payload: { userId?: string; email?: string }

  try {
    payload = (await verify(token, JWT_SECRET, 'HS256')) as {
      userId: string
      email: string
    }
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }

  if (!payload.userId) {
    return c.json({ error: 'Invalid token payload' }, 401)
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      githubId: true,
      role: true,
      createdAt: true,
    },
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({ user })
})

export default auth
