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
import { stellarAddressesEqual } from './stellarAddr.js'
import 'dotenv/config'

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org'
const NETWORK_PASSPHRASE = Networks.TESTNET
const DEFAULT_CONTRACT = 'CC5D5U5BEBUXQFX5XRH7Q263CNWTXKKBY62SAWYF4XRY7RMEGJ6DM6PS'
const CONTRACT_ADDRESS = process.env.SOROBAN_CONTRACT_ADDRESS || DEFAULT_CONTRACT

const server = new SorobanRpc.Server(RPC_URL, {
  allowHttp: RPC_URL.startsWith('http:'),
})

// Contract type descriptions for error messages
const SOROBAN_ERROR_MESSAGES = {
  0: 'Ok (success)',
  1: 'Unauthorized - signer auth failed or missing require_auth',
  2: 'InvalidParam - invalid parameters passed to contract',
  3: 'TaskNotFound - task id does not exist',
  4: 'AlreadyExists - task already exists or duplicate',
  5: 'BidNotFound - bid id does not exist',
  6: 'InvalidState - invalid state transition',
  7: 'DeadlinePassed - task deadline has passed',
  8: 'BudgetInsufficient - budget does not cover payment',
}

function contractInstance() {
  if (!CONTRACT_ADDRESS) {
    throw new Error('SOROBAN_CONTRACT_ADDRESS not set')
  }
  return new Contract(CONTRACT_ADDRESS)
}

/** Check if contract exists on-chain (read-only simulation). */
export async function checkContractExists() {
  try {
    const pubkey = process.env.STELLAR_PUBLIC_KEY
    if (!pubkey) return { exists: false, error: 'No public key configured' }
    const account = await server.getAccount(pubkey)
    const contract = contractInstance()
    // Try to call a read-only method
    const op = contract.call('get_task', nativeToScVal(BigInt(1), { type: 'u64' }))
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build()
    const sim = await server.simulateTransaction(tx)
    if (SorobanRpc.Api.isSimulationSuccess(sim)) {
      return { exists: true, contract: CONTRACT_ADDRESS }
    }
    return { exists: false, error: sim }
  } catch (err) {
    return { exists: false, error: err.message }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Parse Soroban return value to u64.
 * Handles both direct u64 returns and Result<T,E> enum returns.
 */
function parseResultU64(returnValue) {
  if (!returnValue) throw new Error('No return value from contract')

  // Try scValToNative first (handles most cases)
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
    if (typeof n === 'object' && n !== null) {
      // Handle object with value property
      const v = n.value ?? n._value ?? n.V
      if (v != null) return typeof v === 'bigint' ? v : BigInt(v)
    }
  } catch (parseErr) {
    if (String(parseErr.message).includes('Bad union switch')) {
      const match = String(parseErr.message).match(/Bad union switch:\s*(\d+)/)
      const discriminant = match ? match[1] : 'unknown'
      throw new Error(`Soroban contract error (discriminant: ${discriminant})`)
    }
    throw parseErr
  }

  throw new Error(`Unexpected contract return: ${JSON.stringify(returnValue)}`)
}

function parseResultVoid(returnValue) {
  if (!returnValue) return
  const n = scValToNative(returnValue)
  if (n === null || n === undefined) return
  if (Array.isArray(n)) {
    const tag = n[0]
    if (tag === 0 || tag === 0n) return
    throw new Error(`Contract returned error: ${JSON.stringify(n)}`)
  }
}

/**
 * Wait for transaction confirmation using raw RPC calls.
 * Returns only status - return value comes from simulation.
 */
async function waitForTransaction(hash, { attempts = 45, delayMs = 1000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const rpcResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: i,
        method: 'getTransaction',
        params: { hash },
      }),
    })
    const rpcData = await rpcResponse.json()

    if (rpcData.error) {
      if (rpcData.error.code === -32000) {
        await sleep(delayMs)
        continue
      }
      throw new Error(`RPC error: ${rpcData.error.message}`)
    }

    const result = rpcData.result
    if (!result) {
      await sleep(delayMs)
      continue
    }

    if (result.status === 'SUCCESS') {
      const txDetailsResponse = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: i + 1000,
          method: 'getTransaction',
          params: { hash },
        }),
      })
      const txDetails = await txDetailsResponse.json()
      let returnValue = null
      if (txDetails.result?.returnValue) {
        try {
          const raw = txDetails.result.returnValue
          console.log('[waitForTransaction] Raw returnValue:', raw)
          if (raw._switch) {
            const switchVal = typeof raw._switch === 'function' ? raw._switch() : raw._switch
            console.log('[waitForTransaction] switch:', switchVal, 'name:', switchVal?.name)
            if (raw._value) {
              const v = raw._value._value ?? raw._value
              console.log('[waitForTransaction] value:', v, 'type:', typeof v)
              if (typeof v === 'bigint' || typeof v === 'number') {
                returnValue = typeof v === 'bigint' ? v : BigInt(v)
              }
            }
          }
          if (!returnValue) {
            const n = scValToNative(raw)
            console.log('[waitForTransaction] scValToNative result:', n)
            if (typeof n === 'bigint' || typeof n === 'number') {
              returnValue = typeof n === 'bigint' ? n : BigInt(n)
            } else if (Array.isArray(n) && (n[0] === 0 || n[0] === 0n)) {
              returnValue = typeof n[1] === 'bigint' ? n[1] : BigInt(n[1])
            }
          }
        } catch (e) {
          console.error('[waitForTransaction] Failed to parse returnValue:', e.message)
        }
      }
      return { status: 'SUCCESS', txHash: hash, returnValue }
    }

    if (result.status === 'FAILED') {
      throw new Error(`Soroban transaction ${hash} failed`)
    }

    await sleep(delayMs)
  }
  throw new Error(`Timeout waiting for Soroban transaction ${hash}`)
}

