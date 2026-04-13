/**
 * AgentMarket Bidder Agent Runner
 * Run: node agent.js
 *
 * Specializes in: code_review, defi_ops
 */

import {
  SorobanRpc,
  Keypair,
  Networks,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk'
import 'dotenv/config'
import http from 'http'

// ── Soroban Config ────────────────────────────────────────────────────────────
const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE = Networks.TESTNET
const CONTRACT_ADDRESS = process.env.SOROBAN_CONTRACT_ADDRESS || 'CC5D5U5BEBUXQFX5XRH7Q263CNWTXKKBY62SAWYF4XRY7RMEGJ6DM6PS'

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http:') })

/** Parse Soroban u64 result (handles Result<T,E> enums). */
function parseResultU64(returnValue) {
  if (!returnValue) throw new Error('No return value')
  try {
    const n = scValToNative(returnValue)
    if (typeof n === 'bigint') return n
    if (typeof n === 'number') return BigInt(n)
    if (Array.isArray(n)) {
      const tag = n[0]
      if (tag === 0 || tag === 0n) {
        const v = n[1]
        if (v == null) throw new Error('Result value is null')
        return typeof v === 'bigint' ? v : BigInt(v)
      }
      const errorMessages = {
        1: 'Unauthorized', 2: 'Invalid parameters', 3: 'Task not found',
        4: 'Task already exists', 5: 'Bid not found', 6: 'Invalid state',
        7: 'Deadline passed', 8: 'Budget insufficient',
      }
      const errorMsg = errorMessages[tag] || `Unknown error (code: ${tag})`
      throw new Error(`Soroban contract error: ${errorMsg}`)
    }
  } catch (parseErr) {
    if (String(parseErr.message).includes('Bad union switch')) {
      const match = String(parseErr.message).match(/Bad union switch:\s*(\d+)/)
      const discriminant = match ? match[1] : 'unknown'
      throw new Error(`Soroban contract error (discriminant: ${discriminant})`)
    }
    throw parseErr
  }
  throw new Error(`Unexpected return: ${JSON.stringify(returnValue)}`)
}

/** Wait for Soroban transaction confirmation. */
async function waitForTransaction(hash, { attempts = 45, delayMs = 1000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const rpcResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: i, method: 'getTransaction', params: { hash },
      }),
    })
    const rpcData = await rpcResponse.json()
    if (rpcData.error) {
      if (rpcData.error.code === -32000) { await new Promise(r => setTimeout(r, delayMs)); continue }
      throw new Error(`RPC error: ${rpcData.error.message}`)
    }
    const result = rpcData.result
    if (!result) { await new Promise(r => setTimeout(r, delayMs)); continue }
    if (result.status === 'SUCCESS') return { status: 'SUCCESS', txHash: hash }
    if (result.status === 'FAILED') throw new Error(`Transaction ${hash} failed`)
    await new Promise(r => setTimeout(r, delayMs))
  }
  throw new Error(`Timeout waiting for transaction ${hash}`)
}

/** Submit bid on-chain via Soroban. */
async function submitBidOnChain(secretKey, taskId, amountStroops) {
  const keypair = Keypair.fromSecret(secretKey)
  const bidder = keypair.publicKey()
  const tid = typeof taskId === 'bigint' ? taskId : BigInt(taskId)
  const amt = typeof amountStroops === 'bigint' ? amountStroops : BigInt(amountStroops)

  const account = await server.getAccount(bidder)
  const contract = new Contract(CONTRACT_ADDRESS)
  const op = contract.call('submit_bid', nativeToScVal(tid, { type: 'u64' }), nativeToScVal(bidder, { type: 'address' }), nativeToScVal(amt, { type: 'i128' }))

  let tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(op).setTimeout(30).build()

  tx = await server.prepareTransaction(tx)
  const sim = await server.simulateTransaction(tx)
  if (sim.error) throw new Error(`Simulation failed: ${sim.error}`)

  let bidId = null
  if (sim.result?.retval) {
    try { bidId = parseResultU64(sim.result.retval) } catch (e) { console.log('[submitBid] Parse result:', e.message) }
  }

  tx.sign(keypair)
  const send = await server.sendTransaction(tx)
  if (send.status === 'ERROR') throw new Error(`Send failed: ${JSON.stringify(send)}`)

  await waitForTransaction(send.hash)
  return { txHash: send.hash, bidId }
}

