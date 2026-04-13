import {
  Account,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk'

const NETWORK_PASSPHRASE = Networks.TESTNET
const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org'

/**
 * Parse Soroban return value to u64.
 * Handles both direct u64 returns and Result<T,E> enum returns.
 */
function parseResultU64(returnValue) {
  if (!returnValue) {
    throw new Error('No return value from contract')
  }

  // Direct u64 return (ChildUnion with scvU64 switch)
  if (returnValue._switch) {
    const switchVal = typeof returnValue._switch === 'function'
      ? returnValue._switch()
      : returnValue._switch
    const switchName = switchVal?.name || String(switchVal)

    // Direct u64 return
    if (switchName === 'scvU64' || switchVal === 5) {
      const val = returnValue._value?._value ?? returnValue._value
      if (val == null) {
        throw new Error('u64 value is null/undefined')
      }
      return typeof val === 'bigint' ? val : BigInt(val)
    }

    // Result enum: [discriminant, payload]
    if (switchName === 'scvVec' || switchVal === 10) {
      const vec = returnValue._value
      if (Array.isArray(vec)) {
        const tag = vec[0]?._value ?? vec[0]
        if (tag === 0 || tag === 0n) {
          const v = vec[1]?._value ?? vec[1]
          if (v == null) {
            throw new Error('Result value is null/undefined')
          }
          return typeof v === 'bigint' ? v : BigInt(v)
        }
        const errorMessages = {
          1: 'Unauthorized - signer auth failed',
          2: 'Invalid parameters',
          3: 'Task not found',
          4: 'Task already exists or duplicate',
          5: 'Bid not found',
          6: 'Invalid state transition',
          7: 'Deadline passed',
          8: 'Budget insufficient',
        }
        const errorMsg = errorMessages[tag] || `Unknown error (code: ${tag})`
        throw new Error(`Soroban contract error: ${errorMsg} (discriminant: ${tag})`)
      }
    }
  }

  // Fallback to scValToNative
  try {
    const n = scValToNative(returnValue)
    if (typeof n === 'bigint') return n
    if (typeof n === 'number') return BigInt(n)
    if (Array.isArray(n)) {
      const tag = n[0]
      if (tag === 0 || tag === 0n) {
        const v = n[1]
        if (v == null) {
          throw new Error('Parsed result value is null/undefined')
        }
        return typeof v === 'bigint' ? v : BigInt(v)
      }
      const errorMessages = {
        1: 'Unauthorized - signer auth failed',
        2: 'Invalid parameters',
        3: 'Task not found',
        4: 'Task already exists or duplicate',
        5: 'Bid not found',
        6: 'Invalid state transition',
        7: 'Deadline passed',
        8: 'Budget insufficient',
      }
      const errorMsg = errorMessages[tag] || `Unknown error (code: ${tag})`
      throw new Error(`Soroban contract error: ${errorMsg} (discriminant: ${tag})`)
    }
    throw new Error(`Unexpected contract return: ${JSON.stringify(n)}`)
  } catch (parseErr) {
    if (String(parseErr.message).includes('Bad union switch')) {
      const match = String(parseErr.message).match(/Bad union switch:\s*(\d+)/)
      const discriminant = match ? match[1] : 'unknown'
      throw new Error(`Soroban contract error (discriminant: ${discriminant})`)
    }
    throw parseErr
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const accountNotFoundMsg = (m) =>
  /not found|notfound|unknown account|does not exist/i.test(String(m || ''))

/**
 * Soroban RPC `getAccount` uses getLedgerEntries and sometimes lags or errors
 * even when the account exists on testnet (Friendbot: "already funded").
 * Horizon sees the same ledger — use it as fallback for sequence + id.
 */
async function loadAccountForSorobanTx(rpcServer, publicKey) {
  let rpcErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await rpcServer.getAccount(publicKey)
    } catch (err) {
      rpcErr = err
      if (accountNotFoundMsg(err?.message) && attempt < 2) {
        await sleep(1000)
        continue
      }
      break
    }
  }

  if (rpcErr && !accountNotFoundMsg(rpcErr?.message)) {
    throw rpcErr
  }

  try {
    const horizon = new Horizon.Server(HORIZON_TESTNET)
    const rec = await horizon.loadAccount(publicKey)
    let seq = null
    if (typeof rec.sequenceNumber === 'function') {
      seq = rec.sequenceNumber()
    } else if (typeof rec.sequenceNumber === 'string') {
      seq = rec.sequenceNumber
    } else if (typeof rec.sequence === 'string') {
      seq = rec.sequence
    }
    if (!seq) {
      throw new Error(`Account response missing sequence number`)
    }
    return new Account(publicKey, String(seq))
  } catch (horizonErr) {
    throw new Error(
      `Could not load account ${publicKey} from Soroban RPC or Horizon testnet. ` +
      `Friendbot "already funded" means the account exists — set your wallet to **Testnet**, ` +
      `check VITE_STELLAR_RPC_URL points at testnet Soroban, then retry. ` +
      `(Horizon: ${horizonErr?.message || horizonErr}; RPC: ${rpcErr?.message || rpcErr})`
    )
  }
}

/**
 * Wait for transaction confirmation using raw RPC calls.
 * Returns only status - return value comes from simulation.
 */
async function waitForSorobanSuccess(server, hash) {
  const { SUCCESS, FAILED } = rpc.Api.GetTransactionStatus
  const rpcUrl = server.serverURL?.toString?.() || server._server?.toString?.() || 'https://soroban-testnet.stellar.org'

  for (let i = 0; i < 50; i++) {
    const rpcResponse = await fetch(rpcUrl, {
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
        await sleep(1000)
        continue
      }
      throw new Error(`RPC error: ${rpcData.error.message}`)
    }

    const result = rpcData.result
    if (!result) {
      await sleep(1000)
      continue
    }

    if (result.status === SUCCESS) {
      return { status: SUCCESS, txHash: hash }
    }

    if (result.status === FAILED) {
      throw new Error(`Soroban transaction ${hash} failed`)
    }

    await sleep(1000)
  }
  throw new Error(`Timeout waiting for Soroban transaction ${hash}`)
}

async function preparePostTaskXdrOnServer(server, { contractId, publicKey, title, budgetStroops, deadlineMs }) {
  console.log('[preparePostTaskXdrOnServer] Starting with:', { contractId, publicKey, title, budgetStroops, deadlineMs })

  const account = await loadAccountForSorobanTx(server, publicKey)
  console.log('[preparePostTaskXdrOnServer] Account loaded:', account)

  const contract = new Contract(contractId)
  const budgetBi = typeof budgetStroops === 'bigint' ? budgetStroops : BigInt(budgetStroops)
  const deadlineBi = typeof deadlineMs === 'bigint' ? deadlineMs : BigInt(deadlineMs)

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'post_task',
        nativeToScVal(publicKey, { type: 'address' }),
        nativeToScVal(String(title), { type: 'string' }),
        nativeToScVal(budgetBi, { type: 'i128' }),
        nativeToScVal(deadlineBi, { type: 'u64' }),
      )
    )
    .setTimeout(30)
    .build()

  console.log('[preparePostTaskXdrOnServer] Built transaction, preparing...')
  const prepared = await server.prepareTransaction(built)
  console.log('[preparePostTaskXdrOnServer] Prepared result:', prepared)

  if (!prepared) {
    throw new Error('Soroban RPC prepareTransaction returned null - account may not be funded or RPC is unavailable')
  }
  const xdr = prepared.toXDR()
  console.log('[preparePostTaskXdrOnServer] XDR:', xdr)
  return xdr
}

