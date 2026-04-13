import { useState, useEffect, useCallback } from 'react'
import { API_BASE, SOROBAN_CONTRACT_ID, STELLAR_RPC_URL } from '../lib/config.js'
import { postTaskWithWallet, preparePostTaskWithWallet } from '../lib/sorobanClient.js'

// ── Generic fetcher ───────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res  = await fetch(`${API_BASE}${path}`, opts)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export function useTasks(filter = 'all') {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const data   = await apiFetch(`/tasks${params}`)
      setTasks(data.tasks || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, 8000)
    return () => clearInterval(id)
  }, [fetch])

  return { tasks, loading, error, refetch: fetch }
}

// ── Single task ───────────────────────────────────────────────────────────────
export function useTask(taskId) {
  const [task,    setTask]    = useState(null)
  const [bids,    setBids]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!taskId) return
    const fetch = async () => {
      try {
        const data = await apiFetch(`/tasks/${taskId}`)
        setTask(data.task)
        setBids(data.bids || [])
      } catch {
        // Best-effort polling.
      }
      finally { setLoading(false) }
    }
    fetch()
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [taskId])

  return { task, bids, loading }
}

// ── Bids ──────────────────────────────────────────────────────────────────────
export function useBids(taskId = null) {
  const [bids,    setBids]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const path = taskId ? `/bids/${taskId}` : '/bids'
    const fetch = async () => {
      try {
        const data = await apiFetch(path)
        setBids(data.bids || [])
      } catch {
        // Best-effort polling.
      }
      finally { setLoading(false) }
    }
    fetch()
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [taskId])

  return { bids, loading }
}

// ── Agents leaderboard ────────────────────────────────────────────────────────
export function useAgents() {
  const [agents,  setAgents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiFetch('/agents')
        setAgents(data.agents || [])
      } catch {
        // Best-effort polling.
      }
      finally { setLoading(false) }
    }
    fetch()
    const id = setInterval(fetch, 15000)
    return () => clearInterval(id)
  }, [])

  return { agents, loading }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export function useStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiFetch('/verify/stats')
        setStats(data.stats)
      } catch {
        // Best-effort polling.
      }
    }
    fetch()
    const id = setInterval(fetch, 10000)
    return () => clearInterval(id)
  }, [])

  return stats
}

/** Unused — kept for API compatibility with older UI experiments. */
export function useContract() {
  return null
}

function postTaskChainParams(formData, publicKey) {
  const { title, budgetXlm, deadlineDate } = formData
  const budgetNum = parseFloat(budgetXlm)
  if (!budgetNum || budgetNum <= 0) {
    throw new Error('Invalid budget: ' + budgetXlm)
  }
  const budgetStroops = BigInt(Math.round(budgetNum * 1e7))
  const deadlineMs = BigInt(new Date(deadlineDate).getTime())
  if (!deadlineMs || deadlineMs <= 0) {
    throw new Error('Invalid deadline: ' + deadlineDate)
  }
  return {
    rpcUrl: STELLAR_RPC_URL,
    contractId: SOROBAN_CONTRACT_ID,
    publicKey,
    title,
    budgetStroops,
    deadlineMs,
  }
}

/** Soroban simulate only — no wallet. Use before a dedicated “Sign” click so the extension prompt opens reliably. */
export async function preparePostTaskOnChain({ formData, publicKey }) {
  return preparePostTaskWithWallet(postTaskChainParams(formData, publicKey))
}

// ── Post task (Soroban signed in wallet, then backend indexes tx) ─────────────
export async function postTaskOnChain({ authHeaders, formData, publicKey, signTxXdr, preparedXdr }) {
  const { title, category, deadlineDate, minRepScore, description, budgetXlm } = formData

  // Validate required fields before proceeding
  if (!budgetXlm || parseFloat(budgetXlm) <= 0) {
    throw new Error('Invalid budget: ' + budgetXlm)
  }
  if (!deadlineDate) {
    throw new Error('Deadline is required')
  }

  const chainParams = postTaskChainParams(formData, publicKey)
  const { txHash } = await postTaskWithWallet({
    ...chainParams,
    signTxXdr,
    preparedXdr,
  })

  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/tasks`, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      title, description, category,
      budget_stroops: String(chainParams.budgetStroops),
      deadline: new Date(deadlineDate).toISOString(),
      min_rep_score: minRepScore || 0,
      tx_hash: txHash,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'API error')
  return { task: body.task, txHash: body.task?.tx_hash, chainTaskId: body.task?.chain_task_id }
}