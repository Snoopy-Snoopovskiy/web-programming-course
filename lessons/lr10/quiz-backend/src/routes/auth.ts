import { Hono } from "hono"
import { sign } from "hono/jwt"
import { githubCodeSchema } from "../utils/validation.js"
import { prisma } from "../lib/prisma.js"
import { verify } from "hono/jwt"
import { getGitHubUserByCode } from "../services/github.js"
 
const auth = new Hono()
const JWT_SECRET = process.env.JWT_SECRET!
const EXTERNAL_API = "http://dancv.ddns.net"
 
type ExternalUser = {
  id: string
  githubUsername: string
  githubId: number
  avatarUrl: string
  firstName?: string
  lastName?: string
  role: string
}
 
type ExternalAuthResponse = {
  token: string
  user: ExternalUser
}
 
// Авторизуемся на сервере преподавателя — получаем токен И данные пользователя
async function getExternalAuth(code: string): Promise<ExternalAuthResponse | null> {
  try {
    const res = await fetch(`${EXTERNAL_API}/api/auth/github/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    if (!res.ok) return null
    const data = await res.json() as ExternalAuthResponse
    if (!data.token || !data.user) return null
    return data
  } catch {
    return null
  }
}
 
auth.post("/github/callback", async (c) => {
  try {
    const body = await c.req.json()
 
    const result = githubCodeSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: "Invalid code" }, 400)
    }
    const { code } = result.data
 
    // Для тестового кода — используем старый GitHub flow
    if (code.startsWith("test_")) {
      const githubUser = await getGitHubUserByCode(code)
      const user = await prisma.user.upsert({
        where: { githubId: String(githubUser.id) },
        update: {
          email: githubUser.email ?? "no-email@github.com",
          name: githubUser.name,
        },
        create: {
          githubId: String(githubUser.id),
          email: githubUser.email ?? "no-email@github.com",
          name: githubUser.name,
        },
      })
      const token = await sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        "HS256"
      )
      return c.json({ token, user })
    }
 
    // Для реального code — используем внешний API (он сам обращается к GitHub)
    const externalAuth = await getExternalAuth(code)
    if (!externalAuth) {
      return c.json({ error: "Failed to authenticate with external API" }, 401)
    }
 
    const { token: externalToken, user: externalUser } = externalAuth
 
    // Сохраняем/обновляем пользователя в своей БД
    const user = await prisma.user.upsert({
      where: { githubId: String(externalUser.githubId) },
      update: {
        name: [externalUser.firstName, externalUser.lastName].filter(Boolean).join(" ") || externalUser.githubUsername,
        externalToken,
      },
      create: {
        githubId: String(externalUser.githubId),
        email: `${externalUser.githubUsername}@github.com`,
        name: [externalUser.firstName, externalUser.lastName].filter(Boolean).join(" ") || externalUser.githubUsername,
        externalToken,
      },
    })
 
    const token = await sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      "HS256"
    )
 
    return c.json({ token, user })
  } catch (error) {
    console.error('Auth error:', error)
    return c.json({ error: "Server error" }, 500)
  }
})
 
async function verifyToken(c: any) {
  const authHeader = c.req.header("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  const token = authHeader.split(" ")[1]
  try {
    return await verify(token, process.env.JWT_SECRET!, "HS256")
  } catch {
    return null
  }
}
 
auth.get("/me", async (c) => {
  const payload = await verifyToken(c)
  if (!payload) return c.json({ error: "Unauthorized" }, 401)
 
  const user = await prisma.user.findUnique({
    where: { id: payload.userId as string },
  })
  if (!user) return c.json({ error: "User not found" }, 404)
 
  return c.json({ user })
})
 
export default auth