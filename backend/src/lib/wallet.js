import { Keypair } from '@stellar/stellar-sdk'

/**
 * Verifies a Stellar signature.
 *
 * How clients sign:
 *   const message = `AgentMarket:${nonce}:${Date.now()}`
 *   const sig = keypair.sign(Buffer.from(message)).toString('hex')
 *   // send: { wallet (G...), message, signature (hex) }
 *
 * The server verifies the signature matches the public key.
 */
export function verifyWalletSignature(wallet, message, signature) {
  try {
    const keypair = Keypair.fromPublicKey(wallet)
    const sig = Buffer.from(signature, 'hex')
    return keypair.verify(Buffer.from(message), sig)
  } catch {
    return false
  }
}

/**
 * Extracts timestamp from message and rejects if older than 5 minutes.
 * Message format: "AgentMarket:<nonce>:<timestamp>"
 */
export function isSignatureTimely(message, maxAgeMs = 5 * 60 * 1000) {
  const parts = message.split(':')
  if (parts.length < 3) return false
  const ts = parseInt(parts[2], 10)
  if (isNaN(ts)) return false
  return Date.now() - ts < maxAgeMs
}

export default { verifyWalletSignature, isSignatureTimely }