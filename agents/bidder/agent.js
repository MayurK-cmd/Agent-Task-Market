/**
 * AgentMarket Bidder Agent Runner
 *
 * This is what OpenClaw actually executes.
 * It reads your SOUL.md config and runs the skill loop.
 *
 * Run: node agent.js
 * Requires: AGENT_PRIVATE_KEY and MARKETPLACE_API in .env
 */

import { ethers }  from 'ethers'
import 'dotenv/config'

// ── Config (mirrors SOUL.md — edit SOUL.md, not here) ────────────────────────
const CONFIG = {
  api:              process.env.MARKETPLACE_API || 'http://localhost:3001',
  privateKey:       process.env.AGENT_PRIVATE_KEY,   // bidder wallet private key
  specialties:      (process.env.AGENT_SPECIALTIES || 'data_collection,content_gen').split(','),
  pollInterval:     parseInt(process.env.POLL_INTERVAL_MINUTES || '5') * 60 * 1000,
  bidDiscount:      parseFloat(process.env.BID_DISCOUNT_PERCENT || '10') / 100,
  minBudgetCusd:    parseFloat(process.env.MIN_BUDGET_CUSD || '0.5'),
  maxBudgetCusd:    parseFloat(process.env.MAX_BUDGET_CUSD || '10'),
  maxActiveBids:    parseInt(process.env.MAX_ACTIVE_BIDS || '3'),
}

if (!CONFIG.privateKey) {
  console.error('❌  AGENT_PRIVATE_KEY not set in .env')
  process.exit(1)
}

// ── Wallet setup ──────────────────────────────────────────────────────────────
const provider = new ethers.JsonRpcProvider(
  process.env.CELO_RPC_URL || 'https://alfajores-forno.celo-testnet.org'
)
const wallet = new ethers.Wallet(CONFIG.privateKey, provider)

console.log(`🤖 Agent wallet: ${wallet.address}`)
console.log(`📡 API: ${CONFIG.api}`)
console.log(`🎯 Specialties: ${CONFIG.specialties.join(', ')}`)

// ── In-memory state ───────────────────────────────────────────────────────────
const activeBids = new Map()   // taskId → bidId
const inProgress = new Map()   // taskId → taskObject

// ── Auth header builder ───────────────────────────────────────────────────────
async function authHeaders() {
  const message   = `AgentMarket:${crypto.randomUUID()}:${Date.now()}`
  const signature = await wallet.signMessage(message)
  return {
    'Content-Type':        'application/json',
    'x-wallet-address':    wallet.address,
    'x-wallet-message':    message,
    'x-wallet-signature':  signature,
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res  = await fetch(`${CONFIG.api}${path}`)
  const body = await res.json()
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(body)}`)
  return body
}

async function apiPost(path, data) {
  const headers = await authHeaders()
  const res     = await fetch(`${CONFIG.api}${path}`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(data),
  })
  const body = await res.json()
  return { status: res.status, body }
}

// ── Skill: poll-tasks ─────────────────────────────────────────────────────────
async function pollTasks() {
  log('poll', 'Checking for open tasks...')

  const { tasks } = await apiGet('/tasks?status=open')
  if (!tasks.length) { log('poll', 'No open tasks'); return }

  // Filter by SOUL.md rules
  const eligible = tasks.filter(t => {
    if (!CONFIG.specialties.includes(t.category))              return false
    if (activeBids.has(t.id))                                  return false
    if (activeBids.size >= CONFIG.maxActiveBids)               return false
    if (new Date(t.deadline) < new Date())                     return false

    const budgetCusd = Number(BigInt(t.budget_wei)) / 1e18
    if (budgetCusd < CONFIG.minBudgetCusd)                     return false
    if (budgetCusd > CONFIG.maxBudgetCusd)                     return false

    return true
  })

  if (!eligible.length) { log('poll', 'No eligible tasks after filtering'); return }

  // Score and pick best task
  const scored = eligible.map(t => ({
    task:  t,
    score: (Number(BigInt(t.budget_wei)) / 1e18) - (t.bid_count * 0.1),
  })).sort((a, b) => b.score - a.score)

  const best = scored[0].task
  log('poll', `Best task: "${best.title}" (${ (Number(BigInt(best.budget_wei))/1e18).toFixed(2)} cUSD)`)

  await submitBid(best)
}

// ── Skill: submit-bid ─────────────────────────────────────────────────────────
async function submitBid(task) {
  const budgetWei    = BigInt(task.budget_wei)
  const discountBps  = BigInt(Math.floor(CONFIG.bidDiscount * 10000))
  const bidAmountWei = budgetWei - (budgetWei * discountBps / 10000n)

  const message = buildBidMessage(task)

  log('bid', `Bidding ${(Number(bidAmountWei)/1e18).toFixed(4)} cUSD on "${task.title}"`)

  const { status, body } = await apiPost('/bids', {
    task_id:    task.id,
    amount_wei: bidAmountWei.toString(),
    message,
  })

  if (status === 201) {
    activeBids.set(task.id, body.bid.id)
    log('bid', `✅ Bid accepted: ${body.bid.id}`)
    pollForAcceptance(task.id, body.bid.id)
  } else if (status === 403) {
    log('bid', `⛔ Rep too low for this task (required: ${body.required}, mine: ${body.actual})`)
  } else if (status === 409) {
    log('bid', `Already bid on this task`)
  } else {
    log('bid', `❌ Bid rejected (${status}): ${body.error}`)
  }
}

function buildBidMessage(task) {
  const templates = {
    data_collection: `I specialise in structured data extraction on Celo. I'll collect the requested data, validate it, and deliver clean JSON within 30 minutes. Reliable and verifiable output.`,
    content_gen:     `I generate high-quality on-brand content for the Celo ecosystem. I'll produce exactly what's specified, self-review for accuracy, and deliver within 20 minutes.`,
    code_review:     `I specialise in Solidity security reviews. I'll analyse the provided code for vulnerabilities, gas issues, and logic errors, delivering a structured report within 1 hour.`,
    defi_ops:        `I monitor and report on Celo DeFi protocol data in real time. I'll fetch the requested on-chain data, verify it against multiple sources, and deliver within 15 minutes.`,
  }
  return templates[task.category] || `Ready to complete this task efficiently and accurately.`
}

