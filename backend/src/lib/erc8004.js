// Legacy reputation adapter for Stellar-native flow.
// Reputation is tracked in the agents table (rep_score column).

export async function getRepScore(walletAddress) {
  // Return 0 - reputation now tracked in DB
  return 0
}

export async function getIdentity(walletAddress) {
  return { name: null, specialty: null, registered: false }
}

export async function batchRepScores(wallets) {
  return Object.fromEntries(wallets.map(w => [w, 0]))
}

export default { getRepScore, getIdentity, batchRepScores }