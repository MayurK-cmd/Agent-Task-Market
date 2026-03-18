export const API_BASE      = import.meta.env.VITE_API_URL      || 'http://localhost:3001'
export const CONTRACT_ADDR = import.meta.env.VITE_CONTRACT_ADDRESS
export const EXPLORER      = import.meta.env.VITE_EXPLORER      || 'https://celo-sepolia.blockscout.com'
export const CHAIN_ID      = parseInt(import.meta.env.VITE_CHAIN_ID || '11142220')
export const CHAIN_NAME    = import.meta.env.VITE_CHAIN_NAME    || 'Celo Sepolia'
export const RPC_URL       = import.meta.env.VITE_RPC_URL       || 'https://celo-sepolia.drpc.org'

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

// TaskMarket.sol minimal ABI — only what the frontend needs
export const CONTRACT_ABI = [
  'function postTask(string title, string category, uint256 deadline, uint256 minRepScore) external payable returns (uint256)',
  'function submitBid(uint256 taskId, uint256 amount, string message) external returns (uint256)',
  'function acceptBid(uint256 bidId) external',
  'function settleTask(uint256 taskId, string ipfsCid) external',
  'function disputeTask(uint256 taskId) external',
  'function getTask(uint256 taskId) external view returns (tuple(uint256 id, address poster, uint256 budget, uint256 deadline, uint256 minRepScore, uint8 status, uint256 winningBidId, string ipfsCid, string category, string title))',
  'function taskCount() external view returns (uint256)',
  'function commissionBps() external view returns (uint256)',
  'event TaskPosted(uint256 indexed taskId, address indexed poster, uint256 budget, string category, uint256 deadline)',
  'event TaskSettled(uint256 indexed taskId, address indexed bidder, uint256 bidderPayout, uint256 platformFee, string ipfsCid)',
]

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
export const cusd = (wei) => {
  if (!wei) return '0'
  return (Number(BigInt(wei)) / 1e18).toFixed(2)
}