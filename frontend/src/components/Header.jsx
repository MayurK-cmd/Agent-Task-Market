import { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet.jsx'
import { useStats }  from '../hooks/useMarketPlace.js'
import { shortAddr, cusd } from '../lib/config.js'

const S = {
  header: { borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 100 },
  top:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 52 },
  logo:   { display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' },
  icon:   { width: 28, height: 28, background: 'var(--accent)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 13, fontWeight: 700 },
  tabs:   { display: 'flex', gap: 2 },
  ticker: { display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' },
  tItem:  { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px', borderRight: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 },
}

export default function Header({ activeTab, onTabChange }) {
  const { wallet, connect, disconnect, loading } = useWallet()
  const stats = useStats()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const TABS = ['tasks', 'leaderboard', 'bids', 'explorer']

  const tickerItems = stats ? [
    { label: 'total tasks',   val: stats.total_tasks,    accent: false },
    { label: 'online agents', val: stats.online_agents,  accent: true  },
    { label: 'open tasks',    val: stats.open_tasks,     accent: true  },
    { label: 'total bids',    val: stats.total_bids,     accent: false },
    { label: 'volume',        val: `$${cusd(stats.total_volume_wei)} cUSD`, accent: false },
    { label: 'network',       val: 'Celo Sepolia',        accent: false },
  ] : []

  return (
    <header style={S.header}>
      <div style={S.top}>
        {/* Logo */}
        <div style={S.logo}>
          <div style={S.icon}>A</div>
          AGENTMARKET
          <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12 }}>/celo</span>
        </div>

        {/* Tabs */}
        <nav style={S.tabs}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => onTabChange(tab)} style={{
              background: activeTab === tab ? 'var(--bg3)' : 'transparent',
              border: activeTab === tab ? '1px solid var(--border2)' : '1px solid transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text2)',
              fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase',
              letterSpacing: '0.08em', padding: '5px 14px', borderRadius: 'var(--r)', transition: 'all 0.15s',
            }}>
              {tab}
            </button>
          ))}
        </nav>

        {/* Right: time + wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
            {time.toTimeString().slice(0,8)}
          </span>

          {wallet ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '4px 12px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 2s infinite' }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>
                  {shortAddr(wallet.address)}
                </span>
              </div>
              <button onClick={disconnect} style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 10,
                padding: '4px 10px', borderRadius: 20, transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.target.style.borderColor = 'var(--red)'}
              onMouseLeave={e => e.target.style.borderColor = 'var(--border)'}
              >
                disconnect
              </button>
            </div>
          ) : (
            <button onClick={() => connect()} disabled={loading} style={{
              background: 'var(--accent)', border: 'none', color: '#000',
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
              padding: '6px 16px', borderRadius: 20, letterSpacing: '0.04em',
              opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s',
            }}>
              {loading ? 'connecting...' : 'connect wallet'}
            </button>
          )}
        </div>
      </div>

      {/* Ticker */}
      <div style={S.ticker}>
        {tickerItems.map((item, i) => (
          <div key={i} style={S.tItem}>
            <span style={{ color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</span>
            <span style={{ color: item.accent ? 'var(--accent)' : 'var(--text)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{item.val}</span>
          </div>
        ))}
        {!stats && (
          <div style={{ ...S.tItem, color: 'var(--text3)' }}>connecting to api...</div>
        )}
      </div>
    </header>
  )
}