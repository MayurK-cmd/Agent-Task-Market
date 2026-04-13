/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk'
import {
  signTransaction as freighterSignTransaction,
  signMessage as freighterSignMessage,
} from '@stellar/freighter-api'

const WalletContext = createContext(null)

const TESTNET_PASSPHRASE = Networks.TESTNET

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

    for (const v of Object.values(value)) {
      const normalized = normalizeSignature(v)
      if (normalized) return normalized
    }
    return null
  }
  return null
}

function uint8ToHex(u8) {
  return Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('')
}

function base64ToHex(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return uint8ToHex(u8)
}

/** Freighter returns Buffer or hex-ish string — backend verify expects hex (or base64). */
function freighterAuthSignatureToHex(signedMessage) {
  if (signedMessage == null) return null
  if (signedMessage instanceof Uint8Array) {
    return uint8ToHex(signedMessage)
  }
  if (typeof signedMessage === 'string') {
    const s = signedMessage.trim()
    if (/^[0-9a-fA-F]+$/.test(s) && s.length >= 64) return s
    try {
      return base64ToHex(s)
    } catch {
      return s
    }
  }
  return null
}

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const getWallet = useCallback(() => {
    if (typeof window === 'undefined') return null
    // Freighter first — it often also touches `window.stellar`; order matters.
    if (window.freighter?.isFreighter) {
      return { wallet: window.freighter, name: 'Freighter' }
    }
    if (window.stellar?.isFreighter) {
      return { wallet: window.stellar, name: 'Freighter' }
    }
    if (window.rabet) return { wallet: window.rabet, name: 'Rabet' }
    if (window.stellar?.isRabet) return { wallet: window.stellar, name: 'Rabet' }
    if (window.stellar?.isStellar) return { wallet: window.stellar, name: 'Rabet' }
    if (window.stellar) return { wallet: window.stellar, name: 'Extension' }
    return null
  }, [])

  const connect = useCallback(async (secretKey) => {
    setLoading(true)
    setError(null)

    if (secretKey) {
      try {
        const kp = Keypair.fromSecret(secretKey)
        setWallet({
          publicKey: kp.publicKey(),
          keypair: kp,
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

    const detected = getWallet()
    if (!detected) {
      setError('No Stellar wallet found. Install Freighter (freighter.app) or Rabet (rabet.io).')
      setLoading(false)
      return
    }

    try {
      const connectResult = await detected.wallet.connect?.()
      let publicKey = null

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

      setWallet({
        publicKey,
        wallet: detected.wallet,
        isRabet: detected.name === 'Rabet',
        isFreighter: detected.name === 'Freighter',
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

  const signSorobanTx = useCallback(async (xdr) => {
    if (!wallet) throw new Error('Wallet not connected')

    if (wallet.isManual && wallet.keypair) {
      const tx = TransactionBuilder.fromXDR(xdr, TESTNET_PASSPHRASE)
      tx.sign(wallet.keypair)
      return tx.toXDR()
    }

    const signViaFreighterApi = async () => {
      const fr = await freighterSignTransaction(xdr, {
        networkPassphrase: TESTNET_PASSPHRASE,
        address: wallet.publicKey,
      })
      if (fr?.error) {
        const err = fr.error
        throw new Error(typeof err === 'string' ? err : (err.message || JSON.stringify(err)))
      }
      if (fr?.signedTxXdr) return fr.signedTxXdr
      throw new Error('Wallet did not return a signed transaction (signedTxXdr missing).')
    }

    // Freighter: official API (do not rely on injected object shape).
    if (wallet.isFreighter) {
      return signViaFreighterApi()
    }

    const ext = wallet.wallet

    /** Rabet docs: rabet.sign(xdr, 'testnet' | Networks.TESTNET) → { xdr } */
    const tryRabetSign = async () => {
      if (!ext || typeof ext.sign !== 'function') return null
      for (const net of ['testnet', TESTNET_PASSPHRASE]) {
        try {
          const res = await ext.sign(xdr, net)
          if (typeof res === 'string') return res
          if (res?.xdr) return res.xdr
          if (res?.signedTxXdr) return res.signedTxXdr
          if (res?.signedTransaction) return res.signedTransaction
        } catch {
          /* try next network arg */
        }
      }
      return null
    }

    const tryInjectedSignTx = async () => {
      if (!ext || typeof ext.signTransaction !== 'function') return null
      const optsVariants = [
        { networkPassphrase: TESTNET_PASSPHRASE, network: 'TESTNET' },
        { networkPassphrase: TESTNET_PASSPHRASE },
        { network: 'TESTNET' },
      ]
      for (const opts of optsVariants) {
        try {
          const res = await ext.signTransaction(xdr, opts)
          if (typeof res === 'string') return res
          if (res?.signedTxXdr) return res.signedTxXdr
          if (res?.signedTransaction) return res.signedTransaction
        } catch {
          /* try next opts */
        }
      }
      return null
    }

    if (wallet.isRabet) {
      const viaSign = await tryRabetSign()
      if (viaSign) return viaSign
      const injected = await tryInjectedSignTx()
      if (injected) return injected
      try {
        return await signViaFreighterApi()
      } catch (e) {
        throw new Error(
          `Rabet could not sign this Soroban transaction. Update Rabet, switch it to Stellar Testnet, and connect this site (see rabet.io / docs.rabet.io signing). (${e.message})`
        )
      }
    }

    const injected = await tryInjectedSignTx()
    if (injected) return injected
    const maybeRabetInject = await tryRabetSign()
    if (maybeRabetInject) return maybeRabetInject

    try {
      return await signViaFreighterApi()
    } catch (e) {
      throw new Error(
        `No working Soroban signer. Use Freighter or Rabet on Testnet, connect this site, then retry. (${e.message})`
      )
    }
  }, [wallet])

  const authHeaders = useCallback(async () => {
    if (!wallet) throw new Error('Wallet not connected')
    const message = `AgentMarket:${crypto.randomUUID()}:${Date.now()}`
    const messageBytes = new TextEncoder().encode(message)

    let signature

    if (wallet.isManual && wallet.keypair) {
      const sigBytes = wallet.keypair.sign(messageBytes)
      signature = Array.from(sigBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    } else if (wallet.isRabet && wallet.wallet?.signMessage) {
      let signed
      try {
        signed = await wallet.wallet.signMessage(message)
      } catch {
        signed = await wallet.wallet.signMessage({ message })
      }
      signature = normalizeSignature(signed)
      if (!signature) {
        throw new Error('Wallet returned an invalid signature format')
      }
    } else if (wallet.isFreighter) {
      const fr = await freighterSignMessage(message, {
        networkPassphrase: TESTNET_PASSPHRASE,
        address: wallet.publicKey,
      })
      if (fr?.error) {
        const err = fr.error
        throw new Error(typeof err === 'string' ? err : (err.message || 'Freighter signMessage failed'))
      }
      signature = freighterAuthSignatureToHex(fr.signedMessage)
      if (!signature) {
        throw new Error('Freighter did not return a usable signature for API auth')
      }
    } else {
      const fr = await freighterSignMessage(message, {
        networkPassphrase: TESTNET_PASSPHRASE,
        address: wallet.publicKey,
      })
      if (!fr?.error && fr?.signedMessage != null) {
        signature = freighterAuthSignatureToHex(fr.signedMessage)
      }
      if (!signature && wallet.wallet?.signMessage) {
        let signed
        try {
          signed = await wallet.wallet.signMessage(message)
        } catch {
          signed = await wallet.wallet.signMessage({ message })
        }
        signature = normalizeSignature(signed)
      }
      if (!signature) {
        throw new Error(
          'This wallet did not sign the login message. Use Freighter or Rabet (testnet), or manual key mode from the connect screen.'
        )
      }
    }

    return {
      'Content-Type': 'application/json',
      'x-wallet-address': wallet.publicKey,
      'x-wallet-message': message,
      'x-wallet-signature': signature,
    }
  }, [wallet])

  useEffect(() => {
    const detected = getWallet()
    if (!detected) return
    detected.wallet.isConnected?.().then((connected) => {
      if (connected) {
        const getPk =
          typeof detected.wallet.getAddress === 'function'
            ? detected.wallet.getAddress()
            : typeof detected.wallet.getPublicKey === 'function'
              ? detected.wallet.getPublicKey()
              : Promise.resolve(null)

        getPk.then((publicKey) => {
          if (!publicKey) return
          setWallet({
            publicKey,
            wallet: detected.wallet,
            isRabet: detected.name === 'Rabet',
            isFreighter: detected.name === 'Freighter',
          })
        })
      }
    })
  }, [getWallet])

  return (
    <WalletContext.Provider value={{ wallet, loading, error, connect, disconnect, authHeaders, signSorobanTx }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}