/**
 * Build, simulate, sign, submit, and wait for one contract invocation.
 * Uses simulation to get return value (SDK parsing works there), then sends and polls for confirmation.
 */
async function invoke(secretKey, method, params, { parseReturn } = {}) {
  const keypair = Keypair.fromSecret(secretKey)
  const pubkey = keypair.publicKey()
  console.log(`[invoke] Starting ${method} for ${pubkey}`)

  try {
    const account = await server.getAccount(pubkey)
    console.log(`[invoke] Account loaded, sequence: ${account.sequenceNumber()}`)

    const contract = contractInstance()
    const op = contract.call(method, ...params)

    let tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build()

    // Simulate first to get return value (SDK parsing works here)
    console.log(`[invoke] Preparing transaction...`)
    tx = await server.prepareTransaction(tx)
    console.log(`[invoke] Simulating...`)
    const sim = await server.simulateTransaction(tx)
    console.log(`[invoke] Simulation result:`, sim)

    let simulatedResult = null
    if (parseReturn && sim.result?.retval) {
      try {
        simulatedResult = parseReturn(sim.result.retval)
        console.log(`[invoke] Parsed result:`, simulatedResult)
      } catch (parseErr) {
        console.error(`[invoke] Parse error:`, parseErr.message)
        throw parseErr
      }
    }

    tx.sign(keypair)

    console.log(`[invoke] Sending transaction...`)
    const send = await server.sendTransaction(tx)
    console.log(`[invoke] Send result:`, send)

    if (send.status === 'ERROR') {
      const detail = send.errorResult ? String(send.errorResult) : JSON.stringify(send)
      throw new Error(`Soroban sendTransaction failed: ${detail}`)
    }
    if (send.status !== 'PENDING' && send.status !== 'DUPLICATE') {
      throw new Error(`Unexpected sendTransaction status: ${send.status}`)
    }
    const hash = send.hash
    if (!hash) throw new Error('Soroban sendTransaction returned no hash')

    // Wait for confirmation (we already have the result from simulation)
    console.log(`[invoke] Waiting for confirmation...`)
    await waitForTransaction(hash)

    return { txHash: hash, result: simulatedResult }
  } catch (err) {
    console.error(`[invoke] Error in ${method}:`, err)
    throw err
  }
}

