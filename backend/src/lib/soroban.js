import {
  SorobanRpc,
  Keypair,
  Networks,
  Address,
  Contract,
  xdr,
} from '@stellar/stellar-sdk'
import 'dotenv/config'

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-test.stellar.org'
const NETWORK = Networks.TESTNET
const server = new SorobanRpc.Server(RPC_URL)

// Contract address - update after deployment
const CONTRACT_ADDRESS = process.env.SOROBAN_CONTRACT_ADDRESS

/**
 * Initialize Soroban client
 */
export function getContract(secretKey) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('SOROBAN_CONTRACT_ADDRESS not set')
  }
  const keypair = Keypair.fromSecret(secretKey)
  const contract = new Contract(CONTRACT_ADDRESS)
  return { contract, keypair }
}

/**
 * Post a new task to Soroban contract
 */
export async function postTask(secretKey, title, budget, deadline) {
  const { contract, keypair } = getContract(secretKey)

  // Build transaction for post_task
  // In production: use contract.call() with proper args

  // Keep mock IDs within Postgres INTEGER range.
  const safeTaskId = Math.floor((Date.now() / 1000) % 2147483647)
  return {
    success: true,
    taskId: safeTaskId, // Mock until contract deployed
    txHash: 'mock-tx-' + Date.now(),
  }
}

/**
 * Submit bid to Soroban contract
 */
export async function submitBid(secretKey, taskId, amount) {
  const { contract, keypair } = getContract(secretKey)

  return {
    success: true,
    bidId: Date.now(),
    txHash: 'mock-tx-' + Date.now(),
  }
}

/**
 * Accept bid on Soroban contract
 */
export async function acceptBid(secretKey, taskId, bidId) {
  const { contract, keypair } = getContract(secretKey)

  return {
    success: true,
    txHash: 'mock-tx-' + Date.now(),
  }
}

/**
 * Settle task on Soroban contract (triggers 80/20 split)
 */
export async function settleTask(secretKey, taskId, platformWallet, commissionBps = 2000) {
  const { contract, keypair } = getContract(secretKey)

  return {
    success: true,
    txHash: 'mock-tx-' + Date.now(),
  }
}

/**
 * Get task details from contract
 */
export async function getTask(taskId) {
  // In production: contract.call("get_task", [taskId])
  return null
}

export default {
  getContract,
  postTask,
  submitBid,
  acceptBid,
  settleTask,
  getTask,
  RPC_URL,
  NETWORK,
}
