import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import auth from "./routes/auth.js"
import "dotenv/config"

// Создаем серверное приложение
const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Простой endpoint
app.get('/health', (c) => {
  return c.json({"status":"ok"});
});

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})

app.route("/api/auth", auth)

// app.get("/health", (c) => c.json({ status: "ok" }))

export default app
