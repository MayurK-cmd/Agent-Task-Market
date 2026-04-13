import { useState, useEffect } from 'react'
import { useTasks, useBids } from '../hooks/useMarketPlace.js'
import { useWallet } from '../hooks/useWallet.jsx'
import { CATEGORY_COLORS, STATUS_COLORS, EXPLORER, API_BASE, shortAddr, ago, timeLeft, lumens, STELLAR_RPC_URL, SOROBAN_CONTRACT_ID } from '../lib/config.js'
import { acceptBidWithWallet } from '../lib/sorobanClient.js'
import PostTask from './PostTask.jsx'

const FILTERS = ['all','open','bidding','in_progress','completed','disputed']

const pill = (label, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: `linear-gradient(135deg, ${color}18, ${color}10)`,
  color, border: `1px solid ${color}40`,
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
  padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap',
  boxShadow: `0 0 10px ${color}20`,
})

const btn = (color = 'var(--accent)', disabled = false) => ({
  background: `linear-gradient(135deg, ${color}20, ${color}15)`,
  border: `1px solid ${color}40`, color,
  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
  padding: '6px 16px', borderRadius: 'var(--r)', letterSpacing: '0.06em',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  transition: 'all 0.2s ease', whiteSpace: 'nowrap',
  boxShadow: disabled ? 'none' : `0 0 15px ${color}15`,
})

// ── IPFS Result Modal ─────────────────────────────────────────────────────────
function ResultModal({ cid, title, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!cid) return
    setProgress(0)
    setLoading(true)

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 90))
    }, 100)

    fetch(`https://gateway.pinata.cloud/ipfs/${cid}`)
      .then(r => r.json())
      .then(d => {
        setProgress(100)
        setData(d)
        setLoading(false)
        clearInterval(progressInterval)
      })
      .catch(() => {
        setError('Could not load deliverable from IPFS')
        setLoading(false)
        clearInterval(progressInterval)
      })

    return () => clearInterval(progressInterval)
  }, [cid])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85), rgba(0,0,0,0.95))',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 300, animation: 'fade-in 0.2s ease',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,19,24,0.98), rgba(21,27,34,0.95))',
        border: '1px solid rgba(0,229,160,0.2)',
        borderRadius: 16, width: '90%', maxWidth: 720, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 60px rgba(0,229,160,0.1), 0 24px 80px rgba(0,0,0,0.6)',
        animation: 'slide-in 0.25s ease',
      }}>
        {/* Header with glow */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(0,229,160,0.15)',
          background: 'linear-gradient(180deg, rgba(0,229,160,0.05), transparent)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(0,229,160,0.2), rgba(0,212,255,0.1))',
              border: '1px solid rgba(0,229,160,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>⬡</div>
            <div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                Task Deliverable
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)',
                marginTop: 2, maxWidth: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{title}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a
              href={`https://gateway.pinata.cloud/ipfs/${cid}`}
              target="_blank" rel="noreferrer"
              style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--blue)',
                background: 'rgba(59,158,255,0.1)',
                border: '1px solid rgba(59,158,255,0.3)',
                padding: '6px 12px', borderRadius: 6,
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(59,158,255,0.2)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(59,158,255,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(59,158,255,0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >↗ Open IPFS</a>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text2)',
                width: 32, height: 32, borderRadius: 8,
                fontSize: 18, lineHeight: 1,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.color = 'var(--text)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.color = 'var(--text2)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            >×</button>
          </div>
        </div>

        {/* Loading progress */}
        {loading && (
          <div style={{ padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 60, height: 60,
              border: '3px solid rgba(0,229,160,0.1)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              boxShadow: '0 0 30px rgba(0,229,160,0.2)',
            }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 12,
                color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: 8,
              }}>Fetching from IPFS</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--text3)',
              }}>Retrieving deliverable data...</div>
            </div>
            <div style={{
              width: '100%', maxWidth: 200,
              height: 4,
              background: 'rgba(30,40,48,0.8)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--accent), var(--cyan))',
                borderRadius: 2,
                transition: 'width 0.2s ease',
                boxShadow: '0 0 10px rgba(0,229,160,0.5)',
              }} />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'var(--red)',
              boxShadow: '0 0 20px rgba(239,68,68,0.2)',
            }}>!</div>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 12,
              color: 'var(--red)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>Failed to Load</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', lineHeight: 1.6 }}>
              {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--red)',
                fontFamily: 'var(--mono)', fontSize: 10,
                padding: '8px 20px', borderRadius: 6,
                cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.25)'
              }}
            >Retry</button>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 0,
            background: 'rgba(0,0,0,0.2)',
          }}>
            <DeliverableView data={data} />
          </div>
        )}

        {/* Footer with CID */}
        {!loading && !error && data && (
          <div style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(0,229,160,0.15)',
            background: 'linear-gradient(180deg, transparent, rgba(0,229,160,0.03))',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 9,
              color: 'var(--text3)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent)',
                boxShadow: '0 0 8px rgba(0,229,160,0.5)',
              }} />
              IPFS CID: <span style={{ color: 'var(--text2)' }}>{cid.slice(0, 8)}...{cid.slice(-6)}</span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(cid)}
              style={{
                background: 'rgba(0,229,160,0.1)',
                border: '1px solid rgba(0,229,160,0.2)',
                color: 'var(--accent)',
                fontFamily: 'var(--mono)', fontSize: 9,
                padding: '4px 10px', borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,229,160,0.2)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0,229,160,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0,229,160,0.1)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >📋 Copy CID</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Renders deliverable based on content_type ─────────────────────────────────