// ── Agent Config ──────────────────────────────────────────────────────────────
const CONFIG = {
  api:           process.env.MARKETPLACE_API || 'http://localhost:3001',
  privateKey:    process.env.AGENT_PRIVATE_KEY,
  specialties:   (process.env.AGENT_SPECIALTIES || 'code_review,defi_ops').split(','),
  pollInterval:  parseInt(process.env.POLL_INTERVAL_MINUTES || '5') * 60 * 1000,
  bidDiscount:   parseFloat(process.env.BID_DISCOUNT_PERCENT || '10') / 100,
  minBudgetXlm:  parseFloat(process.env.MIN_BUDGET_XLM || '0.5'),
  maxBudgetXlm:  parseFloat(process.env.MAX_BUDGET_XLM || '10'),
  maxActiveBids: parseInt(process.env.MAX_ACTIVE_BIDS || '3'),
  retryDelaySec: 90,
  maxRetries:    2,
}

if (!CONFIG.privateKey) { console.error('AGENT_PRIVATE_KEY not set'); process.exit(1) }

const keypair = Keypair.fromSecret(CONFIG.privateKey)
const walletAddress = keypair.publicKey()

console.log(`\n╔══════════════════════════════════════════╗`)
console.log(`║   AgentMarket Bidder Agent               ║`)
console.log(`║   Stellar-native runner                  ║`)
console.log(`╚══════════════════════════════════════════╝\n`)
console.log(`🤖 Agent wallet: ${walletAddress}`)
console.log(`📡 API: ${CONFIG.api}`)
console.log(`🎯 Specialties: ${CONFIG.specialties.join(', ')}`)
console.log(`🔁 Retry: ${CONFIG.maxRetries}x after ${CONFIG.retryDelaySec}s\n`)

const activeBids = new Map()
const inProgress = new Map()

async function authHeaders() {
  const message   = `AgentMarket:${crypto.randomUUID()}:${Date.now()}`
  const signature = keypair.sign(Buffer.from(message)).toString('hex')
  return {
    'Content-Type':        'application/json',
    'x-wallet-address':    walletAddress,
    'x-wallet-message':    message,
    'x-wallet-signature':  signature,
  }
}

async function apiGet(path) {
  const res  = await fetch(`${CONFIG.api}${path}`)
  const body = await res.json()
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${JSON.stringify(body)}`)
  return body
}

async function apiPost(path, data) {
  const headers = await authHeaders()
  const res = await fetch(`${CONFIG.api}${path}`, {
    method: 'POST', headers, body: JSON.stringify(data),
  })
  const body = await res.json()
  return { status: res.status, body }
}

// ── Gemini with retry and fallback ────────────────────────────────────────────
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
const MAX_RETRIES = 5
const MAX_FAILURES_BEFORE_FALLBACK = 2

let currentModelIndex = 0
let consecutiveFailures = 0

async function callGemini(systemPrompt, userPrompt, attempt = 1) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set in .env')

  const model = GEMINI_MODELS[currentModelIndex]
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`

  log('gemini', `Calling ${model} (attempt ${attempt}/${MAX_RETRIES})`)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents:           [{ parts: [{ text: userPrompt }] }],
        generationConfig:   { temperature: 0.7, maxOutputTokens: 2000 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Gemini returned empty response')
    }

    // Strip markdown fences if Gemini wraps response in ```json ... ```
    const raw = data.candidates[0].content.parts[0].text
    consecutiveFailures = 0 // Reset on success
    return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  } catch (err) {
    log('gemini', `Error: ${err.message}`)

    // Increment failure counter
    consecutiveFailures++

    // Fallback to lite model after MAX_FAILURES_BEFORE_FALLBACK failures
    if (consecutiveFailures >= MAX_FAILURES_BEFORE_FALLBACK && currentModelIndex < GEMINI_MODELS.length - 1) {
      log('gemini', `⚠️  ${consecutiveFailures} consecutive failures, falling back to ${GEMINI_MODELS[currentModelIndex + 1]}`)
      currentModelIndex++
      consecutiveFailures = 0
    }

    // Retry if under max attempts
    if (attempt < MAX_RETRIES) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff: 1s, 2s, 4s, 8s, 10s
      log('gemini', `Retrying in ${delayMs/1000}s...`)
      await new Promise(r => setTimeout(r, delayMs))
      return callGemini(systemPrompt, userPrompt, attempt + 1)
    }

    throw new Error(`Gemini failed after ${MAX_RETRIES} attempts: ${err.message}`)
  }
}

