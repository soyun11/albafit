import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import storesRouter from './routes/stores.js'
import authRouter from './routes/auth.js'
import rubricsRouter from './routes/rubrics.js'
import sessionsRouter from './routes/sessions.js'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/stores', storesRouter)
app.use('/api/rubrics', rubricsRouter)
app.use('/api/sessions', sessionsRouter)

export default app