/**
 * Build + Soroban-RPC simulate (prepare). Does not touch the wallet — call this before prompting to sign
 * so the user sees accurate UI and a second click can open the wallet extension on a fresh user gesture.
 *
 * @param {object} opts
 * @param {string} opts.rpcUrl
 * @param {string} opts.contractId
 * @param {string} opts.publicKey
 * @param {string} opts.title
 * @param {bigint|string|number} opts.budgetStroops
 * @param {bigint|string|number} opts.deadlineMs
 * @returns {Promise<{ preparedXdr: string }>}
 */
export async function preparePostTaskWithWallet(opts) {
  const { rpcUrl, contractId, publicKey, title, budgetStroops, deadlineMs } = opts

  if (!contractId) {
    throw new Error('Soroban contract id missing — set VITE_SOROBAN_CONTRACT_ID')
  }

  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http:') })
  const preparedXdr = await preparePostTaskXdrOnServer(server, {
    contractId,
    publicKey,
    title,
    budgetStroops,
    deadlineMs,
  })
  return { preparedXdr }
}

/**
 * @param {object} opts
 * @param {string} opts.rpcUrl
 * @param {string} opts.contractId  C... contract strkey
 * @param {string} opts.publicKey   G... signer = poster
 * @param {(xdr: string) => Promise<string>} opts.signTxXdr
 * @param {string} opts.title
 * @param {bigint|string|number} opts.budgetStroops  stroops
 * @param {bigint|string|number} opts.deadlineMs  unix ms u64
 * @param {string} [opts.preparedXdr]  If set, skips simulate/build
 * @returns {Promise<{ txHash: string, chainTaskId: bigint }>}
 */
