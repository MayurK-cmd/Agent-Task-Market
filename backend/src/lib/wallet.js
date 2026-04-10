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
    const raw = String(signature || '').trim()
    const messageBytes = Buffer.from(message)

    // Try common formats: hex, 0x-prefixed hex, base64
    const hex = raw.startsWith('0x') ? raw.slice(2) : raw
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length >= 64) {
      const sigHex = Buffer.from(hex, 'hex')
      if (keypair.verify(messageBytes, sigHex)) return true
    }

    // Rabet/Freighter can return base64-encoded signatures in some versions.
    const sigB64 = Buffer.from(raw, 'base64')
    if (sigB64.length > 0 && keypair.verify(messageBytes, sigB64)) return true

    return false
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