import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import storesRouter from './routes/stores.js'
import authRouter from './routes/auth.js'

const app = express()
const port = process.env.PORT || 4000

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/stores', storesRouter)

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`)
})
