import { Keypair } from '@stellar/stellar-sdk'

/** Canonical G... strkey for comparisons and DB storage. */
export function canonicalStellarAddress(addr) {
  return Keypair.fromPublicKey(String(addr).trim()).publicKey()
}

export function stellarAddressesEqual(a, b) {
  if (!a || !b) return false
  try {
    return canonicalStellarAddress(a) === canonicalStellarAddress(b)
  } catch {
    return false
  }
}
