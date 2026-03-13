import { Hono } from "hono"
import { sign } from "hono/jwt"
import { githubCodeSchema } from "../utils/validation.js"
import { prisma } from "../lib/prisma.js"
import { verify } from "hono/jwt"
import { getGitHubUserByCode } from "../services/github.js"

const auth = new Hono()
const JWT_SECRET = process.env.JWT_SECRET!

auth.post("/github/callback", async (c) => {
  try {
    const body = await c.req.json()

    const result = githubCodeSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: "Invalid code" }, 400)
    }
    const { code } = result.data

    const githubUser = await getGitHubUserByCode(code)

    const user = await prisma.user.upsert({
      where: {githubId: githubUser.id,},
      update: {
        email: githubUser.email ?? "no-email@github.com",
        name: githubUser.name
      },
      create: {
        githubId: githubUser.id,
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
  }
})

export default auth
async function verifyToken(c: any) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }
  const token = authHeader.split(" ")[1]
  try {
    const payload = await verify(
      token,
      process.env.JWT_SECRET!,
      "HS256"
    )

    return payload
  } catch {
    return null
  }
}

interface JWTPayload {
  userId: string
  email: string
}

auth.get("/me", async (c) => {
  const payload = await verifyToken(c)

  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const user = await prisma.user.findUnique({
    where: {id: payload.userId as string }
  })

  if (!user) {
    return c.json({ error: "User not found" }, 404)
  }

  return c.json({ user })
})