function DeliverableView({ data }) {
  // Unwrap IPFS envelope — agent wraps payload in { taskId, agentWallet, content, ... }
  const inner   = data.content || data

  // Tweet threads
  if (inner.content_type === 'generated' || inner.content_type === 'tweet_thread') {
    const items = inner.items || (Array.isArray(inner) ? inner : [])
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,229,160,0.08), rgba(0,212,255,0.05))',
          border: '1px solid rgba(0,229,160,0.2)',
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(0,229,160,0.15)',
              border: '1px solid rgba(0,229,160,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>✦</div>
            <div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--accent)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 700,
              }}>
                {items.length} items generated
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--text3)',
              }}>
                {inner.generated_at ? ago(inner.generated_at) : ''}
              </div>
            </div>
          </div>
        </div>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.9))',
              border: '1px solid rgba(30,40,48,0.8)',
              borderRadius: 10,
              padding: '14px 18px',
              transition: 'all 0.2s ease',
              borderLeft: '3px solid transparent',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(0,229,160,0.3)'
              e.currentTarget.style.borderLeftColor = 'var(--accent)'
              e.currentTarget.style.transform = 'translateX(2px)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,229,160,0.1)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(30,40,48,0.8)'
              e.currentTarget.style.borderLeftColor = 'transparent'
              e.currentTarget.style.transform = 'translateX(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--text3)',
                background: 'rgba(0,229,160,0.1)',
                border: '1px solid rgba(0,229,160,0.2)',
                padding: '3px 8px',
                borderRadius: 4,
              }}>#{item.index || i+1}</div>
            </div>
            <div style={{
              fontSize: 13,
              color: 'var(--text)',
              lineHeight: 1.7,
            }}>{item.text}</div>
          </div>
        ))}
      </div>
    )
  }

  // Data collection (array of records)
  if (inner.content_type === 'json' || (inner.data && Array.isArray(inner.data))) {
    const records = inner.data || (Array.isArray(inner) ? inner : [])
    return (
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,158,255,0.08), rgba(0,212,255,0.05))',
          border: '1px solid rgba(59,158,255,0.2)',
          borderRadius: 10,
          padding: '14px 18px',
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(59,158,255,0.15)',
              border: '1px solid rgba(59,158,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>◈</div>
            <div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--blue)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 700,
              }}>
                {records.length} records
              </div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--text3)',
              }}>
                source: {inner.source || 'unknown'}
              </div>
            </div>
          </div>
        </div>
        {records.map((rec, i) => (
          <div
            key={i}
            style={{
              background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.9))',
              border: '1px solid rgba(30,40,48,0.8)',
              borderRadius: 10,
              padding: '14px 18px',
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(0,229,160,0.3)'
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(21,27,34,0.9), rgba(15,19,24,0.95))'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(30,40,48,0.8)'
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.9))'
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                color: 'var(--text)',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{rec.name || rec.protocol || JSON.stringify(rec).slice(0, 50)}</div>
              {rec.category && (
                <div style={{
                  display: 'inline-block',
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  color: 'var(--text3)',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '2px 8px',
                  borderRadius: 3,
                  marginTop: 4,
                }}>{rec.category}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
              {rec.tvl_usd != null && (
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  color: 'var(--accent)',
                  fontWeight: 700,
                  textShadow: '0 0 10px rgba(0,229,160,0.3)',
                }}>
                  ${Number(rec.tvl_usd).toLocaleString()}
                </div>
              )}
              {rec.url && (
                <a
                  href={rec.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'rgba(59,158,255,0.1)',
                    border: '1px solid rgba(59,158,255,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(59,158,255,0.2)'
                    e.currentTarget.style.boxShadow = '0 0 15px rgba(59,158,255,0.3)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(59,158,255,0.1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >↗</a>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Code review
  if (inner.issues) {
    return (
      <div style={{ padding: '24px' }}>
        {/* Summary card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,229,160,0.08), rgba(0,212,255,0.05))',
          border: '1px solid rgba(0,229,160,0.2)',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(0,229,160,0.15)',
              border: '1px solid rgba(0,229,160,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}>⚡</div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
            }}>Code Review Summary</div>
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--text2)',
            lineHeight: 1.7,
          }}>{inner.summary}</div>
        </div>

        {inner.issues.length === 0 ? (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,229,160,0.1), rgba(0,229,160,0.05))',
            border: '1px solid rgba(0,229,160,0.3)',
            borderRadius: 10,
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,229,160,0.2)',
              border: '2px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              boxShadow: '0 0 20px rgba(0,229,160,0.3)',
            }}>✓</div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 12,
              color: 'var(--accent)',
              fontWeight: 700,
            }}>No issues found — code looks clean!</div>
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--red)',
                boxShadow: '0 0 8px rgba(239,68,68,0.5)',
              }} />
              {inner.issues.length} issue{inner.issues.length > 1 ? 's' : ''} found
            </div>
            {inner.issues.map((issue, i) => (
              <div
                key={i}
                style={{
                  background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.9))',
                  border: `1px solid ${issue.severity === 'high' ? 'rgba(239,68,68,0.4)' : issue.severity === 'medium' ? 'rgba(245,166,35,0.4)' : 'rgba(30,40,48,0.8)'}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                  marginBottom: 10,
                  borderLeft: `3px solid ${issue.severity === 'high' ? 'var(--red)' : issue.severity === 'medium' ? 'var(--amber)' : 'var(--text3)'}`,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateX(2px)'
                  e.currentTarget.style.boxShadow = `0 4px 20px ${issue.severity === 'high' ? 'rgba(239,68,68,0.2)' : issue.severity === 'medium' ? 'rgba(245,166,35,0.2)' : 'rgba(0,0,0,0.2)'}`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateX(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={pill(issue.severity, issue.severity === 'high' ? 'var(--red)' : issue.severity === 'medium' ? 'var(--amber)' : 'var(--text2)')}>
                    {issue.severity}
                  </span>
                  {issue.line && (
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--text3)',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '2px 8px',
                      borderRadius: 3,
                    }}>line {issue.line}</span>
                  )}
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'var(--text)',
                  marginBottom: 8,
                  lineHeight: 1.6,
                }}>{issue.description}</div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--text3)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(30,40,48,0.6)',
                  borderRadius: 6,
                  padding: '8px 12px',
                }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>→ </span>
                  {issue.recommendation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Fallback: raw JSON with better styling
  return (
    <div style={{ padding: '24px' }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.9))',
        border: '1px solid rgba(30,40,48,0.8)',
        borderRadius: 10,
        padding: '18px 20px',
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 9,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--text3)',
          }} />
          Raw Data
        </div>
        <pre style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--text2)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.6,
          margin: 0,
          maxHeight: '500px',
          overflow: 'auto',
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}

// ── Bid comparison card ───────────────────────────────────────────────────────
function BidCard({ bid, rank, isWinner, canAccept, loading, onAccept }) {
  const winReason = isWinner ? [
    bid.amount_stroops && '↓ lowest bid',
    bid.rep_score_snap >= 80 && '★ high reputation',
    bid.message && '✓ message provided',
  ].filter(Boolean).join(' · ') : null

  return (
    <div style={{
      background: isWinner
        ? 'linear-gradient(135deg, rgba(0,229,160,0.08), rgba(0,212,255,0.05))'
        : 'var(--bg2)',
      border: `1px solid ${isWinner ? 'rgba(0,229,160,0.4)' : 'var(--border)'}`,
      borderRadius: 'var(--r2)', padding: '14px 16px',
      position: 'relative', marginBottom: 10,
      transition: 'all 0.2s ease',
      boxShadow: isWinner ? '0 0 20px rgba(0,229,160,0.1)' : 'none',
    }}
      onMouseEnter={e => {
        if (!isWinner) {
          e.currentTarget.style.borderColor = 'var(--border2)';
          e.currentTarget.style.transform = 'translateX(2px)';
        }
      }}
      onMouseLeave={e => {
        if (!isWinner) {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.transform = 'translateX(0)';
        }
      }}
    >
      {/* Rank badge with glow */}
      <div style={{
        position: 'absolute', top: 10, right: 12,
        fontFamily: 'var(--mono)', fontSize: 10,
        color: isWinner ? 'var(--accent)' : 'var(--text3)',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 4,
        background: isWinner ? 'rgba(0,229,160,0.15)' : 'transparent',
        border: isWinner ? '1px solid rgba(0,229,160,0.3)' : 'none',
      }}>
        {isWinner ? '★ WINNING' : `#${rank}`}
      </div>

      {/* Top row: name + amount */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>
          {bid.bidder_name || shortAddr(bid.bidder_wallet)}
        </span>
        <span style={pill(bid.status, bid.status === 'winning' ? 'var(--accent)' : bid.status === 'paid' ? 'var(--blue)' : 'var(--text3)')}>
          {bid.status}
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, marginBottom: bid.message ? 10 : 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>bid amount</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--accent)', fontWeight: 700 }}>{lumens(bid.amount_stroops)} XLM</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>rep score</div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700,
            color: bid.rep_score_snap >= 80 ? 'var(--accent)' : bid.rep_score_snap >= 60 ? 'var(--amber)' : 'var(--text2)',
          }}>{bid.rep_score_snap}</div>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>submitted</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{ago(bid.created_at)}</div>
        </div>
      </div>

      {/* Pitch message */}
      {bid.message && (
        <div style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10,
          fontStyle: 'italic', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6,
        }}>
          "{bid.message}"
        </div>
      )}

      {/* Why this agent won */}
      {isWinner && winReason && (
        <div style={{
          background: 'var(--accent)10', border: '1px solid var(--accent)30',
          borderRadius: 'var(--r)', padding: '6px 10px', marginBottom: 10,
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)',
        }}>
          Why this bid: {winReason}
        </div>
      )}

      {/* Accept button */}
      {canAccept && bid.status === 'pending' && (
        <button onClick={() => onAccept(bid.id)} disabled={loading}
          style={{ ...btn('var(--accent)', loading), width: '100%', padding: '8px', textAlign: 'center' }}>
          {loading ? 'accepting...' : `accept this bid — ${lumens(bid.amount_stroops)} XLM`}
        </button>
      )}
    </div>
  )
}

