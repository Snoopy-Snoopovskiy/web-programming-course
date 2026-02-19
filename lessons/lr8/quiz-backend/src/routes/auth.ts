import { Hono } from "hono"
import { sign } from "hono/jwt"
import { githubCodeSchema } from "../utils/validation.js"
import { PrismaClient } from "../generated/prisma/index.js"
import { verify } from "hono/jwt"

const auth = new Hono()
const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET!

auth.post("/github/callback", async (c) => {
  try {
    const body = await c.req.json()

    //Валидация
    const result = githubCodeSchema.safeParse(body)

    if (!result.success) {
      return c.json({ error: "Invalid code" }, 400)
    }

    const { code } = result.data

    let githubUser

    //Mock режим
    if (code.startsWith("test_")) {
      githubUser = {
        id: 12345,
        email: "test@example.com",
        name: "Test User"
      }
    } else {
      // Реальный режим (пока можно оставить заглушку)
      return c.json({ error: "Real GitHub OAuth not implemented yet" }, 501)
    }

    // Создать или обновить пользователя
    const user = await prisma.user.upsert({
      where: { githubId: githubUser.id },
      update: {
        email: githubUser.email,
        name: githubUser.name
      },
      create: {
        githubId: githubUser.id,
        email: githubUser.email,
        name: githubUser.name
      }
    })

    // Создать JWT
    const token = await sign(
      {
        userId: user.id,
        email: user.email
      },
      JWT_SECRET,
      "HS256"
    )

    // Вернуть ответ
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

auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const token = authHeader.split(" ")[1]

  try {
    const payload = await verify(
      token,
      process.env.JWT_SECRET!,
      "HS256"
    )

    const userId = (payload as any).userId as string

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return c.json({ error: "User not found" }, 404)
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        githubId: user.githubId,
        createdAt: user.createdAt
      }
    })

  } catch (error) {
    return c.json({ error: "Invalid token" }, 401)
  }
})
