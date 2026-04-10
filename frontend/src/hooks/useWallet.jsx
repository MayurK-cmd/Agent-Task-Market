/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const WalletContext = createContext(null)

function normalizeSignature(value) {
  if (!value) return null
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeSignature(item)
      if (normalized) return normalized
    }
    return null
  }
  if (typeof value === 'object') {
    const candidate =
      value.signature ||
      value.sig ||
      value.signedMessage ||
      value.signed_message ||
      value.signed ||
      value.messageSignature ||
      value.message_signature ||
      value.result?.signature ||
      value.result?.sig ||
      value.result?.signedMessage ||
      value.result?.signed_message ||
      value.data?.signature ||
      value.data?.sig ||
      value.data?.signedMessage ||
      value.data?.signed_message ||
      null
    if (typeof candidate === 'string') return candidate.trim()

    // Last resort: walk object values to locate a nested signature-like string.
    for (const v of Object.values(value)) {
      const normalized = normalizeSignature(v)
      if (normalized) return normalized
    }
    return null
  }
  return null
}

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Detect Stellar wallets
  const getWallet = useCallback(() => {
    if (typeof window === 'undefined') return null
    console.log('[Wallet] window.stellar:', window.stellar)
    console.log('[Wallet] window.rabet:', window.rabet)
    // Check for Rabet (various exposures)
    if (window.rabet) return { wallet: window.rabet, name: 'Rabet' }
    if (window.stellar?.isRabet) return { wallet: window.stellar, name: 'Rabet' }
    if (window.stellar?.isStellar) return { wallet: window.stellar, name: 'Rabet' }
    // Check for Freighter
    if (window.freighter?.isFreighter) return { wallet: window.freighter, name: 'Freighter' }
    // Fallback to window.stellar
    if (window.stellar) return { wallet: window.stellar, name: 'Stellar' }
    return null
  }, [])

  const connect = useCallback(async (secretKey) => {
    setLoading(true)
    setError(null)

    // If secret key provided, use it directly
    if (secretKey) {
      try {
        const { Keypair } = await import('@stellar/stellar-sdk')
        const keypair = Keypair.fromSecret(secretKey)
        setWallet({
          publicKey: keypair.publicKey(),
          keypair,
          isManual: true,
        })
        setLoading(false)
        return
      } catch {
        setError('Invalid secret key')
        setLoading(false)
        return
      }
    }

    // Try wallet extension
    const detected = getWallet()
    console.log('[Wallet] Detected:', detected)

    if (!detected) {
      setError('No Stellar wallet found. Install Rabet at rabet.io or enter secret key.')
      setLoading(false)
      return
    }

    try {
      // Request connection
      console.log('[Wallet] Connecting to', detected.name)
      const connectResult = await detected.wallet.connect?.()
      let publicKey = null

      // Rabet/Freighter adapters expose different methods/return shapes.
      if (typeof detected.wallet.getAddress === 'function') {
        publicKey = await detected.wallet.getAddress()
      }
      if (!publicKey && typeof detected.wallet.getPublicKey === 'function') {
        publicKey = await detected.wallet.getPublicKey()
      }
      if (!publicKey && typeof connectResult === 'string') {
        publicKey = connectResult
      }
      if (!publicKey && connectResult && typeof connectResult === 'object') {
        publicKey =
          connectResult.address ||
          connectResult.publicKey ||
          connectResult.account ||
          connectResult.result?.address ||
          connectResult.data?.address ||
          null
      }

      if (!publicKey) {
        throw new Error(`Connected to ${detected.name}, but wallet did not return an address`)
      }
      console.log('[Wallet] Connected:', publicKey)

      setWallet({
        publicKey,
        wallet: detected.wallet,
        isRabet: detected.name === 'Rabet',
      })
    } catch (err) {
      console.error('[Wallet] Connect error:', err)
      setError(err.message || `Failed to connect ${detected.name}`)
    } finally {
      setLoading(false)
    }
  }, [getWallet])

  const disconnect = useCallback(async () => {
    const detected = getWallet()
    if (detected?.wallet?.disconnect) {
      await detected.wallet.disconnect()
    }
    setWallet(null)
  }, [getWallet])

  const authHeaders = useCallback(async () => {
    if (!wallet) throw new Error('Wallet not connected')
    const message = `AgentMarket:${crypto.randomUUID()}:${Date.now()}`

    let signature
    if (wallet.isRabet && wallet.wallet.signMessage) {
      // Use Rabet's signMessage
      let signed
      try {
        signed = await wallet.wallet.signMessage(message)
      } catch {
        // Some Rabet versions expect an object payload
        signed = await wallet.wallet.signMessage({ message })
      }
      signature = normalizeSignature(signed)
      if (!signature) {
        throw new Error('Wallet returned an invalid signature format')
      }
    } else {
      // Fallback: prompt for secret key
      const secretKey = prompt('Enter secret key to sign:')
      if (!secretKey) throw new Error('Signing cancelled')
      const { Keypair } = await import('@stellar/stellar-sdk')
      const keypair = Keypair.fromSecret(secretKey)
      signature = keypair.sign(new TextEncoder().encode(message)).toString('hex')
    }

    return {
      'Content-Type': 'application/json',
      'x-wallet-address': wallet.publicKey,
      'x-wallet-message': message,
      'x-wallet-signature': signature,
    }
  }, [wallet])

  // Auto-reconnect on page load
  useEffect(() => {
    const detected = getWallet()
    if (!detected) return
    detected.wallet.isConnected?.().then(connected => {
      if (connected) {
        const getPk =
          typeof detected.wallet.getAddress === 'function'
            ? detected.wallet.getAddress()
            : typeof detected.wallet.getPublicKey === 'function'
              ? detected.wallet.getPublicKey()
              : Promise.resolve(null)

        getPk.then(publicKey => {
          if (!publicKey) return
          setWallet({ publicKey, wallet: detected.wallet, isRabet: detected.name === 'Rabet' })
        })
      }
    })
  }, [getWallet])

  return (
    <WalletContext.Provider value={{ wallet, loading, error, connect, disconnect, authHeaders }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}