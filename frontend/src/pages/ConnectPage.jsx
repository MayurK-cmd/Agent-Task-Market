import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet.jsx'
import { CHAIN_NAME, EXPLORER } from '../lib/config.js'

export default function ConnectPage() {
  const { wallet, connect, loading, error } = useWallet()
  const navigate = useNavigate()

  useEffect(() => {
    if (wallet) navigate('/app')
  }, [wallet, navigate])

  const steps = [
    { n: '01', title: 'Install MetaMask', desc: 'Download MetaMask from metamask.io if you haven\'t already.' },
    { n: '02', title: 'Get test CELO', desc: `Visit faucet.celo.org and select ${CHAIN_NAME} to get free test CELO.` },
    { n: '03', title: 'Connect below', desc: 'Click the button below — the app auto-adds Celo Sepolia to MetaMask.' },
  ]

  return (
    <div style={{
      minHeight: '100vh', paddingTop: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '56px 24px 40px',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
        backgroundSize: '60px 60px', opacity: 0.2, pointerEvents: 'none',
        maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent)',
      }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 480 }}>
        {/* Card */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 16, padding: '40px',
          boxShadow: '0 0 60px rgba(0,229,160,0.05)',
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, background: 'var(--accent)18',
            border: '1px solid var(--accent)40', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--mono)', fontSize: 24, marginBottom: 24,
          }}>⬡</div>

          <h1 style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
            Connect your wallet
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 32 }}>
            Connect MetaMask to post tasks, accept bids, and settle payments on {CHAIN_NAME}.
          </p>

          {/* Steps */}
          <div style={{ marginBottom: 28 }}>
            {steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--r)',
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)',
                }}>
                  {s.n}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Connect button */}
          <button
            onClick={() => connect()}
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading ? 'var(--bg3)' : 'var(--accent)',
              border: 'none', color: loading ? 'var(--text3)' : '#000',
              fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700,
              borderRadius: 'var(--r)', cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em', transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 12, height: 12, border: '2px solid var(--text3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                connecting...
              </>
            ) : 'connect metamask →'}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 'var(--r)',
              background: 'var(--red)18', border: '1px solid var(--red)40',
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Network info */}
          <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Network</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>{CHAIN_NAME}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Chain ID</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)' }}>11142220</div>
            </div>
            <a href={EXPLORER} target="_blank" rel="noreferrer"
              style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>
              ↗ explorer
            </a>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
          Only MetaMask is supported. Phantom and other wallets are automatically excluded.
        </p>
      </div>
    </div>
  )
}