export async function postTaskWithWallet(opts) {
  const {
    rpcUrl, contractId, publicKey, signTxXdr,
    title, budgetStroops, deadlineMs,
    preparedXdr: preparedXdrOpt,
  } = opts

  if (!contractId) throw new Error('Soroban contract id missing')

  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http:') })

  const preparedXdr = preparedXdrOpt || await preparePostTaskXdrOnServer(server, {
    contractId, publicKey, title, budgetStroops, deadlineMs,
  })

  console.log('[postTaskWithWallet] Starting with preparedXdr:', preparedXdr.substring(0, 50) + '...')

  // Simulate first to get return value
  const simTx = TransactionBuilder.fromXDR(preparedXdr, NETWORK_PASSPHRASE)
  console.log('[postTaskWithWallet] Simulating transaction...')
  const sim = await server.simulateTransaction(simTx)
  console.log('[postTaskWithWallet] Simulation result:', sim)

  if (!sim.result?.retval) {
    throw new Error('Simulation returned no result - contract call may have failed')
  }

  const chainTaskId = parseResultU64(sim.result.retval)
  console.log('[postTaskWithWallet] chainTaskId:', chainTaskId)
  if (!chainTaskId) {
    throw new Error('Could not parse task ID from contract response')
  }

  console.log('[postTaskWithWallet] Calling signTxXdr...')
  const signedXdr = await signTxXdr(preparedXdr)
  console.log('[postTaskWithWallet] signedXdr:', signedXdr.substring(0, 50) + '...')
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)

  console.log('[postTaskWithWallet] Sending transaction...')
  const send = await server.sendTransaction(signed)
  console.log('[postTaskWithWallet] sendTransaction result:', send)
  console.log('[postTaskWithWallet] sendTransaction errorResult:', send.errorResult)
  if (send.status === 'ERROR') {
    const errDetail = send.errorResult ? String(send.errorResult) : JSON.stringify(send)
    throw new Error(`Send failed: ${errDetail}`)
  }
  if (send.status !== 'PENDING' && send.status !== 'DUPLICATE') {
    throw new Error(`Unexpected status: ${send.status}`)
  }
  const hash = send.hash
  console.log('[postTaskWithWallet] hash:', hash)
  if (!hash) throw new Error('No hash returned')

  console.log('[postTaskWithWallet] Waiting for confirmation...')
  await waitForSorobanSuccess(server, hash)
  return { txHash: hash, chainTaskId }
}

/**
 * Poster signs accept_bid on-chain.
 * @param {object} opts
 * @param {bigint|string|number} opts.chainTaskId
 * @param {bigint|string|number} opts.chainBidId
 */
export async function acceptBidWithWallet(opts) {
  const {
    rpcUrl, contractId, publicKey, signTxXdr,
    chainTaskId, chainBidId,
  } = opts

  if (!contractId) {
    throw new Error('Soroban contract id missing — set VITE_SOROBAN_CONTRACT_ID')
  }

  const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith('http:') })
  const account = await loadAccountForSorobanTx(server, publicKey)
  const contract = new Contract(contractId)
  const tid = typeof chainTaskId === 'bigint' ? chainTaskId : BigInt(chainTaskId)
  const bid = typeof chainBidId === 'bigint' ? chainBidId : BigInt(chainBidId)

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'accept_bid',
        nativeToScVal(tid, { type: 'u64' }),
        nativeToScVal(bid, { type: 'u64' }),
        nativeToScVal(publicKey, { type: 'address' }),
      )
    )
    .setTimeout(30)
    .build()

  const prepared = await server.prepareTransaction(built)
  const signedXdr = await signTxXdr(prepared.toXDR())
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)

  const send = await server.sendTransaction(signed)
  if (send.status === 'ERROR') {
    const detail = send.errorResult ? String(send.errorResult) : JSON.stringify(send)
    throw new Error(`Soroban sendTransaction failed: ${detail}`)
  }
  const hash = send.hash
  if (!hash) throw new Error('Soroban sendTransaction returned no hash')

  await waitForSorobanSuccess(server, hash)
  return { txHash: hash }
}

/** @param {import('@stellar/stellar-sdk').Keypair} keypair */
export function signTxWithKeypair(keypair) {
  return async (xdr) => {
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE)
    tx.sign(keypair)
    return tx.toXDR()
  }
}

export { Keypair }