// ── Poll tasks ────────────────────────────────────────────────────────────────
async function pollTasks() {
  log('poll', 'Checking for open tasks...')
  const { tasks } = await apiGet('/tasks?status=open')
  if (!tasks.length) { log('poll', 'No open tasks'); return }

  const eligible = tasks.filter(t => {
    if (!CONFIG.specialties.includes(t.category))  return false
    if (activeBids.has(t.id))                       return false
    if (activeBids.size >= CONFIG.maxActiveBids)    return false
    if (new Date(t.deadline) < new Date())          return false
    const b = Number(BigInt(t.budget_stroops)) / 1e7
    return b >= CONFIG.minBudgetXlm && b <= CONFIG.maxBudgetXlm
  })

  if (!eligible.length) { log('poll', 'No eligible tasks after filtering'); return }

  const best = eligible
    .map(t => ({ task: t, score: (Number(BigInt(t.budget_stroops)) / 1e7) - (t.bid_count * 0.1) }))
    .sort((a, b) => b.score - a.score)[0].task

  log('poll', `Best task: "${best.title}" (${(Number(BigInt(best.budget_stroops))/1e7).toFixed(2)} XLM)`)
  await submitBid(best)
}

// ── Submit bid ────────────────────────────────────────────────────────────────
async function submitBid(task) {
  const budgetStroops    = BigInt(task.budget_stroops)
  const discountBps      = BigInt(Math.floor(CONFIG.bidDiscount * 10000))
  const bidAmountStroops = budgetStroops - (budgetStroops * discountBps / 10000n)
  const messages = {
    data_collection: `I specialise in structured data extraction on Stellar. Clean JSON delivery within 30 minutes.`,
    content_gen:     `I generate high-quality Web3 content for the Stellar ecosystem. Delivery within 20 minutes.`,
    code_review:     `Senior Soroban security auditor. I'll review your contract for authorization issues, reentrancy vulnerabilities, and Stroops handling. Delivery within 1 hour with detailed findings.`,
    defi_ops:        `Stellar DeFi analyst with expertise in on-chain data and protocol monitoring. I'll fetch verified data from multiple sources and deliver a structured report within 30 minutes.`,
  }
  const message = messages[task.category] || 'Ready to complete this task efficiently.'

  log('bid', `Bidding ${(Number(bidAmountStroops)/1e7).toFixed(4)} XLM on "${task.title}"`)

  if (!task.chain_task_id) {
    log('bid', `⛔ Task has no chain_task_id — cannot submit Soroban bid`)
    return
  }

  let txHash = null
  let chainBidId = null
  try {
    const onChain = await submitBidOnChain(CONFIG.privateKey, task.chain_task_id, bidAmountStroops)
    txHash = onChain.txHash
    chainBidId = onChain.bidId.toString()
    log('bid', `Soroban submit_bid tx ${txHash.slice(0, 12)}... bid id ${chainBidId}`)
  } catch (err) {
    log('bid', `❌ Soroban bid failed: ${err.message}`)
    return
  }

  const { status, body } = await apiPost('/bids', {
    task_id: task.id,
    amount_stroops: bidAmountStroops.toString(),
    message,
    tx_hash: txHash,
    chain_bid_id: chainBidId,
  })

  if (status === 201) {
    activeBids.set(task.id, body.bid.id)
    log('bid', `✅ Bid submitted: ${body.bid.id}`)
    pollForAcceptance(task.id, body.bid.id)
  } else if (status === 403) {
    log('bid', `⛔ Rep too low (required: ${body.required}, mine: ${body.actual})`)
  } else if (status === 409) {
    log('bid', `Already bid on this task`)
  } else {
    log('bid', `❌ Bid rejected (${status}): ${body.error}`)
  }
}

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
      }
    } catch (err) {
      log('accept', `Error polling task ${taskId}: ${err.message}`)
    }
  }, 2 * 60 * 1000)
}

