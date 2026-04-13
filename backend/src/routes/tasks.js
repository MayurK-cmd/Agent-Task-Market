import { Router } from 'express'
import { Keypair } from '@stellar/stellar-sdk'
import { query, queryOne } from '../lib/db.js'
import { sendPayment } from '../lib/stellar.js'
import {
  postTask,
  settleTask as settleOnChain,
  verifyPostTaskTx,
} from '../lib/soroban.js'
import { stellarAddressesEqual } from '../lib/stellarAddr.js'
import { requireWalletAuth } from '../middleware/auth.js'

const router = Router()

// ── GET /tasks ────────────────────────────────────────────────────────────────
// Public. Returns all tasks, newest first.
// Query params: ?status=open&category=data_collection&limit=50&offset=0
router.get('/', async (req, res) => {
  try {
    const { status, category, limit = 50, offset = 0 } = req.query

    const conditions = []
    const params = []

    if (status) {
      params.push(status)
      conditions.push(`t.status = $${params.length}`)
    }
    if (category) {
      params.push(category)
      conditions.push(`t.category = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    params.push(parseInt(limit), parseInt(offset))

    const { rows } = await query(`
      SELECT
        t.*,
        COUNT(b.id)::int          AS bid_count,
        MIN(b.amount_stroops)::bigint AS lowest_bid
      FROM tasks t
      LEFT JOIN bids b ON b.task_id = t.id AND b.status != 'rejected'
      ${where}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params)

    res.json({ tasks: rows, count: rows.length })
  } catch (err) {
    console.error('[GET /tasks]', err)
    res.status(500).json({ error: 'Failed to fetch tasks' })
  }
})

// ── GET /tasks/:id ────────────────────────────────────────────────────────────
// Public. Returns single task with its bids.
router.get('/:id', async (req, res) => {
  try {
    const task = await queryOne(
      'SELECT * FROM tasks WHERE id = $1', [req.params.id]
    )
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const { rows: bids } = await query(
      `SELECT b.*, a.name AS bidder_name
       FROM bids b
       LEFT JOIN agents a ON a.wallet = b.bidder_wallet
       WHERE b.task_id = $1
       ORDER BY b.amount_stroops ASC`,
      [req.params.id]
    )

    res.json({ task, bids })
  } catch (err) {
    console.error('[GET /tasks/:id]', err)
    res.status(500).json({ error: 'Failed to fetch task' })
  }
})

// ── POST /tasks ───────────────────────────────────────────────────────────────
// Protected (wallet auth). Creates task on Soroban contract + DB.
router.post('/', requireWalletAuth, async (req, res) => {
  try {
    const {
      title, description, category, budget_stroops,
      deadline, min_rep_score = 0, tx_hash: clientTxHash,
    } = req.body

    if (!title || !category || !budget_stroops || !deadline) {
      return res.status(400).json({
        error: 'Required: title, category, budget_stroops, deadline',
      })
    }

    const VALID_CATEGORIES = ['data_collection', 'code_review', 'content_gen', 'defi_ops']
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` })
    }

    const platformPub = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY).publicKey()

    let sorobanResult
    if (clientTxHash) {
      sorobanResult = await verifyPostTaskTx(clientTxHash, req.wallet)
    } else if (stellarAddressesEqual(req.wallet, platformPub)) {
      sorobanResult = await postTask(
        process.env.STELLAR_SECRET_KEY,
        title,
        budget_stroops,
        new Date(deadline).getTime()
      )
    } else {
      return res.status(400).json({
        error:
          'Soroban post_task must be signed by your wallet. Submit the on-chain transaction first, then POST with tx_hash (see API docs).',
      })
    }

    const dup = await queryOne(
      'SELECT id FROM tasks WHERE tx_hash = $1 OR chain_task_id = $2',
      [sorobanResult.txHash, sorobanResult.chainTaskId.toString()]
    )
    if (dup) {
      return res.status(409).json({ error: 'This on-chain task is already registered' })
    }

    const chainTaskId = (sorobanResult.chainTaskId ?? sorobanResult.taskId).toString()

    // Upsert poster
    await query(`
      INSERT INTO agents (wallet, last_seen, is_online)
      VALUES ($1, NOW(), TRUE)
      ON CONFLICT (wallet) DO UPDATE
        SET last_seen = NOW(), is_online = TRUE
    `, [req.wallet])

    // Create task in DB
    const task = await queryOne(`
      INSERT INTO tasks
        (title, description, category, budget_stroops, deadline, min_rep_score,
         poster_wallet, chain_task_id, tx_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [title, description, category, budget_stroops, deadline, min_rep_score,
        req.wallet, chainTaskId, sorobanResult.txHash])

    await query(`
      INSERT INTO transactions (type, task_id, from_wallet, tx_hash, meta)
      VALUES ('task_posted', $1, $2, $3, $4)
    `, [task.id, req.wallet, sorobanResult.txHash, JSON.stringify({ title, category })])

    res.status(201).json({ task })
  } catch (err) {
    console.error('[POST /tasks]', err)
    res.status(500).json({ error: 'Failed to create task: ' + err.message })
  }
})

// ── PATCH /tasks/:id/settle ───────────────────────────────────────────────────
// Protected. Poster confirms completion → sends Stellar USDC payment to agent.
router.patch('/:id/settle', requireWalletAuth, async (req, res) => {
  try {
    const { ipfs_cid, tx_hash, winning_bid_id } = req.body

    const task = await queryOne('SELECT * FROM tasks WHERE id = $1', [req.params.id])
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.poster_wallet !== req.wallet) {
      return res.status(403).json({ error: 'Only the task poster can settle' })
    }
    if (task.status !== 'in_progress') {
      return res.status(400).json({ error: `Cannot settle task with status: ${task.status}` })
    }

    // Get winning bid and agent's Stellar wallet
    const bid = await queryOne('SELECT * FROM bids WHERE id = $1', [winning_bid_id])
    if (!bid) return res.status(404).json({ error: 'Bid not found' })

    const agent = await queryOne('SELECT stellar_pub FROM agents WHERE wallet = $1', [bid.bidder_wallet])
    if (!agent?.stellar_pub) {
      return res.status(400).json({ error: 'Agent has no Stellar wallet' })
    }
    if (task.chain_task_id == null) {
      return res.status(400).json({ error: 'Task has no chain_task_id; cannot settle on Soroban' })
    }

    // Calculate split (80% agent, 20% platform) - for record keeping
    // Actual token transfers happen on-chain in the Soroban contract
    const platformFee = BigInt(task.budget_stroops) * 2000n / 10000n
    const agentPayout = BigInt(task.budget_stroops) - platformFee

    // Settle on Soroban contract - this transfers funds from escrow to agent and platform
    const sorobanResult = await settleOnChain(
      process.env.STELLAR_SECRET_KEY,
      BigInt(task.chain_task_id),
      Keypair.fromSecret(process.env.STELLAR_SECRET_KEY).publicKey(),
      2000
    )

    // Payment is now handled by the Soroban contract escrow
    const paymentResult = {
      txHash: sorobanResult.txHash,
      asset: 'XLM',
    }

    // Mark task complete
    const updated = await queryOne(`
      UPDATE tasks
      SET status = 'completed', ipfs_cid = $1, winning_bid_id = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [ipfs_cid, winning_bid_id, task.id])

    // Mark winning bid as paid
    await query(
      `UPDATE bids SET status = 'paid', tx_hash = $1 WHERE id = $2`,
      [sorobanResult.txHash, winning_bid_id]
    )

    // Mark other bids as outbid
    await query(
      `UPDATE bids SET status = 'outbid' WHERE task_id = $1 AND id != $2 AND status = 'pending'`,
      [task.id, winning_bid_id]
    )

    // Update agent stats
    await query(`
      UPDATE agents
      SET tasks_done = tasks_done + 1, total_earned = total_earned + $1
      WHERE wallet = $2
    `, [agentPayout, bid.bidder_wallet])

    // Log settlement
    await query(`
      INSERT INTO transactions (type, task_id, bid_id, from_wallet, to_wallet, amount_stroops, tx_hash, meta)
      VALUES ('task_settled', $1, $2, $3, $4, $5, $6, $7)
    `, [task.id, winning_bid_id, req.wallet, agent.stellar_pub, agentPayout, sorobanResult.txHash,
        JSON.stringify({ ipfs_cid, onChain: true })])

    res.json({
      task: updated,
      soroban: {
        settle_tx_hash: sorobanResult.txHash,
        agent_payout: agentPayout.toString(),
        platform_fee: platformFee.toString(),
      },
      payment: {
        agent_payout: agentPayout.toString(),
        platform_fee: platformFee.toString(),
        tx_hash: sorobanResult.txHash,
        asset: 'XLM',
        note: 'Paid via Soroban escrow contract',
      },
    })
  } catch (err) {
    console.error('[PATCH /tasks/:id/settle]', err)
    res.status(500).json({ error: 'Failed to settle task: ' + err.message })
  }
})

// ── PATCH /tasks/:id/dispute ──────────────────────────────────────────────────
// Protected. Poster raises a dispute (escrow stays locked in contract).
router.patch('/:id/dispute', requireWalletAuth, async (req, res) => {
  try {
    const { reason } = req.body
    const task = await queryOne('SELECT * FROM tasks WHERE id = $1', [req.params.id])
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.poster_wallet !== req.wallet) {
      return res.status(403).json({ error: 'Only the poster can raise a dispute' })
    }

    const updated = await queryOne(
      `UPDATE tasks SET status = 'disputed', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [task.id]
    )

    await query(
      `INSERT INTO transactions (type, task_id, from_wallet, meta) VALUES ('dispute_raised', $1, $2, $3)`,
      [task.id, req.wallet, JSON.stringify({ reason })]
    )

    res.json({ task: updated })
  } catch (err) {
    console.error('[PATCH /tasks/:id/dispute]', err)
    res.status(500).json({ error: 'Failed to dispute task' })
  }
})

export default router