/**
 * @param {string} secretKey
 * @param {string} title
 * @param {bigint|string|number} budget  stroops (i128)
 * @param {bigint|string|number} deadlineMs  unix milliseconds as u64
 */
export async function postTask(secretKey, title, budget, deadlineMs) {
  const keypair = Keypair.fromSecret(secretKey)
  const poster = keypair.publicKey() // must match signer — contract calls poster.require_auth()
  const budgetBi = typeof budget === 'bigint' ? budget : BigInt(budget)
  const deadlineBi = typeof deadlineMs === 'bigint' ? deadlineMs : BigInt(deadlineMs)

  const { txHash, result } = await invoke(
    secretKey,
    'post_task',
    [
      nativeToScVal(poster, { type: 'address' }),
      nativeToScVal(String(title), { type: 'string' }),
      nativeToScVal(budgetBi, { type: 'i128' }),
      nativeToScVal(deadlineBi, { type: 'u64' }),
    ],
    { parseReturn: parseResultU64 }
  )

  return {
    success: true,
    taskId: result,
    txHash,
  }
}

/**
 * @param {string} secretKey  bidder's Stellar secret
 * @param {bigint|string|number} taskId  on-chain task id (u64)
 * @param {bigint|string|number} amountStroops  bid amount in stroops (i128)
 */
export async function submitBid(secretKey, taskId, amountStroops) {
  const keypair = Keypair.fromSecret(secretKey)
  const bidder = keypair.publicKey()
  const tid = typeof taskId === 'bigint' ? taskId : BigInt(taskId)
  const amt = typeof amountStroops === 'bigint' ? amountStroops : BigInt(amountStroops)

  const { txHash, result } = await invoke(
    secretKey,
    'submit_bid',
    [
      nativeToScVal(tid, { type: 'u64' }),
      nativeToScVal(bidder, { type: 'address' }),
      nativeToScVal(amt, { type: 'i128' }),
    ],
    { parseReturn: parseResultU64 }
  )

  return {
    success: true,
    bidId: result,
    txHash,
  }
}

/**
 * Poster accepts a bid on-chain.
 * @param {string} secretKey  must match `poster` Stellar account used when the task was posted
 * @param {bigint|string|number} taskId
 * @param {bigint|string|number} bidId  on-chain bid id from `submit_bid`
 */
export async function acceptBid(secretKey, taskId, bidId) {
  const keypair = Keypair.fromSecret(secretKey)
  const poster = keypair.publicKey()
  const tid = typeof taskId === 'bigint' ? taskId : BigInt(taskId)
  const bid = typeof bidId === 'bigint' ? bidId : BigInt(bidId)

  const { txHash } = await invoke(secretKey, 'accept_bid', [
    nativeToScVal(tid, { type: 'u64' }),
    nativeToScVal(bid, { type: 'u64' }),
    nativeToScVal(poster, { type: 'address' }),
  ], { parseReturn: parseResultVoid })

  return { success: true, txHash }
}

/**
 * Platform settles on-chain (must sign with the same account as `platform` argument).
 */
