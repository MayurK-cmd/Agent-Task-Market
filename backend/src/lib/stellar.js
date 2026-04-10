import { Keypair, TransactionBuilder, Networks, Asset, Horizon, Operation } from '@stellar/stellar-sdk'
import 'dotenv/config'

const NETWORK = Networks.TESTNET
const HORIZON_URL = 'https://horizon-testnet.stellar.org'

/**
 * Create new Stellar wallet for agent
 */
export function createStellarWallet() {
  const keypair = Keypair.random()
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  }
}

/**
 * Sign x402 payment message
 */
export function signX402Payment(secretKey, amount, memo) {
  const keypair = Keypair.fromSecret(secretKey)
  const message = `x402:${amount}:${memo}:${Date.now()}`
  const signature = keypair.sign(Buffer.from(message))
  return {
    publicKey: keypair.publicKey(),
    signature: signature.toString('hex'),
    message,
  }
}

/**
 * Verify x402 payment signature
 */
export function verifyX402Payment(publicKey, signature, message) {
  try {
    const keypair = Keypair.fromPublicKey(publicKey)
    const sig = Buffer.from(signature, 'hex')
    keypair.verify(Buffer.from(message), sig)
    return true
  } catch {
    return false
  }
}

/**
 * Fund wallet via Friendbot (testnet only)
 */
export async function fundWithFriendbot(publicKey) {
  try {
    const res = await fetch(
      `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`
    )
    if (res.ok) {
      return { success: true, publicKey }
    }
    return { success: false, error: 'Friendbot failed' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Send XLM payment on Stellar testnet using Horizon
 */
export async function sendPayment(secretKey, toAddress, amount) {
  try {
    const keypair = Keypair.fromSecret(secretKey)
    const server = new Horizon.Server(HORIZON_URL)

    // Get source account
    const sourceAccount = await server.loadAccount(keypair.publicKey())

    // Convert amount to stroops (1 XLM = 10^7 stroops)
    const xlmAmount = (BigInt(amount) / 10000000n).toString()

    // Build payment transaction
    const tx = new TransactionBuilder(sourceAccount, {
      fee: sourceAccount.subentry_count * 100 + 100,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: toAddress,
          asset: Asset.native(),
          amount: xlmAmount,
        })
      )
      .setTimeout(30)
      .build()

    tx.sign(keypair)

    // Submit transaction via Horizon
    const result = await server.submitTransaction(tx)

    return {
      success: true,
      txHash: result.hash,
      amount,
      to: toAddress,
      from: keypair.publicKey(),
      asset: 'XLM',
    }
  } catch (err) {
    console.error('[Stellar payment error]:', err)
    return { success: false, error: err.message }
  }
}

export default {
  createStellarWallet,
  signX402Payment,
  verifyX402Payment,
  fundWithFriendbot,
  sendPayment,
  NETWORK,
}