// ── Task row with expanded panel ──────────────────────────────────────────────
function TaskRow({ task, index, wallet, authHeaders, signSorobanTx, onRefetch }) {
  const [expanded, setExpanded] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [ipfsCid,  setIpfsCid]  = useState('')
  const { bids } = useBids(expanded ? task.id : null)

  // Auto-fill CID from task when in_progress and agent has submitted
  useEffect(() => {
    if (task.ipfs_cid && !ipfsCid) setIpfsCid(task.ipfs_cid)
  }, [task.ipfs_cid, ipfsCid])

  const isMyTask  = wallet && task.poster_wallet?.toLowerCase() === wallet.publicKey?.toLowerCase()
  const canAccept = isMyTask && task.status === 'bidding'
  const canSettle = isMyTask && task.status === 'in_progress'
  const hasResult = !!task.ipfs_cid

  // Sort bids: lowest amount first (most competitive), winning bid pinned top
  const sortedBids = [...bids].sort((a, b) => {
    if (a.status === 'winning') return -1
    if (b.status === 'winning') return 1
    return Number(BigInt(a.amount_stroops || 0)) - Number(BigInt(b.amount_stroops || 0))
  })

  async function acceptBid(bidId) {
    const bid = bids.find(b => b.id === bidId)
    if (!bid) return setMsg({ ok: false, text: 'Bid not found' })

    setLoading(true); setMsg(null)
    try {
      setMsg({ ok: true, text: 'Sign accept_bid in your wallet...' })
      const { txHash } = await acceptBidWithWallet({
        rpcUrl: STELLAR_RPC_URL,
        contractId: SOROBAN_CONTRACT_ID,
        publicKey: wallet.publicKey,
        signTxXdr: signSorobanTx,
        chainTaskId: task.chain_task_id,
        chainBidId: bid.chain_bid_id,
      })
      setMsg({ ok: true, text: 'Confirming on backend...' })
      const headers = await authHeaders()
      const res  = await fetch(`${API_BASE}/bids/${bidId}/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tx_hash: txHash }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)

      setMsg({ ok: true, text: 'Bid accepted. Agent will start executing shortly.' })
      onRefetch()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally { setLoading(false) }
  }

  async function settle() {
    if (!ipfsCid) return setMsg({ ok: false, text: 'No IPFS CID yet — wait for agent to submit deliverable' })
    const winningBid = bids.find(b => b.status === 'winning')
    if (!winningBid) return setMsg({ ok: false, text: 'No winning bid found' })
    setLoading(true); setMsg(null)
    try {
      setMsg({ ok: true, text: 'Settling task and sending Stellar payment...' })
      const headers = await authHeaders()
      const res  = await fetch(`${API_BASE}/tasks/${task.id}/settle`, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          ipfs_cid:        ipfsCid,
          winning_bid_id:  winningBid.id,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)

      const txHash = body.payment?.tx_hash || 'n/a'
      setMsg({ ok: true, text: `Settled on Stellar. Agent payout sent. Tx: ${txHash.slice(0, 12)}...` })
      onRefetch()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally { setLoading(false) }
  }

  const rowBg = index % 2 === 0 ? 'var(--bg)' : 'var(--bg2)'

  return (
    <div
      style={{
        borderBottom: '1px solid rgba(30,40,48,0.6)',
        background: rowBg,
        transition: 'all 0.2s ease',
      }}
      id={`task-row-${task.id}`}
    >

      {/* Main row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 110px 90px 80px 70px 80px 80px',
          padding: '14px 16px',
          alignItems: 'center',
          gap: 4,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.parentElement.style.background = 'linear-gradient(90deg, rgba(0,229,160,0.03), rgba(15,19,24,0.9))';
          e.currentTarget.parentElement.style.borderLeft = '2px solid var(--accent)';
        }}
        onMouseLeave={e => {
          e.currentTarget.parentElement.style.background = rowBg;
          e.currentTarget.parentElement.style.borderLeft = 'none';
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
            {isMyTask && <span style={pill('yours', 'var(--accent)')}>yours</span>}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
            {shortAddr(task.poster_wallet)} · {ago(task.created_at)}
            {(canAccept || canSettle) && <span style={{ color: 'var(--amber)', marginLeft: 8 }}>· action needed ↓</span>}
          </div>
        </div>
        <div><span style={pill(task.category.replace('_',' '), CATEGORY_COLORS[task.category] || '#888')}>{task.category.replace('_',' ')}</span></div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{lumens(task.budget_stroops)} XLM</span>
        <div><span style={pill(task.status, STATUS_COLORS[task.status] || '#888')}>{task.status.replace('_',' ')}</span></div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: task.bid_count > 0 ? 'var(--text)' : 'var(--text3)' }}>
          {task.bid_count > 0 ? task.bid_count : '—'}
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: timeLeft(task.deadline) === 'expired' ? 'var(--red)' : 'var(--text2)' }}>
          {timeLeft(task.deadline)}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {task.tx_hash
            ? <a href={`${EXPLORER}/tx/${task.tx_hash}`} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 10, textDecoration: 'none' }}>↗ tx</a>
            : <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 10 }}>—</span>
          }
          {hasResult && (
            <button
              onClick={e => { e.stopPropagation(); setShowResult(true) }}
              style={{
                background: 'linear-gradient(135deg, rgba(59,158,255,0.2), rgba(59,158,255,0.1))',
                border: '1px solid rgba(59,158,255,0.4)',
                color: 'var(--blue)',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                fontWeight: 700,
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                transition: 'all 0.2s ease',
                boxShadow: '0 0 10px rgba(59,158,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,158,255,0.3), rgba(59,158,255,0.15))'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(59,158,255,0.4)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,158,255,0.2), rgba(59,158,255,0.1))'
                e.currentTarget.style.boxShadow = '0 0 10px rgba(59,158,255,0.2)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <span style={{ fontSize: 10 }}>⬡</span>
              view result
            </button>
          )}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{
          padding: '20px 16px',
          borderTop: '1px solid rgba(0,229,160,0.2)',
          background: 'linear-gradient(135deg, rgba(21,27,34,0.9), rgba(15,19,24,0.95))',
          animation: 'slide-in 0.2s ease',
          boxShadow: 'inset 0 0 40px rgba(0,229,160,0.05)',
        }}>

          {/* Bid comparison */}
          {sortedBids.length > 0 ? (
            <div style={{ marginBottom: canSettle ? 16 : 0 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {sortedBids.length} bid{sortedBids.length > 1 ? 's' : ''} — sorted by competitiveness
              </div>
              {sortedBids.map((bid, i) => (
                <BidCard
                  key={bid.id}
                  bid={bid}
                  rank={i + 1}
                  isWinner={bid.status === 'winning' || bid.status === 'paid'}
                  canAccept={canAccept}
                  loading={loading}
                  onAccept={acceptBid}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', marginBottom: canSettle ? 16 : 0 }}>
              No bids yet — agent polls every 5 minutes.
            </div>
          )}

          {/* Settle panel */}
          {canSettle && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,166,35,0.08), rgba(21,27,34,0.8))',
              border: '1px solid rgba(245,166,35,0.3)',
              borderRadius: 'var(--r2)',
              padding: '16px',
              boxShadow: '0 0 30px rgba(245,166,35,0.1)',
            }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--amber)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--amber)',
                  animation: task.ipfs_cid ? 'none' : 'pulse-dot 1.5s infinite',
                  boxShadow: '0 0 8px rgba(245,166,35,0.5)',
                }} />
                {task.ipfs_cid ? 'Deliverable ready — release payment' : 'Waiting for agent to submit deliverable...'}
              </div>

              {task.ipfs_cid ? (
                <>
                  {/* CID preview */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--text2)',
                      background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.9))',
                      border: '1px solid rgba(0,229,160,0.2)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
                    }}>
                      {task.ipfs_cid}
                    </div>
                    <button
                      onClick={() => setShowResult(true)}
                      style={{
                        background: 'linear-gradient(135deg, rgba(59,158,255,0.2), rgba(59,158,255,0.1))',
                        border: '1px solid rgba(59,158,255,0.4)',
                        color: 'var(--blue)',
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '8px 14px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 0 10px rgba(59,158,255,0.2)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,158,255,0.3), rgba(59,158,255,0.15))'
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(59,158,255,0.4)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,158,255,0.2), rgba(59,158,255,0.1))'
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(59,158,255,0.2)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      ⬡ preview
                    </button>
                  </div>

                  {/* Payment breakdown */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    {[
                      { label: 'budget', val: `${lumens(task.budget_stroops)} XLM`, color: 'var(--text)' },
                      { label: 'agent gets (80%)', val: `${(parseFloat(lumens(task.budget_stroops)) * 0.8).toFixed(4)} XLM`, color: 'var(--accent)' },
                      { label: 'you get (20%)', val: `${(parseFloat(lumens(task.budget_stroops)) * 0.2).toFixed(4)} XLM`, color: 'var(--amber)' },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: s.color, fontWeight: 700 }}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  <button onClick={settle} disabled={loading}
                    style={{ ...btn('var(--amber)', loading), width: '100%', padding: '10px', textAlign: 'center', fontSize: 11 }}>
                    {loading ? 'settling...' : 'confirm & release payment →'}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amber)', animation: 'pulse-dot 1.5s infinite', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                    Agent is executing the task. CID will appear here automatically when done.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Completed state */}
          {task.status === 'completed' && task.ipfs_cid && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--accent)',
                fontWeight: 700,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 8px rgba(0,229,160,0.5)',
                }} />
                Task complete
              </span>
              <button
                onClick={() => setShowResult(true)}
                style={{
                  background: 'linear-gradient(135deg, rgba(59,158,255,0.2), rgba(59,158,255,0.1))',
                  border: '1px solid rgba(59,158,255,0.4)',
                  color: 'var(--blue)',
                  fontFamily: 'var(--mono)',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '6px 14px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 0 10px rgba(59,158,255,0.2)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,158,255,0.3), rgba(59,158,255,0.15))'
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(59,158,255,0.4)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,158,255,0.2), rgba(59,158,255,0.1))'
                  e.currentTarget.style.boxShadow = '0 0 10px rgba(59,158,255,0.2)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                ⬡ view deliverable
              </button>
              <a
                href={`${EXPLORER}/tx/${task.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--blue)',
                  textDecoration: 'none',
                  background: 'rgba(59,158,255,0.1)',
                  border: '1px solid rgba(59,158,255,0.3)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(59,158,255,0.2)'
                  e.currentTarget.style.boxShadow = '0 0 15px rgba(59,158,255,0.3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(59,158,255,0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                ↗ payment tx
              </a>
            </div>
          )}

          {/* Message */}
          {msg && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 'var(--r)',
              background: msg.ok ? 'var(--accent)18' : 'var(--red)18',
              border: `1px solid ${msg.ok ? 'var(--accent)' : 'var(--red)'}40`,
              fontFamily: 'var(--mono)', fontSize: 11,
              color: msg.ok ? 'var(--accent)' : 'var(--red)',
            }}>
              {msg.text}
            </div>
          )}
        </div>
      )}

      {/* Result modal */}
      {showResult && task.ipfs_cid && (
        <ResultModal cid={task.ipfs_cid} title={task.title} onClose={() => setShowResult(false)} />
      )}
    </div>
  )
}

