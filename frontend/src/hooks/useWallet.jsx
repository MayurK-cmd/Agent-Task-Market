import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import { CHAIN_ID, CHAIN_NAME, RPC_URL, EXPLORER } from '../lib/config.js'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [wallet,  setWallet]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [chainOk, setChainOk] = useState(false)

  // Find MetaMask specifically — Phantom also injects window.ethereum
  const getMetaMask = useCallback(() => {
    if (window.ethereum?.providers?.length) {
      const mm = window.ethereum.providers.find(p => p.isMetaMask && !p.isPhantom)
      if (mm) return mm
    }
    if (window.ethereum?.isMetaMask && !window.ethereum?.isPhantom) {
      return window.ethereum
    }
    return null
  }, [])

  useEffect(() => {
    const mm = getMetaMask()
    if (!mm) return
    mm.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length) connect(true)
    })
  }, [])

  const connect = useCallback(async (silent = false) => {
    const ethereum = getMetaMask()
    if (!ethereum) {
      setError('MetaMask not found. Install MetaMask from metamask.io — if you have Phantom, make sure MetaMask is also active.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const provider = new ethers.BrowserProvider(ethereum)
      if (!silent) await provider.send('eth_requestAccounts', [])

      const network = await provider.getNetwork()
      if (Number(network.chainId) !== CHAIN_ID) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
          })
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId:           `0x${CHAIN_ID.toString(16)}`,
                chainName:          CHAIN_NAME,
                nativeCurrency:    { name: 'CELO', symbol: 'CELO', decimals: 18 },
                rpcUrls:           [RPC_URL],
                blockExplorerUrls: [EXPLORER],
              }],
            })
          } else throw switchErr
        }
      }

      const signer  = await provider.getSigner()
      const address = await signer.getAddress()
      setWallet({ address, signer, provider, ethereum })
      setChainOk(true)
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [getMetaMask])

  const disconnect = useCallback(() => {
    setWallet(null)
    setChainOk(false)
  }, [])

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

  useEffect(() => {
    const ethereum = getMetaMask()
    if (!ethereum) return
    const onAccounts = (accounts) => { if (!accounts.length) disconnect() }
    const onChain    = () => connect(true)
    ethereum.on('accountsChanged', onAccounts)
    ethereum.on('chainChanged',    onChain)
    return () => {
      ethereum.removeListener('accountsChanged', onAccounts)
      ethereum.removeListener('chainChanged',    onChain)
    }
  }, [connect, disconnect, getMetaMask])

  return (
    <WalletContext.Provider value={{ wallet, loading, error, chainOk, connect, disconnect, authHeaders }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => useContext(WalletContext)