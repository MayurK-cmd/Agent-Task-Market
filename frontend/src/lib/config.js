export const API_BASE   = import.meta.env.VITE_API_URL || 'http://localhost:3001'
export const EXPLORER   = import.meta.env.VITE_EXPLORER || 'https://stellar.expert/explorer/testnet'
export const CHAIN_NAME = 'Stellar Testnet'
/** Must match backend SOROBAN_CONTRACT_ADDRESS (testnet default). */
export const SOROBAN_CONTRACT_ID =
  import.meta.env.VITE_SOROBAN_CONTRACT_ID || 'CC5D5U5BEBUXQFX5XRH7Q263CNWTXKKBY62SAWYF4XRY7RMEGJ6DM6PS'
/** SDF public testnet RPC (was soroban-test.stellar.org — that host no longer resolves). */
export const STELLAR_RPC_URL =
  import.meta.env.VITE_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'

// Unused — Stellar app uses VITE_SOROBAN_CONTRACT_ID + Soroban RPC.
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
/** Format stroops (1 XLM = 10^7) as a decimal XLM string for display. */
export const lumens = (stroops) => {
  if (!stroops) return '0'
  return (Number(BigInt(stroops)) / 1e7).toFixed(2)
}