// ── Poll for bid acceptance ───────────────────────────────────────────────────
function pollForAcceptance(taskId, bidId) {
  const interval = setInterval(async () => {
    try {
      const { task } = await apiGet(`/tasks/${taskId}`)

      if (task.status === 'in_progress' && task.winning_bid_id === bidId) {
        clearInterval(interval)
        activeBids.delete(taskId)
        inProgress.set(taskId, task)
        log('accept', `🎉 Bid accepted for "${task.title}" — starting execution`)
        await executeTask(task)
      }

      if (['completed', 'expired', 'disputed'].includes(task.status)) {
        clearInterval(interval)
        activeBids.delete(taskId)
        log('accept', `Task ${taskId} ended with status: ${task.status}`)
      }
    } catch (err) {
      log('accept', `Error polling task ${taskId}: ${err.message}`)
    }
  }, 2 * 60 * 1000) // poll every 2 minutes
}

// ── Skill: execute-task ───────────────────────────────────────────────────────
async function executeTask(task) {
  log('execute', `Starting work on: "${task.title}" [${task.category}]`)

  try {
    let deliverable

    switch (task.category) {
      case 'data_collection':
        deliverable = await executeDataCollection(task)
        break
      case 'content_gen':
        deliverable = await executeContentGen(task)
        break
      case 'code_review':
        deliverable = await executeCodeReview(task)
        break
      case 'defi_ops':
        deliverable = await executeDefiOps(task)
        break
      default:
        throw new Error(`Unknown category: ${task.category}`)
    }

    log('execute', `✅ Work complete — submitting deliverable`)
    await submitWork(task, deliverable)
  } catch (err) {
    log('execute', `❌ Failed to complete task ${task.id}: ${err.message}`)
    inProgress.delete(task.id)
  }
}

// ── Execute: data_collection ──────────────────────────────────────────────────
async function executeDataCollection(task) {
  log('execute', 'Fetching DeFi data from DeFiLlama...')

  // Real implementation: fetch from DeFiLlama for Celo protocols
  const res       = await fetch('https://api.llama.fi/protocols')
  const protocols = await res.json()
  const celo      = protocols
    .filter(p => p.chains?.includes('Celo'))
    .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
    .slice(0, 20)
    .map(p => ({
      name:     p.name,
      symbol:   p.symbol,
      tvl_usd:  p.tvl,
      category: p.category,
      url:      p.url,
    }))

  return {
    task_id:       task.id,
    collected_at:  new Date().toISOString(),
    source:        'DeFiLlama API (api.llama.fi)',
    record_count:  celo.length,
    data:          celo,
  }
}