export async function settleTask(secretKey, taskId, platformWallet, commissionBps = 2000) {
  const keypair = Keypair.fromSecret(secretKey)
  const platformKey = Keypair.fromPublicKey(platformWallet).publicKey()
  if (keypair.publicKey() !== platformKey) {
    throw new Error('settleTask: STELLAR_SECRET_KEY must match STELLAR_PUBLIC_KEY (platform wallet)')
  }
  const tid = typeof taskId === 'bigint' ? taskId : BigInt(taskId)
  const bps = typeof commissionBps === 'bigint' ? commissionBps : BigInt(commissionBps)

  const { txHash } = await invoke(secretKey, 'settle_task', [
    nativeToScVal(tid, { type: 'u64' }),
    nativeToScVal(platformWallet, { type: 'address' }),
    nativeToScVal(bps, { type: 'i128' }),
  ], { parseReturn: parseResultVoid })

  return { success: true, txHash }
}

/**
 * Read-only: fetch task from contract (simulation only).
 */
async function simulateReadContractCall(method, scVals) {
  const pubkey = process.env.STELLAR_PUBLIC_KEY
  if (!pubkey) return null
  const account = await server.getAccount(pubkey)
  const contract = contractInstance()
  const op = contract.call(method, ...scVals)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) return null
  const rv = sim.result?.retval
  if (!rv) return null
  return scValToNative(rv)
}

export async function getTask(taskId) {
  try {
    const tid = typeof taskId === 'bigint' ? taskId : BigInt(taskId)
    return await simulateReadContractCall('get_task', [nativeToScVal(tid, { type: 'u64' })])
  } catch {
    return null
  }
}

export async function getBid(bidId) {
  try {
    const id = typeof bidId === 'bigint' ? bidId : BigInt(bidId)
    return await simulateReadContractCall('get_bid', [nativeToScVal(id, { type: 'u64' })])
  } catch {
    return null
  }
}

function nativeTaskPoster(task) {
  if (!task || typeof task !== 'object') return null
  const p = task.poster
  if (typeof p === 'string') return p
  return null
}

/** Soroban enum TaskStatus → true if contract task is InProgress */
function nativeTaskIsInProgress(task) {
  if (!task || typeof task !== 'object') return false
  const s = task.status
  if (s === 'InProgress' || s === 'in_progress') return true
  if (typeof s === 'string') return s.toLowerCase().replace(/-/g, '_') === 'in_progress'
  if (Array.isArray(s) && (s[0] === 1 || s[0] === 1n || s[0] === 'InProgress')) return true
  if (s && typeof s === 'object') {
    const tag = s.tag ?? s.name
    if (tag === 'InProgress') return true
    // Rust order: Open=0, InProgress=1, Completed=2, Disputed=3
    if (tag === 1 || tag === '1' || tag === 1n) return true
  }
  return false
}

/**
 * Confirms a successful post_task tx and that the on-chain poster matches `expectedPoster`.
 * Uses transaction events to extract the task_id rather than relying on return value.
 */
