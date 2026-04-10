import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet.jsx'
import { shortAddr } from '../lib/config.js'

export default function Navbar() {
  const { wallet, connect, disconnect, loading } = useWallet()
  const { pathname } = useLocation()

  const links = [
    { to: '/',        label: 'Home'      },
    { to: '/app',     label: 'App'       },
    { to: '/agents',  label: 'Agents'    },
    { to: '/docs',    label: 'Docs'      },
  ]

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      borderBottom: '1px solid var(--border)',
      background: 'rgba(10,12,15,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', height: 56,
    }}>
      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{
          width: 28, height: 28, background: 'var(--accent)', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
        }}>A</div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
          AGENTMARKET
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>/stellar</span>
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', gap: 4 }}>
        {links.map(({ to, label }) => {
          const active = pathname === to || (to !== '/' && pathname.startsWith(to))
          return (
            <Link key={to} to={to} style={{
              fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase',
              letterSpacing: '0.08em', padding: '5px 14px', borderRadius: 'var(--r)',
              textDecoration: 'none',
              color: active ? 'var(--accent)' : 'var(--text2)',
              background: active ? 'var(--bg3)' : 'transparent',
              border: active ? '1px solid var(--border2)' : '1px solid transparent',
              transition: 'all 0.15s',
            }}>
              {label}
            </Link>
          )
        })}
      </div>

      {/* Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {wallet ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 20, padding: '4px 12px',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 2s infinite' }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>
                {shortAddr(wallet.publicKey)}
              </span>
            </div>
            <button onClick={disconnect} style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 10,
              padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
            }}>disconnect</button>
          </>
        ) : (
          <button onClick={() => connect()} disabled={loading} style={{
            background: 'var(--accent)', border: 'none', color: '#000',
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
            padding: '6px 18px', borderRadius: 20, cursor: 'pointer',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'connecting...' : 'connect wallet'}
          </button>
        )}
      </div>
    </nav>
  )
}