// ── Main TaskFeed ─────────────────────────────────────────────────────────────
export default function TaskFeed() {
  const [filter,   setFilter]  = useState('all')
  const [showPost, setShowPost] = useState(false)
  const { tasks, loading, refetch } = useTasks(filter)
  const { wallet, authHeaders, signSorobanTx } = useWallet()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,229,160,0.02), transparent 60%)' }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(30,40,48,0.8)',
        background: 'linear-gradient(180deg, rgba(15,19,24,0.9), rgba(10,12,15,0.95))',
        backdropFilter: 'blur(10px)',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', padding: '0 16px', borderRight: '1px solid rgba(30,40,48,0.6)' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'rgba(0,229,160,0.1)' : 'transparent',
                borderRight: '1px solid rgba(30,40,48,0.6)',
                borderTop: 'none', borderLeft: 'none',
                borderBottom: filter === f ? '2px solid var(--accent)' : '2px solid transparent',
                color: filter === f ? 'var(--accent)' : 'var(--text2)',
                fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
                letterSpacing: '0.1em', padding: '12px 18px', transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (filter !== f) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={e => {
                if (filter !== f) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text2)';
                }
              }}
            >
              {f.replace('_',' ')}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, padding: '0 20px' }}>
          {loading && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--amber)',
              animation: 'pulse-dot 1s infinite',
              boxShadow: '0 0 10px rgba(245,166,35,0.5)',
            }} />
          )}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', letterSpacing: '0.05em' }}>
            {tasks.length} tasks
          </span>
          <button
            onClick={() => setShowPost(true)}
            style={{
              background: wallet
                ? 'linear-gradient(135deg, var(--accent), rgba(0,229,160,0.9))'
                : 'rgba(255,255,255,0.03)',
              border: wallet ? 'none' : '1px solid var(--border2)',
              color: wallet ? '#000' : 'var(--text3)',
              fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
              padding: '6px 16px', borderRadius: 'var(--r2)', letterSpacing: '0.06em',
              cursor: wallet ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              boxShadow: wallet ? '0 0 20px rgba(0,229,160,0.3)' : 'none',
            }}
            onMouseEnter={e => {
              if (wallet) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(0,229,160,0.5)';
              }
            }}
            onMouseLeave={e => {
              if (wallet) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(0,229,160,0.3)';
              }
            }}
          >
            {wallet ? '+ post task' : 'connect to post'}
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 110px 90px 80px 70px 80px 80px',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(0,229,160,0.15)',
        fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.12em',
        background: 'linear-gradient(180deg, rgba(0,229,160,0.05), transparent)',
      }}>
        <span>Task</span><span>Category</span><span>Budget</span>
        <span>Status</span><span>Bids</span><span>Deadline</span><span>Actions</span>
      </div>

      {/* Rows */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {tasks.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
            No tasks found. {wallet ? 'Post the first one!' : 'Connect wallet to post a task.'}
          </div>
        )}
        {tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} index={i} wallet={wallet} authHeaders={authHeaders} signSorobanTx={signSorobanTx} onRefetch={refetch} />
        ))}
      </div>

      {showPost && <PostTask onClose={() => setShowPost(false)} onSuccess={refetch} />}
    </div>
  )
}