import { Hono } from 'hono'
import auth from "./routes/auth.js"
import sessions from "./routes/sessions.js"
import admin from "./routes/admin.js"


const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/health', (c) => {
  return c.json({ status: "ok" });
});

app.route("/api/auth", auth)
app.route("/api/sessions", sessions)
app.route("/api/admin", admin)

export default app