import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { API_BASE, CONTRACT_ADDR, CONTRACT_ABI } from '../lib/config.js'

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
      } catch {}
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
      } catch {}
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
      } catch {}
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
      } catch {}
    }
    fetch()
    const id = setInterval(fetch, 10000)
    return () => clearInterval(id)
  }, [])

  return stats
}

// ── Contract interaction hook ─────────────────────────────────────────────────
export function useContract(signer) {
  if (!signer || !CONTRACT_ADDR) return null
  return new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, signer)
}

// ── Post task (on-chain + API) ────────────────────────────────────────────────
export async function postTaskOnChain({ contract, authHeaders, formData }) {
  const { title, category, budgetEth, deadlineDate, minRepScore, description } = formData

  const deadline  = Math.floor(new Date(deadlineDate).getTime() / 1000)
  const budgetWei = ethers.parseEther(budgetEth)

  // 1. Send to contract (escrow)
  const tx      = await contract.postTask(title, category, deadline, minRepScore || 0, { value: budgetWei })
  const receipt = await tx.wait()

  // Parse taskId from event
  const iface   = new ethers.Interface(CONTRACT_ABI)
  let chainTaskId = null
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log)
      if (parsed?.name === 'TaskPosted') { chainTaskId = Number(parsed.args.taskId); break }
    } catch {}
  }

  // 2. Record in API (so it shows in the feed)
  const headers = await authHeaders()
  const res = await fetch(`${API_BASE}/tasks`, {
    method:  'POST',
    headers,
    body: JSON.stringify({
      title, description, category,
      budget_wei:    budgetWei.toString(),
      deadline:      new Date(deadlineDate).toISOString(),
      min_rep_score: minRepScore || 0,
      chain_task_id: chainTaskId,
      tx_hash:       receipt.hash,
    }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || 'API error')
  return { task: body.task, txHash: receipt.hash, chainTaskId }
}