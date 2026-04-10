import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../lib/config.js'

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

// Legacy placeholder for previous EVM flow.
export function useContract() {
  return null
}

// ── Post task (backend + Soroban) ─────────────────────────────────────────────
export async function postTaskOnChain({ authHeaders, formData }) {
  const { title, category, budgetEth, deadlineDate, minRepScore, description } = formData

  // 1 XLM = 10^7 stroops
  const budgetWei = BigInt(Math.round(parseFloat(budgetEth) * 1e7))
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/tasks`, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      title, description, category,
      budget_wei:    budgetWei.toString(),
      deadline:      new Date(deadlineDate).toISOString(),
      min_rep_score: minRepScore || 0,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'API error')
  return { task: body.task, txHash: body.task?.tx_hash, chainTaskId: body.task?.chain_task_id }
}