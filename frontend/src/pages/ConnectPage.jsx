import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet.jsx'

export default function ConnectPage() {
  const { wallet, connect, loading, error } = useWallet()
  const navigate = useNavigate()
  const [secretKey, setSecretKey] = useState('')
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    if (wallet) navigate('/app')
  }, [wallet, navigate])

  const handleConnect = () => {
    if (secretKey) {
      connect(secretKey)
    } else {
      connect()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', paddingTop: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '56px 24px 40px',
    }}>
      <div style={{ position: 'fixed', inset: 0,
        backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
        backgroundSize: '60px 60px', opacity: 0.2, pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent)',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 520 }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 16, padding: '40px',
          boxShadow: '0 0 60px rgba(0,229,160,0.05)',
        }}>
          <div style={{
            width: 56, height: 56, background: 'var(--accent)18',
            border: '1px solid var(--accent)40', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mono)', fontSize: 24, marginBottom: 24,
          }}>★</div>

          <h1 style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Connect Stellar wallet
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 32 }}>
            Connect via Rabet extension or enter your secret key.
          </p>

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading ? 'var(--bg3)' : 'var(--accent)',
              border: 'none', color: loading ? 'var(--text3)' : '#000',
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
              borderRadius: 'var(--r)', cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 16,
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 12, height: 12, border: '2px solid var(--text3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                connecting...
              </>
            ) : (
              <>
                <span style={{ fontSize: 16 }}>◎</span>
                connect with rabet →
              </>
            )}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Manual entry */}
          <div style={{ marginBottom: 16 }}>
            <input
              type="password"
              placeholder="Secret key (starts with S)"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              style={{
                width: '100%', padding: '12px',
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 8, color: 'var(--text)',
                fontFamily: 'var(--mono)', fontSize: 11,
                marginBottom: 12,
              }}
            />
            <button
              onClick={handleConnect}
              disabled={loading || !secretKey}
              style={{
                width: '100%', padding: '12px',
                background: loading || !secretKey ? 'var(--bg3)' : 'var(--bg3)',
                border: '1px solid var(--border2)',
                color: loading || !secretKey ? 'var(--text3)' : 'var(--text)',
                fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                borderRadius: 'var(--r)', cursor: loading || !secretKey ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'connecting...' : 'connect with secret key'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 'var(--r)',
              background: 'var(--red)18', border: '1px solid var(--red)40',
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)',
            }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ marginTop: 20, padding: '16px', background: 'var(--bg3)', borderRadius: 'var(--r)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Network</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>Stellar Testnet</div>
          </div>
        </div>
      </div>
    </div>
  )
}