export async function verifyPostTaskTx(txHash, expectedPoster) {
  const txHashClean = String(txHash).trim()

  // Fetch transaction with events from RPC
  const rpcResponse = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: { hash: txHashClean },
    }),
  })
  const rpcData = await rpcResponse.json()

  if (rpcData.error) {
    throw new Error(`RPC error: ${rpcData.error.message}`)
  }

  const result = rpcData.result
  if (!result) {
    throw new Error('Transaction not found - may still be pending, wait a moment and retry')
  }

  if (result.status !== 'SUCCESS') {
    throw new Error(`Transaction failed with status: ${result.status}`)
  }

  // Extract task_id from transaction events
  // Soroban emits events for contract calls - look for the task_created or similar event
  let chainTaskId = null

  if (result.events && Array.isArray(result.events)) {
    for (const event of result.events) {
      // Look for contract events that contain task_id
      // Event structure: { contractId, type, topics, value }
      if (event.value) {
        try {
          const nativeValue = scValToNative(event.value)
          // Check if this looks like a task creation event
          if (nativeValue && typeof nativeValue === 'object') {
            // Try common field names for task id
            const idField = nativeValue.task_id ?? nativeValue.taskId ?? nativeValue.id ?? nativeValue.value
            if (idField != null) {
              chainTaskId = typeof idField === 'bigint' ? idField : BigInt(idField)
              break
            }
          }
        } catch (e) {
          // Skip unparseable events
        }
      }
    }
  }

  // If we couldn't extract from events, try the return value as fallback
  if (!chainTaskId && result.returnValue) {
    try {
      chainTaskId = parseResultU64(result.returnValue)
    } catch (e) {
      console.log('[verifyPostTaskTx] Return value parsing failed, will use task count as fallback')
    }
  }

  // Final fallback: use get_task_count() to get the latest task id
  if (!chainTaskId) {
    console.log('[verifyPostTaskTx] No task_id from events or return value, using get_task_count as fallback')
    const taskCount = await getTaskCount()
    chainTaskId = BigInt(taskCount)
  }

  console.log('[verifyPostTaskTx] Extracted chainTaskId:', chainTaskId)

  // Verify the task exists and poster matches
  const task = await getTask(chainTaskId)
  if (!task) {
    throw new Error(`Could not read task ${chainTaskId} from chain - contract may be different than expected`)
  }

  const posterOnChain = nativeTaskPoster(task)
  if (!posterOnChain || !stellarAddressesEqual(posterOnChain, expectedPoster)) {
    throw new Error('On-chain task poster does not match authenticated wallet')
  }

  return { chainTaskId, txHash: txHashClean }
}

/** Get the current task count from the contract. */
async function getTaskCount() {
  const pubkey = process.env.STELLAR_PUBLIC_KEY
  if (!pubkey) return 0n
  const account = await server.getAccount(pubkey)
  const contract = contractInstance()
  const op = contract.call('get_task_count')
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Failed to simulate get_task_count')
  }
  const rv = sim.result?.retval
  if (!rv) return 0n
  return parseResultU64(rv)
}

/**
 * Confirms accept_bid: task moves to InProgress and the accepted bid is recorded as winner.
 * @param {string} expectedPoster  authenticated poster (G...)
 */
export async function verifyAcceptBidTx(txHash, chainTaskId, chainBidId, expectedPoster) {
  await waitForTransaction(String(txHash).trim())
  const tid = typeof chainTaskId === 'bigint' ? chainTaskId : BigInt(chainTaskId)
  const bidid = typeof chainBidId === 'bigint' ? chainBidId : BigInt(chainBidId)
  const task = await getTask(tid)
  const bid = await getBid(bidid)
  if (!task || !bid) throw new Error('Could not read task or bid from chain')
  const posterOnChain = nativeTaskPoster(task)
  if (!posterOnChain || !stellarAddressesEqual(posterOnChain, expectedPoster)) {
    throw new Error('On-chain task poster does not match authenticated wallet')
  }
  if (!nativeTaskIsInProgress(task)) {
    throw new Error('Task is not in_progress on-chain after transaction')
  }
  const bidTask = bid.task_id ?? bid.taskId
  if (bidTask == null || BigInt(bidTask) !== tid) {
    throw new Error('On-chain bid does not belong to this task')
  }
  const winner = task.winning_bidder ?? task.winningBidder
  const bidder = bid.bidder
  const wStr = typeof winner === 'string' ? winner : null
  const bStr = typeof bidder === 'string' ? bidder : null
  if (!wStr || !bStr || !stellarAddressesEqual(wStr, bStr)) {
    throw new Error('On-chain winning bidder does not match the accepted bid')
  }
  return { txHash: String(txHash).trim() }
}

export function getContract(secretKey) {
  const keypair = Keypair.fromSecret(secretKey)
  return { contract: contractInstance(), keypair }
}

export default {
  getContract,
  postTask,
  submitBid,
  acceptBid,
  settleTask,
  getTask,
  getBid,
  verifyPostTaskTx,
  verifyAcceptBidTx,
  RPC_URL,
  NETWORK: Networks.TESTNET,
  CONTRACT_ADDRESS,
}
