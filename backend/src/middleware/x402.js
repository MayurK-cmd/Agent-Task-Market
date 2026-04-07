import 'dotenv/config'
import { verifyX402Payment } from '../lib/stellar.js'

/**
 * x402 Payment Middleware
 *
 * Protects the /verify endpoint — the route bidder agents call
 * to confirm delivery and trigger settlement.
 *
 * Flow:
 *   1. Bidder agent calls POST /verify with x402 payment headers
 *   2. This middleware verifies the Stellar signature
 *   3. If valid → next() (settlement proceeds)
 *   4. If missing/invalid → 402 with payment requirements
 *
 * Reference: https://www.x402.org
 */

const PAYMENT_REQUIRED_AMOUNT = '0'

/**
 * requireX402Payment
 *
 * Verifies x402 payment signature from Stellar wallet.
 */
export function requireX402Payment(req, res, next) {
  const paymentHeader = req.headers['payment-signature']

  if (!paymentHeader) {
    return res.status(402).json({
      error: 'Payment required',
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'stellar-testnet',
        asset: 'XLM',
        amount: PAYMENT_REQUIRED_AMOUNT,
        payTo: process.env.PLATFORM_STELLAR_WALLET,
        memo: 'AgentMarket verification fee',
      }],
    })
  }

  // Parse x402 header: publicKey:signature:message
  const parts = paymentHeader.split(':')
  if (parts.length < 3) {
    return res.status(402).json({ error: 'Invalid x402 header format' })
  }

  const [publicKey, signature, ...msgParts] = parts
  const message = msgParts.join(':')

  // Verify signature
  const valid = verifyX402Payment(publicKey, signature, message)
  if (!valid) {
    return res.status(402).json({ error: 'Invalid x402 signature' })
  }

  req.x402Payment = { publicKey, verified: true }
  next()
}

/**
 * Full thirdweb x402 verification (swap in when deploying to mainnet).
 *
 * import { createPaymentVerifier } from 'thirdweb/x402'
 * const verifier = createPaymentVerifier({ chain: 'stellar-testnet', rpcUrl: process.env.STELLAR_RPC_URL })
 *
 * export async function requireX402Payment(req, res, next) {
 *   const result = await verifier.verify(req.headers)
 *   if (!result.valid) return res.status(402).json({ error: result.reason })
 *   req.x402Payment = result
 *   next()
 * }
 */

export default { requireX402Payment }