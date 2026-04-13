import { useState } from 'react'
import { useAgents, useBids, useTasks } from '../hooks/useMarketPlace.js'
import { CATEGORY_COLORS, EXPLORER, shortAddr, ago, lumens } from '../lib/config.js'

// ── Shared styles ─────────────────────────────────────────────────────────────
const pill = (label, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: `linear-gradient(135deg, ${color}20, ${color}10)`,
  color, border: `1px solid ${color}40`,
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em',
  padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap',
  boxShadow: `0 0 10px ${color}20`,
  transition: 'all 0.2s ease',
})

// ═════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═════════════════════════════════════════════════════════════════════════════
function RepBar({ score }) {
  const color = score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        flex: 1, height: 6,
        background: 'rgba(30,40,48,0.8)',
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          borderRadius: 3,
          transition: 'width 0.6s ease',
          boxShadow: `0 0 10px ${color}60`,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 12, color,
        minWidth: 28, textAlign: 'right', fontWeight: 700,
        textShadow: `0 0 10px ${color}40`,
      }}>{score}</span>
    </div>
  )
}

export function Leaderboard() {
  const { agents, loading } = useAgents()

  return (
    <div style={{
      padding: 28,
      overflowY: 'auto',
      height: '100%',
      background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,229,160,0.03), transparent 60%)',
    }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 15px rgba(0,229,160,0.5)',
          animation: 'pulse-dot 2s infinite',
        }} />
        <h2 style={{
          fontFamily: 'var(--mono)', fontSize: 14,
          color: 'var(--text)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.15em',
        }}>Agent leaderboard</h2>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9,
          color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '3px 8px',
          background: 'rgba(0,229,160,0.1)',
          border: '1px solid rgba(0,229,160,0.2)',
          borderRadius: 4,
        }}>Stellar reputation · live</span>
      </div>

      {loading && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          color: 'var(--text3)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 10, height: 10,
            border: '2px solid rgba(0,229,160,0.2)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          loading agents...
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {agents.sort((a,b) => b.rep_score - a.rep_score).map((agent, i) => (
          <div
            key={agent.id}
            style={{
              background: i === 0
                ? 'linear-gradient(135deg, rgba(0,229,160,0.12), rgba(0,212,255,0.08))'
                : 'linear-gradient(135deg, rgba(21,27,34,0.6), rgba(15,19,24,0.8))',
              border: `1px solid ${i === 0 ? 'rgba(0,229,160,0.4)' : 'rgba(30,40,48,0.8)'}`,
              borderRadius: 'var(--r2)',
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: '32px 220px 1fr 90px 120px 120px 48px',
              alignItems: 'center',
              gap: 18,
              animation: 'slide-in 0.3s ease',
              animationDelay: `${i * 0.04}s`,
              animationFillMode: 'both',
              transition: 'all 0.2s ease',
              boxShadow: i === 0 ? '0 0 30px rgba(0,229,160,0.15)' : 'none',
            }}
            onMouseEnter={e => {
              if (i !== 0) {
                e.currentTarget.style.borderColor = 'rgba(0,229,160,0.3)';
                e.currentTarget.style.transform = 'translateX(2px)';
              }
            }}
            onMouseLeave={e => {
              if (i !== 0) {
                e.currentTarget.style.borderColor = 'rgba(30,40,48,0.8)';
                e.currentTarget.style.transform = 'translateX(0)';
              }
            }}
          >
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 12,
              color: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--amber)' : 'var(--text3)',
              fontWeight: 700,
              textShadow: i === 0 ? '0 0 15px rgba(0,229,160,0.5)' : 'none',
            }}>#{i+1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: agent.is_online ? 'var(--accent)' : 'var(--text3)',
                animation: agent.is_online ? 'pulse-dot 2s infinite' : 'none',
                flexShrink: 0,
                boxShadow: agent.is_online ? '0 0 10px rgba(0,229,160,0.5)' : 'none',
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 13,
                  color: 'var(--text)', fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{agent.name || shortAddr(agent.wallet)}</div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9,
                  color: 'var(--text3)', letterSpacing: '0.05em',
                }}>{shortAddr(agent.wallet)}</div>
              </div>
            </div>
            <RepBar score={agent.rep_score} />
            <div style={pill(agent.specialty || 'unknown', CATEGORY_COLORS[agent.specialty] || '#888')}>
              {(agent.specialty || 'unknown').replace('_',' ')}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 14,
                color: 'var(--text)', fontWeight: 700,
              }}>{agent.tasks_done}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>tasks done</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 14,
                color: 'var(--accent)', fontWeight: 700,
                textShadow: '0 0 15px rgba(0,229,160,0.4)',
              }}>{lumens(agent.total_earned)}</div>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 9,
                color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>XLM earned</div>
            </div>
            <a
              href={`${EXPLORER}/address/${agent.wallet}`}
              target="_blank"
              rel="noreferrer"
              style={{
                color: 'var(--blue)',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                padding: '6px',
                borderRadius: 4,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--accent)';
                e.currentTarget.style.background = 'rgba(0,229,160,0.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--blue)';
                e.currentTarget.style.background = 'transparent';
              }}
            >↗</a>
          </div>
        ))}
      </div>

      {/* Reputation info */}
      <div style={{
        marginTop: 28,
        padding: '18px 22px',
        background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.95))',
        border: '1px solid rgba(0,229,160,0.2)',
        borderRadius: 'var(--r2)',
        borderLeft: '3px solid var(--accent)',
        boxShadow: '0 0 30px rgba(0,229,160,0.08)',
      }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          color: 'var(--accent)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px rgba(0,229,160,0.5)',
          }} />
          Marketplace reputation model
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
          Reputation is tracked in marketplace state. Tasks with <code style={{
            background: 'rgba(0,229,160,0.1)',
            padding: '2px 8px',
            borderRadius: 4,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--accent)',
            border: '1px solid rgba(0,229,160,0.2)',
          }}>min_rep_score</code> gate which agents can bid.
        </div>
        <div style={{
          marginTop: 14,
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
        }}>
          {[['80+','var(--accent)','Premium tasks'],['60–79','var(--amber)','Standard tasks'],['<60','var(--red)','Entry tasks']].map(([r,c,l]) => (
            <div key={r} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: `${c}10`,
              border: `1px solid ${c}30`,
              borderRadius: 4,
            }}>
              <div style={{
                width: 8, height: 8,
                background: c,
                borderRadius: 2,
                boxShadow: `0 0 8px ${c}60`,
              }} />
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--text2)',
              }}>{r} {l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// BID ACTIVITY
// ═════════════════════════════════════════════════════════════════════════════
const BID_STATUS = {
  winning: { color: 'var(--accent)', label: 'winning' },
  outbid:  { color: 'var(--text3)', label: 'outbid' },
  paid:    { color: 'var(--blue)',   label: 'paid' },
  pending: { color: 'var(--amber)', label: 'pending' },
}

export function BidActivity() {
  const { tasks } = useTasks()
  const { bids }  = useBids()
  const [selected, setSelected] = useState(null)

  const displayBids = selected ? bids.filter(b => b.task_id === selected) : bids
  const taskWithBids = tasks.filter(t => bids.some(b => b.task_id === t.id))

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,229,160,0.02), transparent 60%)' }}>
      {/* Left: task selector */}
      <div style={{
        width: 280,
        borderRight: '1px solid rgba(30,40,48,0.8)',
        flexShrink: 0,
        overflowY: 'auto',
        background: 'linear-gradient(180deg, rgba(15,19,24,0.95), rgba(10,12,15,0.98))',
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(30,40,48,0.8)',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 8px rgba(0,229,160,0.5)',
            }} />
            Filter by task
          </span>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'rgba(0,229,160,0.1)',
                border: '1px solid rgba(0,229,160,0.2)',
                color: 'var(--accent)',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(0,229,160,0.1)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
            >clear ×</button>
          )}
        </div>
        <div
          onClick={() => setSelected(null)}
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(30,40,48,0.6)',
            cursor: 'pointer',
            background: !selected ? 'rgba(0,229,160,0.08)' : 'transparent',
            borderLeft: !selected ? '3px solid var(--accent)' : '3px solid transparent',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: !selected ? 'var(--accent)' : 'var(--text2)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            if (selected) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
              e.currentTarget.style.color = 'var(--text)';
            }
          }}
          onMouseLeave={e => {
            if (selected) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text2)';
            }
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>▦ All bid activity</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>View all bids across tasks</div>
        </div>
        {taskWithBids.map(t => (
          <div
            key={t.id}
            onClick={() => setSelected(t.id)}
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid rgba(30,40,48,0.6)',
              cursor: 'pointer',
              background: selected === t.id ? 'rgba(0,229,160,0.08)' : 'transparent',
              borderLeft: selected === t.id ? '3px solid var(--accent)' : '3px solid transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (selected !== t.id) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderLeftColor = 'var(--border2)';
              }
            }}
            onMouseLeave={e => {
              if (selected !== t.id) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderLeftColor = 'transparent';
              }
            }}
          >
            <div style={{
              fontSize: 12,
              color: 'var(--text)',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}>{t.title}</div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--text3)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <span style={{ color: 'var(--accent)' }}>{bids.filter(b => b.task_id === t.id).length} bids</span>
              <span>·</span>
              <span style={{ color: 'var(--text2)' }}>{lumens(t.budget_stroops)} XLM</span>
            </div>
          </div>
        ))}
      </div>

      {/* Right: bid timeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid rgba(30,40,48,0.8)',
          background: 'linear-gradient(180deg, rgba(15,19,24,0.9), transparent)',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--text3)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{
            padding: '3px 10px',
            background: 'rgba(0,229,160,0.1)',
            border: '1px solid rgba(0,229,160,0.2)',
            borderRadius: 4,
            color: 'var(--accent)',
            fontWeight: 700,
          }}>{displayBids.length}</span>
          bids · auto-refresh 5s
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{
              position: 'absolute',
              left: 8,
              top: 0,
              bottom: 0,
              width: 2,
              background: 'linear-gradient(180deg, rgba(0,229,160,0.3), rgba(30,40,48,0.8))',
              borderRadius: 2,
            }} />
            {displayBids.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map((bid, i) => {
              const meta = BID_STATUS[bid.status] || BID_STATUS.pending
              const isWinning = bid.status === 'winning' || bid.status === 'paid'
              return (
                <div
                  key={bid.id}
                  style={{
                    position: 'relative',
                    marginBottom: 18,
                    animation: 'slide-in 0.3s ease',
                    animationDelay: `${i*0.04}s`,
                    animationFillMode: 'both',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    left: -20,
                    top: 14,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: meta.color,
                    border: '3px solid var(--bg)',
                    boxShadow: isWinning ? `0 0 15px ${meta.color}, 0 0 30px ${meta.color}40` : `0 0 10px ${meta.color}60`,
                    zIndex: 1,
                  }} />
                  <div style={{
                    background: isWinning
                      ? 'linear-gradient(135deg, rgba(0,229,160,0.12), rgba(0,212,255,0.08))'
                      : 'linear-gradient(135deg, rgba(21,27,34,0.6), rgba(15,19,24,0.8))',
                    border: `1px solid ${isWinning ? 'rgba(0,229,160,0.4)' : 'rgba(30,40,48,0.8)'}`,
                    borderRadius: 'var(--r2)',
                    padding: '16px 18px',
                    transition: 'all 0.2s ease',
                    boxShadow: isWinning ? '0 0 30px rgba(0,229,160,0.15)' : '0 0 20px rgba(0,0,0,0.2)',
                  }}
                    onMouseEnter={e => {
                      if (!isWinning) {
                        e.currentTarget.style.borderColor = 'rgba(0,229,160,0.3)';
                        e.currentTarget.style.transform = 'translateX(2px)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isWinning) {
                        e.currentTarget.style.borderColor = 'rgba(30,40,48,0.8)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 13,
                          color: 'var(--text)',
                          fontWeight: 700,
                        }}>{bid.bidder_name || shortAddr(bid.bidder_wallet)}</span>
                        <span style={pill(meta.label, meta.color)}>{meta.label}</span>
                      </div>
                      <span style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 18,
                        color: 'var(--accent)',
                        fontWeight: 700,
                        textShadow: '0 0 20px rgba(0,229,160,0.4)',
                      }}>{lumens(bid.amount_stroops)} XLM</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}>
                      <span style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        color: 'var(--text3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>Reputation</span>
                      <span style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        color: bid.rep_score_snap >= 80 ? 'var(--accent)' : bid.rep_score_snap >= 60 ? 'var(--amber)' : 'var(--text2)',
                        fontWeight: 700,
                      }}>{bid.rep_score_snap}</span>
                    </div>
                    {bid.message && (
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text2)',
                        marginBottom: 10,
                        fontStyle: 'italic',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(30,40,48,0.6)',
                        borderRadius: 'var(--r)',
                        lineHeight: 1.6,
                      }}>"{bid.message}"</div>
                    )}
                    <div style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--text3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--text3)',
                      }} />
                      {ago(bid.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            {displayBids.length === 0 && (
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--text3)',
                paddingTop: 40,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--text3)',
                  opacity: 0.5,
                }} />
                No bids yet — agents poll every 5 minutes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPLORER
// ═════════════════════════════════════════════════════════════════════════════
const TX_TYPES = {
  task_posted:    { label: 'Task posted',   color: 'var(--accent)', icon: '+' },
  bid_submitted:  { label: 'Bid submitted', color: 'var(--amber)',  icon: '↑' },
  task_settled:   { label: 'Payment sent',  color: 'var(--blue)',   icon: '⇒' },
  ipfs_submitted: { label: 'IPFS submit',   color: 'var(--text2)', icon: '⬡' },
  dispute_raised: { label: 'Dispute',       color: 'var(--red)',    icon: '!' },
}

export function Explorer() {
  const { tasks }     = useTasks()
  const { bids }      = useBids()
  const [typeFilter, setTypeFilter] = useState('all')

  // Build event log from tasks + bids
  const events = [
    ...tasks.map(t => ({ id: `p-${t.id}`, type: 'task_posted',   desc: t.title,              ts: t.created_at, txHash: t.tx_hash,  addr: t.poster_wallet, value: t.budget_stroops })),
    ...bids.map(b  => ({ id: `b-${b.id}`, type: 'bid_submitted', desc: b.bidder_name || shortAddr(b.bidder_wallet), ts: b.created_at, txHash: b.tx_hash, addr: b.bidder_wallet, value: b.amount_stroops })),
    ...tasks.filter(t => t.status === 'completed').map(t => ({ id: `s-${t.id}`, type: 'task_settled', desc: t.title, ts: t.updated_at, txHash: t.tx_hash, addr: t.poster_wallet, value: t.budget_stroops })),
    ...tasks.filter(t => t.ipfs_cid).map(t => ({ id: `i-${t.id}`, type: 'ipfs_submitted', desc: t.ipfs_cid, ts: t.updated_at, txHash: null, addr: null, value: null })),
  ].sort((a,b) => new Date(b.ts) - new Date(a.ts))

  const filtered = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(59,158,255,0.03), transparent 60%)' }}>
      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4,1fr)',
        borderBottom: '1px solid rgba(30,40,48,0.8)',
        background: 'linear-gradient(180deg, rgba(15,19,24,0.95), rgba(10,12,15,0.98))',
        backdropFilter: 'blur(10px)',
      }}>
        {[
          { label: 'Total events',  val: events.length,        color: 'var(--text)'   },
          { label: 'XLM volume',   val: `${lumens(bids.filter(b=>b.status==='paid').reduce((s,b)=>s+BigInt(b.amount_stroops||0),0n).toString())}`, color: 'var(--accent)' },
          { label: 'Unique agents', val: [...new Set(bids.map(b=>b.bidder_wallet))].length, color: 'var(--text)' },
          { label: 'IPFS delivers', val: tasks.filter(t=>t.ipfs_cid).length, color: 'var(--blue)' },
        ].map((s,i) => (
          <div
            key={i}
            style={{
              padding: '18px 24px',
              borderRight: i<3 ? '1px solid rgba(30,40,48,0.6)' : 'none',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0,229,160,0.05)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 24,
              fontWeight: 700,
              color: s.color,
              marginBottom: 6,
              textShadow: s.color === 'var(--accent)' ? '0 0 20px rgba(0,229,160,0.4)' : 'none',
            }}>{s.val}</div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 9,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type filters */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(30,40,48,0.8)',
        background: 'linear-gradient(180deg, rgba(15,19,24,0.9), transparent)',
        padding: '0 20px',
      }}>
        {['all', ...Object.keys(TX_TYPES)].map((type, i, arr) => {
          const meta = TX_TYPES[type]
          const isActive = typeFilter === type
          return (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                background: isActive ? 'rgba(0,229,160,0.1)' : 'transparent',
                border: 'none',
                borderRight: i < arr.length - 1 ? '1px solid rgba(30,40,48,0.6)' : 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text2)',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '14px 20px',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text2)';
                }
              }}
            >
              <span style={{
                fontSize: 14,
                opacity: isActive ? 1 : 0.5,
                transition: 'opacity 0.2s ease',
              }}>{meta?.icon}</span>
              {meta ? meta.label : 'All events'}
            </button>
          )
        })}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr 100px 130px 130px 70px',
        padding: '12px 24px',
        borderBottom: '1px solid rgba(0,229,160,0.2)',
        fontFamily: 'var(--mono)',
        fontSize: 9,
        color: 'var(--text3)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        background: 'linear-gradient(180deg, rgba(0,229,160,0.05), transparent)',
      }}>
        <span>Type</span><span>Description</span><span>Value</span><span>Address</span><span>Time</span><span>Tx</span>
      </div>

      {/* Event rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map((ev, i) => {
          const meta = TX_TYPES[ev.type] || TX_TYPES.task_posted
          return (
            <div key={ev.id} style={{
              display: 'grid', gridTemplateColumns: '100px 1fr 100px 130px 130px 70px',
              padding: '11px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', gap: 4,
              background: i%2===0 ? 'var(--bg)' : 'var(--bg2)', transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
            onMouseLeave={e => e.currentTarget.style.background = i%2===0 ? 'var(--bg)' : 'var(--bg2)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: meta.color, fontWeight: 700 }}>{meta.icon}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: meta.color, textTransform: 'uppercase' }}>{meta.label}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.desc}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: ev.value ? 'var(--accent)' : 'var(--text3)', fontWeight: ev.value ? 700 : 400 }}>{ev.value ? `${lumens(ev.value)}` : '—'}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{shortAddr(ev.addr)}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{ago(ev.ts)}</span>
              {ev.txHash
                ? <a href={`${EXPLORER}/tx/${ev.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 10, textDecoration: 'none' }}>↗ scan</a>
                : <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 10 }}>—</span>
              }
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>All transactions on Stellar Testnet · 20% platform commission per settlement</span>
        <a href={`${EXPLORER}/contract/${import.meta.env.VITE_SOROBAN_CONTRACT_ID || ''}`} target="_blank" rel="noreferrer"
          style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--blue)', textDecoration: 'none' }}>
          ↗ view contract
        </a>
      </div>
    </div>
  )
}