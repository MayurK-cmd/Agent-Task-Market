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
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      borderBottom: '1px solid rgba(30,40,48,0.8)',
      background: 'rgba(10,12,15,0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', height: 64,
    }}>
      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
        <div style={{
          width: 32, height: 32,
          background: 'linear-gradient(135deg, var(--accent), rgba(0,229,160,0.8))',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#000', fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700,
          boxShadow: '0 0 20px rgba(0,229,160,0.4)',
        }}>A</div>
        <div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
            AGENTMARKET
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>/stellar</span>
        </div>
      </Link>

      {/* Links */}
      <div style={{ display: 'flex', gap: 8 }}>
        {links.map(({ to, label }) => {
          const active = pathname === to || (to !== '/' && pathname.startsWith(to))
          return (
            <Link key={to} to={to} style={{
              fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase',
              letterSpacing: '0.08em', padding: '8px 16px', borderRadius: 'var(--r)',
              textDecoration: 'none',
              color: active ? 'var(--accent)' : 'var(--text2)',
              background: active ? 'rgba(0,229,160,0.1)' : 'transparent',
              border: active ? '1px solid rgba(0,229,160,0.3)' : '1px solid transparent',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'var(--border2)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {wallet ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(21,27,34,0.8)',
              border: '1px solid rgba(0,229,160,0.3)',
              borderRadius: 20, padding: '6px 14px',
              boxShadow: '0 0 20px rgba(0,229,160,0.1)',
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse-dot 2s infinite',
                boxShadow: '0 0 10px rgba(0,229,160,0.5)',
              }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text)' }}>
                {shortAddr(wallet.publicKey)}
              </span>
            </div>
            <button onClick={disconnect} style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text3)',
              fontFamily: 'var(--mono)', fontSize: 10,
              padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--red)';
                e.currentTarget.style.color = 'var(--red)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text3)';
              }}
            >disconnect</button>
          </>
        ) : (
          <button
            onClick={() => connect()}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, var(--accent), rgba(0,229,160,0.9))',
              border: 'none', color: '#000',
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
              padding: '8px 20px', borderRadius: 20, cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 0 20px rgba(0,229,160,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 0 30px rgba(0,229,160,0.5)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(0,229,160,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading ? 'connecting...' : 'connect wallet'}
          </button>
        )}
      </div>
    </nav>
  )
}