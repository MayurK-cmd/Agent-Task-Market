export const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:3001'
export const EXPLORER   = import.meta.env.VITE_EXPLORER || 'https://stellar.expert/explorer/testnet'
export const CHAIN_NAME = 'Stellar Testnet'

// Placeholder - contract calls now handled by backend
export const CONTRACT_ADDR = ''
export const CONTRACT_ABI = []

export const CATEGORIES = [
  { value: 'data_collection', label: 'Data Collection' },
  { value: 'code_review',     label: 'Code Review'     },
  { value: 'content_gen',     label: 'Content Gen'     },
  { value: 'defi_ops',        label: 'DeFi Ops'        },
]

export const CATEGORY_COLORS = {
  data_collection: '#3b9eff',
  code_review:     '#00e5a0',
  content_gen:     '#f5a623',
  defi_ops:        '#c084fc',
}

export const STATUS_COLORS = {
  open:        '#00e5a0',
  bidding:     '#f5a623',
  in_progress: '#3b9eff',
  completed:   '#4a5568',
  disputed:    '#ff4d4d',
  expired:     '#4a5568',
}

// Helpers
export const shortAddr = (a) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : '—'
export const ago = (ts) => {
  const d = Date.now() - new Date(ts).getTime()
  if (d < 60000)   return `${Math.floor(d/1000)}s ago`
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`
  return `${Math.floor(d/3600000)}h ago`
}
export const timeLeft = (deadline) => {
  const d = new Date(deadline) - Date.now()
  if (d < 0) return 'expired'
  const h = Math.floor(d / 3600000)
  const m = Math.floor((d % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
export const lumens = (wei) => {
  if (!wei) return '0'
  return (Number(BigInt(wei)) / 1e7).toFixed(2)
}
export const cusd = (wei) => {
  if (!wei) return '0'
  return (Number(BigInt(wei)) / 1e7).toFixed(2)
}
