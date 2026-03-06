import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import auth from './routes/auth.js'
import sessions from './routes/sessions.js'
import admin from './routes/admin.js'

const app = new Hono()

app.use('*', logger())
app.use('*', cors())

app.get('/health', c => {
  return c.json({ status: 'ok' })
})

app.route('/api/auth', auth)
app.route('/api/sessions', sessions)
app.route('/api/admin', admin)

app.notFound(c => {
  return c.json({ error: `Route ${c.req.method} ${c.req.path} not found` }, 404)
})

app.onError((err, c) => {
  console.error('[Server Error]', err)
  return c.json({ error: 'Internal server error' }, 500)
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  info => {
    console.log(`\n🚀 Server running on http://localhost:${info.port}`)
    console.log(`\n── Auth ──────────────────────────────────────────`)
    console.log(`   POST /api/auth/github/callback`)
    console.log(`   GET  /api/auth/me`)
    console.log(`\n── Sessions ──────────────────────────────────────`)
    console.log(`   POST /api/sessions`)
    console.log(`   GET  /api/sessions`)
    console.log(`   GET  /api/sessions/:id`)
    console.log(`   POST /api/sessions/:id/answers`)
    console.log(`   POST /api/sessions/:id/submit`)
    console.log(`\n── Admin ─────────────────────────────────────────`)
    console.log(`   GET  /api/admin/questions`)
    console.log(`   POST /api/admin/questions`)
    console.log(`   PUT  /api/admin/questions/:id`)
    console.log(`   DELETE /api/admin/questions/:id`)
    console.log(`   GET  /api/admin/categories`)
    console.log(`   POST /api/admin/categories`)
    console.log(`   GET  /api/admin/answers/pending`)
    console.log(`   POST /api/admin/answers/:id/grade`)
    console.log(`   GET  /api/admin/students`)
    console.log(`   GET  /api/admin/students/:userId/stats\n`)
  },
)
