import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const WalletContext = createContext(null)

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
      } catch (err) {
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
      await detected.wallet.connect?.()
      const publicKey = await detected.wallet.getAddress?.()
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
      signature = await wallet.wallet.signMessage(message)
    } else {
      // Fallback: prompt for secret key
      const secretKey = prompt('Enter secret key to sign:')
      if (!secretKey) throw new Error('Signing cancelled')
      const { Keypair } = await import('@stellar/stellar-sdk')
      const keypair = Keypair.fromSecret(secretKey)
      signature = keypair.sign(Buffer.from(message)).toString('hex')
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
        detected.wallet.getAddress().then(publicKey => {
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

export const useWallet = () => useContext(WalletContext)