// ── Execute task with retry ───────────────────────────────────────────────────
async function executeTask(task, attempt = 1) {
  log('execute', `Starting: "${task.title}" [${task.category}] (attempt ${attempt}/${CONFIG.maxRetries})`)
  try {
    let deliverable
    switch (task.category) {
      case 'data_collection': deliverable = await executeDataCollection(task); break
      case 'content_gen':     deliverable = await executeContentGen(task);     break
      case 'code_review':     deliverable = await executeCodeReview(task);     break
      case 'defi_ops':        deliverable = await executeDefiOps(task);        break
      default: throw new Error(`Unknown category: ${task.category}`)
    }
    log('execute', `✅ Work complete — submitting deliverable`)
    await submitWork(task, deliverable)
  } catch (err) {
    log('execute', `❌ Failed (attempt ${attempt}): ${err.message}`)
    if (attempt < CONFIG.maxRetries) {
      log('execute', `⏳ Retrying in ${CONFIG.retryDelaySec}s...`)
      setTimeout(() => executeTask(task, attempt + 1), CONFIG.retryDelaySec * 1000)
    } else {
      log('execute', `🚫 Max retries reached for task ${task.id} — giving up`)
      inProgress.delete(task.id)
    }
  }
}

// ── Data collection ───────────────────────────────────────────────────────────
async function executeDataCollection(task) {
  log('execute', 'Fetching Stellar DeFi data from DeFiLlama...')
  const res       = await fetch('https://api.llama.fi/protocols')
  const protocols = await res.json()
  const data = protocols
    .filter(p => (p.chains || []).some(c => c.toLowerCase() === 'stellar') && (p.chainTvls?.Stellar || 0) > 1000)
    .sort((a, b) => (b.chainTvls?.Stellar || 0) - (a.chainTvls?.Stellar || 0))
    .slice(0, 20)
    .map(p => ({
      name:             p.name,
      symbol:           p.symbol,
      tvl_usd_stellar:  p.chainTvls?.Stellar || 0,
      tvl_usd_total:    p.tvl,
      category:         p.category,
      url:              p.url,
    }))
  return { task_id: task.id, collected_at: new Date().toISOString(), source: 'DeFiLlama — Stellar chain only', record_count: data.length, data }
}

// ── Content generation ────────────────────────────────────────────────────────
async function executeContentGen(task) {
  log('execute', 'Calling Gemini 2.5 Flash for content generation...')
  const raw = await callGemini(
    `You are a professional Web3 content writer. Always respond with valid JSON only — no markdown, no preamble.`,
    `Task: ${task.title}
Description: ${task.description || task.title}

Generate the requested content. Return this exact JSON:
{
  "content_type": "generated",
  "items": [{ "index": 1, "text": "..." }],
  "word_count": 0
}
Each item is one piece of content. Base on real Stellar facts. Return ONLY valid JSON.`
  )
  const parsed = JSON.parse(raw)
  return { task_id: task.id, generated_at: new Date().toISOString(), content_type: 'generated', prompt_used: task.title, items: parsed.items || [], word_count: parsed.word_count || 0 }
}

// ── Code review ───────────────────────────────────────────────────────────────
async function executeCodeReview(task) {
  log('execute', 'Calling Gemini 2.5 Flash for code review...')
  const raw = await callGemini(
    `You are a senior smart contract security auditor. Always respond with valid JSON only — no markdown, no preamble.`,
    `Task: ${task.title}
Description: ${task.description || task.title}

Return this exact JSON:
{
  "issues": [{ "severity": "high|medium|low|info", "line": null, "description": "...", "recommendation": "..." }],
  "summary": "2-3 sentence assessment"
}
Return ONLY valid JSON.`
  )
  const parsed = JSON.parse(raw)
  return { task_id: task.id, reviewed_at: new Date().toISOString(), file_reviewed: task.description || task.title, issues: parsed.issues || [], summary: parsed.summary || 'Review complete.' }
}

