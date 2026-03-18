import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { CHAIN_ID, CHAIN_NAME, RPC_URL, EXPLORER } from '../lib/config.js'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [wallet,   setWallet]   = useState(null)   // { address, signer, provider }
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [chainOk,  setChainOk]  = useState(false)

  // ── Check if already connected on mount ────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length) connect(true)
    })
  }, [])

  // ── Connect MetaMask ───────────────────────────────────────────────────────
  const connect = useCallback(async (silent = false) => {
    if (!window.ethereum) {
      setError('MetaMask not installed. Please install it from metamask.io')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      if (!silent) await provider.send('eth_requestAccounts', [])

      // Check + switch to Celo Sepolia
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          })
        } catch (switchErr) {
          // Chain not added yet — add it
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId:         `0x${CHAIN_ID.toString(16)}`,
                chainName:        CHAIN_NAME,
                nativeCurrency:  { name: 'CELO', symbol: 'CELO', decimals: 18 },
                rpcUrls:         [RPC_URL],
                blockExplorerUrls: [EXPLORER],
              }],
            })
          } else throw switchErr
        }
      }

      const signer  = await provider.getSigner()
      const address = await signer.getAddress()
      setWallet({ address, signer, provider })
      setChainOk(true)
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setWallet(null)
    setChainOk(false)
  }, [])

  // ── Build auth headers for API calls ──────────────────────────────────────
  const authHeaders = useCallback(async () => {
    if (!wallet) throw new Error('Wallet not connected')
    const message   = `AgentMarket:${crypto.randomUUID()}:${Date.now()}`
    const signature = await wallet.signer.signMessage(message)
    return {
      'Content-Type':        'application/json',
      'x-wallet-address':    wallet.address,
      'x-wallet-message':    message,
      'x-wallet-signature':  signature,
    }
  }, [wallet])

  // ── Listen for account/chain changes ──────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return
    const onAccounts = (accounts) => { if (!accounts.length) disconnect() }
    const onChain    = () => connect(true)
    window.ethereum.on('accountsChanged', onAccounts)
    window.ethereum.on('chainChanged',    onChain)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccounts)
      window.ethereum.removeListener('chainChanged',    onChain)
    }
  }, [connect, disconnect])

  return (
    <WalletContext.Provider value={{ wallet, loading, error, chainOk, connect, disconnect, authHeaders }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)