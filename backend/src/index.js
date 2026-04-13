import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

import tasksRouter  from './routes/tasks.js'
import bidsRouter   from './routes/bids.js'
import agentsRouter from './routes/agents.js'
import verifyRouter from './routes/verify.js'
import { pool }     from './lib/db.js'

const app  = express()
const PORT = process.env.PORT || 3001

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',   // set to your FE domain in prod
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: [
    'Content-Type', 'Authorization',
    'x-wallet-address', 'x-wallet-message', 'x-wallet-signature',
    'payment-signature', 'x-payment',
  ],
}))

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Generous for local dev — frontend + 2 agents all hit from same IP.
// Tighten in production via NODE_ENV check.
// const limiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: process.env.NODE_ENV === 'production' ? 300 : 2000,
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { error: 'Too many requests, slow down' },
// })
// app.use(limiter)

// const writeLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: process.env.NODE_ENV === 'production' ? 60 : 500,
//   message: { error: 'Too many write requests' },
// })

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({
      status:  'ok',
      db:      'connected',
      time:    new Date().toISOString(),
      env:     process.env.NODE_ENV,
    })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

// ── Status page ──────────────────────────────────────────────────────────────
app.get('/status', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1')
    const dbConnected = !!dbResult

    // Get stats
    const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks')
    const bidsCount = await pool.query('SELECT COUNT(*) FROM bids')
    const agentsCount = await pool.query('SELECT COUNT(*) FROM agents')
    const openTasks = await pool.query("SELECT COUNT(*) FROM tasks WHERE status = 'open'")

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
      },
      stats: {
        tasks: parseInt(tasksCount.rows[0].count),
        bids: parseInt(bidsCount.rows[0].count),
        agents: parseInt(agentsCount.rows[0].count),
        openTasks: parseInt(openTasks.rows[0].count),
      },
      agents: {
        bidder: {
          url: 'https://agent-task-market-agent-1.onrender.com',
          status: 'unknown', // Will be checked dynamically below
        },
        bidder2: {
          url: 'https://agent-task-market-agent-2.onrender.com',
          status: 'unknown',
        },
      },
    })
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message })
  }
})

// ── Agent status checker ──────────────────────────────────────────────────────
async function checkAgentStatus(url) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok ? 'online' : 'degraded'
  } catch {
    return 'offline'
  }
}

// Enhanced status with live agent checks
app.get('/status/live', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT 1')
    const dbConnected = !!dbResult

    const tasksCount = await pool.query('SELECT COUNT(*) FROM tasks')
    const bidsCount = await pool.query('SELECT COUNT(*) FROM bids')
    const agentsCount = await pool.query('SELECT COUNT(*) FROM agents')
    const openTasks = await pool.query("SELECT COUNT(*) FROM tasks WHERE status = 'open'")

    const [bidderStatus, bidder2Status] = await Promise.all([
      checkAgentStatus('https://agent-task-market-agent-1.onrender.com'),
      checkAgentStatus('https://agent-task-market-agent-2.onrender.com'),
    ])

    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
      },
      stats: {
        tasks: parseInt(tasksCount.rows[0].count),
        bids: parseInt(bidsCount.rows[0].count),
        agents: parseInt(agentsCount.rows[0].count),
        openTasks: parseInt(openTasks.rows[0].count),
      },
      agents: {
        bidder: {
          name: 'DataHunter-1',
          url: 'https://agent-task-market-agent-1.onrender.com',
          status: bidderStatus,
          specialties: ['data_collection', 'content_gen'],
        },
        bidder2: {
          name: 'CodeAuditor-1',
          url: 'https://agent-task-market-agent-2.onrender.com',
          status: bidder2Status,
          specialties: ['code_review', 'defi_ops'],
        },
      },
    })
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message })
  }
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/tasks',   tasksRouter)
app.use('/bids',     bidsRouter)
app.use('/agents',  agentsRouter)
app.use('/verify',   verifyRouter)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` })
})

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   AgentMarket API                        ║
  ║   http://localhost:${PORT}                  ║
  ║   env: ${process.env.NODE_ENV?.padEnd(33)}║
  ╚══════════════════════════════════════════╝
  `)
})

export default app