// ── DeFi ops ──────────────────────────────────────────────────────────────────
async function executeDefiOps(task) {
  log('execute', 'Calling Gemini 2.5 Flash for DeFi analysis...')
  const raw = await callGemini(
    `You are a Stellar DeFi analyst. Always respond with valid JSON only — no markdown, no preamble.`,
    `Task: ${task.title}
Description: ${task.description || task.title}

Return this exact JSON:
{
  "operation": "analysis",
  "result": {},
  "alert": false,
  "alert_reason": null,
  "summary": "2-3 sentence summary"
}
Return ONLY valid JSON.`
  )
  const parsed = JSON.parse(raw)
  return { task_id: task.id, checked_at: new Date().toISOString(), operation: parsed.operation || 'analysis', result: parsed.result || {}, alert: parsed.alert || false, alert_reason: parsed.alert_reason || null, summary: parsed.summary || '' }
}

// ── Submit work ───────────────────────────────────────────────────────────────
async function submitWork(task, deliverable) {
  log('submit', `Uploading deliverable for task ${task.id}...`)
  const headers = await authHeaders()

  // Generate x402 payment signature with Stellar
  const message = `x402:0:verify-task-${task.id}:${Date.now()}`
  const signature = keypair.sign(Buffer.from(message)).toString('hex')
  headers['payment-signature'] = `${walletAddress}:${signature}:${message}`

  const res = await fetch(`${CONFIG.api}/verify`, {
    method: 'POST', headers,
    body: JSON.stringify({ task_id: task.id, content: deliverable, content_type: 'json' }),
  })
  const body = await res.json()
  if (res.ok) {
    log('submit', `✅ Deliverable uploaded — CID: ${body.cid}`)
    log('submit', `🔗 ${body.gateway_url}`)
    log('submit', `💰 Awaiting poster settlement...`)
    inProgress.delete(task.id)
    pollForPayment(task.id)
  } else {
    throw new Error(`Upload failed (${res.status}): ${body.error}`)
  }
}

function pollForPayment(taskId) {
  let attempts = 0
  const interval = setInterval(async () => {
    attempts++
    try {
      const { task } = await apiGet(`/tasks/${taskId}`)
      if (task.status === 'completed') { clearInterval(interval); log('payment', `💸 Payment received for task ${taskId}!`) }
      if (attempts > 288) { clearInterval(interval); log('payment', `⚠️  Task ${taskId} not settled after 24h`) }
    } catch (err) { log('payment', `Error: ${err.message}`) }
  }, 5 * 60 * 1000)
}

function log(skill, message) {
  console.log(`[${new Date().toISOString().slice(11,19)}] [${skill.padEnd(8)}] ${message}`)
}

async function main() {
  try {
    const headers = await authHeaders()
    await fetch(`${CONFIG.api}/agents/me`, {
      method: 'PUT', headers,
      body: JSON.stringify({ name: process.env.AGENT_NAME || 'BidderAgent-1', specialty: CONFIG.specialties[0] }),
    })
    log('init', `Registered agent profile`)

    // Create Stellar wallet for receiving payments
    const walletRes = await fetch(`${CONFIG.api}/agents/stellar-wallet`, { method: 'POST', headers })
    const walletBody = await walletRes.json()
    if (walletRes.ok) {
      log('init', `Stellar wallet ready: ${walletBody.publicKey}`)
    } else if (walletBody.error?.includes('already exists')) {
      log('init', `Stellar wallet already registered`)
    } else {
      log('init', `⚠️ Could not create Stellar wallet: ${walletBody.error}`)
    }
  } catch (err) {
    log('init', `Could not register profile: ${err.message}`)
  }

  await pollTasks().catch(err => log('poll', `Error: ${err.message}`))
  setInterval(async () => {
    await pollTasks().catch(err => log('poll', `Error: ${err.message}`))
  }, CONFIG.pollInterval)

  log('init', `Running. Poll: ${CONFIG.pollInterval/60000}m · Retry: ${CONFIG.maxRetries}x after ${CONFIG.retryDelaySec}s`)
  log('init', `Press Ctrl+C to stop.\n`)
}

http.createServer((_, res) => res.end('ok')).listen(process.env.PORT || 8000)
main()