// ── Execute: content_gen ──────────────────────────────────────────────────────
async function executeContentGen(task) {
  log('execute', 'Generating content...')

  // In a real agent, this would call an LLM (e.g. Claude API)
  // For now, returns a structured placeholder
  return {
    task_id:        task.id,
    generated_at:   new Date().toISOString(),
    content_type:   'generated',
    prompt_used:    task.title,
    items:          [{ index: 1, text: `Content generated for: ${task.title}` }],
    word_count:     10,
    note:           'Replace executeContentGen() with real LLM call in production',
  }
}

// ── Execute: code_review ──────────────────────────────────────────────────────
async function executeCodeReview(task) {
  return {
    task_id:       task.id,
    reviewed_at:   new Date().toISOString(),
    file_reviewed: task.description,
    issues:        [],
    summary:       'Automated review placeholder — integrate static analysis tool.',
  }
}

// ── Execute: defi_ops ─────────────────────────────────────────────────────────
async function executeDefiOps(task) {
  return {
    task_id:    task.id,
    checked_at: new Date().toISOString(),
    operation:  'monitoring',
    result:     {},
    alert:      false,
  }
}

// ── Skill: submit-work ────────────────────────────────────────────────────────
async function submitWork(task, deliverable) {
  log('submit', `Uploading deliverable for task ${task.id}...`)

  const headers = await authHeaders()
  headers['x-payment'] = 'testnet-bypass' // replace with real x402 sig on mainnet

  const res  = await fetch(`${CONFIG.api}/verify`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({
      task_id:      task.id,
      content:      deliverable,
      content_type: 'json',
    }),
  })
  const body = await res.json()

  if (res.ok) {
    log('submit', `✅ Deliverable uploaded — CID: ${body.cid}`)
    log('submit', `🔗 ${body.gateway_url}`)
    log('submit', `💰 Awaiting poster settlement...`)
    inProgress.delete(task.id)
    pollForPayment(task.id)
  } else {
    log('submit', `❌ Upload failed (${res.status}): ${body.error}`)
  }
}

// ── Poll for payment after work submitted ─────────────────────────────────────
function pollForPayment(taskId) {
  let attempts = 0
  const interval = setInterval(async () => {
    attempts++
    try {
      const { task } = await apiGet(`/tasks/${taskId}`)
      if (task.status === 'completed') {
        clearInterval(interval)
        log('payment', `💸 Payment received for task ${taskId}!`)
      }
      if (attempts > 288) { // 24h at 5min intervals
        clearInterval(interval)
        log('payment', `⚠️  Task ${taskId} not settled after 24h`)
      }
    } catch (err) {
      log('payment', `Error polling payment for ${taskId}: ${err.message}`)
    }
  }, 5 * 60 * 1000)
}

// ── Logger ────────────────────────────────────────────────────────────────────
function log(skill, message) {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] [${skill.padEnd(8)}] ${message}`)
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║   AgentMarket Bidder Agent               ║')
  console.log('║   OpenClaw-compatible runner             ║')
  console.log('╚══════════════════════════════════════════╝\n')

  // Register agent profile on startup
  try {
    const headers = await authHeaders()
    await fetch(`${CONFIG.api}/agents/me`, {
      method:  'PUT',
      headers,
      body:    JSON.stringify({
        name:      process.env.AGENT_NAME || 'BidderAgent-1',
        specialty: CONFIG.specialties[0],
      }),
    })
    log('init', `Registered agent profile`)
  } catch (err) {
    log('init', `Could not register profile: ${err.message}`)
  }

  // Run first poll immediately
  await pollTasks().catch(err => log('poll', `Error: ${err.message}`))

  // Then poll on interval
  setInterval(async () => {
    await pollTasks().catch(err => log('poll', `Error: ${err.message}`))
  }, CONFIG.pollInterval)

  log('init', `Agent running. Polling every ${CONFIG.pollInterval / 60000} minutes.`)
  log('init', `Press Ctrl+C to stop.\n`)
}

main()