import { verifyWalletSignature, isSignatureTimely } from '../lib/wallet.js'
import { canonicalStellarAddress } from '../lib/stellarAddr.js'

/**
 * Middleware: requireWalletAuth
 *
 * Expects these headers on the request:
 *   x-wallet-address   : G...  (Stellar public key)
 *   x-wallet-message   : "AgentMarket:<nonce>:<timestamp>"
 *   x-wallet-signature : hex   (Stellar signature)
 *
 * On success: attaches req.wallet = lowercase address
 * On failure: 401
 */
export function requireWalletAuth(req, res, next) {
  const wallet    = req.headers['x-wallet-address']
  const message   = req.headers['x-wallet-message']
  const signature = req.headers['x-wallet-signature']

  if (!wallet || !message || !signature) {
    return res.status(401).json({
      error: 'Missing auth headers: x-wallet-address, x-wallet-message, x-wallet-signature',
    })
  }

  // ── Test bypass (development only) ─────────────────────────────────────────
  // Allows test.js to run without a real private key.
  // NEVER active in production — NODE_ENV check is the guard.
  if (
    process.env.NODE_ENV !== 'production' &&
    signature === 'test-bypass'
  ) {
    try {
      req.wallet = canonicalStellarAddress(wallet)
    } catch {
      req.wallet = String(wallet).trim()
    }
    return next()
  }

  if (!isSignatureTimely(message)) {
    return res.status(401).json({ error: 'Signature expired (> 5 minutes old)' })
  }

  if (!verifyWalletSignature(wallet, message, signature)) {
    return res.status(401).json({ error: 'Invalid wallet signature' })
  }

  try {
    req.wallet = canonicalStellarAddress(wallet)
  } catch {
    return res.status(401).json({ error: 'Invalid Stellar public key' })
  }
  next()
}

/**
 * Middleware: optionalWalletAuth
 * Same as above but doesn't block — just attaches req.wallet if present.
 * Used for public GET endpoints where auth enriches the response.
 */
export function optionalWalletAuth(req, res, next) {
  const wallet    = req.headers['x-wallet-address']
  const message   = req.headers['x-wallet-message']
  const signature = req.headers['x-wallet-signature']

  if (wallet && message && signature) {
    if (isSignatureTimely(message) && verifyWalletSignature(wallet, message, signature)) {
      try {
        req.wallet = canonicalStellarAddress(wallet)
      } catch { /* ignore invalid optional auth */ }
    }
  }
  next()
}

export default { requireWalletAuth, optionalWalletAuth }