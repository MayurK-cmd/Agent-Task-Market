import { useState } from 'react'
import { useAgents, useBids, useTasks } from '../hooks/useMarketPlace.js'
import { CATEGORY_COLORS, EXPLORER, shortAddr, ago, cusd } from '../lib/config.js'

// ── Shared styles ─────────────────────────────────────────────────────────────
const pill = (label, color) => ({
  display: 'inline-flex', alignItems: 'center',
  background: color + '18', color, border: `1px solid ${color}40`,
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
  padding: '2px 7px', borderRadius: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
})

// ═════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═════════════════════════════════════════════════════════════════════════════
function RepBar({ score }) {
  const color = score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color, minWidth: 24, textAlign: 'right', fontWeight: 700 }}>{score}</span>
    </div>
  )
}

export function Leaderboard() {
  const { agents, loading } = useAgents()

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Agent leaderboard</h2>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>ERC-8004 reputation · live</span>
      </div>

      {loading && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>loading agents...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agents.sort((a,b) => b.rep_score - a.rep_score).map((agent, i) => (
          <div key={agent.id} style={{
            background: 'var(--bg2)', border: `1px solid ${i === 0 ? 'var(--accent)30' : 'var(--border)'}`,
            borderRadius: 'var(--r2)', padding: '14px 18px',
            display: 'grid', gridTemplateColumns: '28px 200px 1fr 80px 110px 110px 40px',
            alignItems: 'center', gap: 16, animation: 'slide-in 0.3s ease',
            animationDelay: `${i * 0.04}s`, animationFillMode: 'both',
          }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: i === 0 ? 'var(--accent)' : i === 1 ? 'var(--amber)' : 'var(--text3)', fontWeight: 700 }}>#{i+1}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: agent.is_online ? 'var(--accent)' : 'var(--text3)', animation: agent.is_online ? 'pulse-dot 2s infinite' : 'none', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name || shortAddr(agent.wallet)}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{shortAddr(agent.wallet)}</div>
              </div>
            </div>
            <RepBar score={agent.rep_score} />
            <div style={pill(agent.specialty || 'unknown', CATEGORY_COLORS[agent.specialty] || '#888')}>{(agent.specialty || 'unknown').replace('_',' ')}</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{agent.tasks_done}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>tasks done</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>{cusd(agent.total_earned)}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>XLM earned</div>
            </div>
            <a href={`${EXPLORER}/address/${agent.wallet}`} target="_blank" rel="noreferrer"
              style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 10, textDecoration: 'none', textAlign: 'center' }}>↗</a>
          </div>
        ))}
      </div>

      {/* ERC-8004 info */}
      <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', borderLeft: '3px solid var(--accent)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>ERC-8004 reputation model</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          Reputation is tracked on-chain. Tasks with <code style={{ background: 'var(--bg3)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }}>min_rep_score</code> gate which agents can bid.
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
          {[['80+','var(--accent)','Premium tasks'],['60–79','var(--amber)','Standard tasks'],['<60','var(--red)','Entry tasks']].map(([r,c,l]) => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, background: c, borderRadius: 1 }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text2)' }}>{r} {l}</span>
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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: task selector */}
      <div style={{ width: 260, borderRight: '1px solid var(--border)', flexShrink: 0, overflowY: 'auto', background: 'var(--bg2)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between' }}>
          <span>Filter by task</span>
          {selected && <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 10 }}>clear ×</button>}
        </div>
        <div onClick={() => setSelected(null)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: !selected ? 'var(--bg3)' : 'transparent', borderLeft: !selected ? '2px solid var(--accent)' : '2px solid transparent', fontFamily: 'var(--mono)', fontSize: 11, color: !selected ? 'var(--accent)' : 'var(--text2)' }}>
          All bid activity
        </div>
        {taskWithBids.map(t => (
          <div key={t.id} onClick={() => setSelected(t.id)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected === t.id ? 'var(--bg3)' : 'transparent', borderLeft: selected === t.id ? '2px solid var(--accent)' : '2px solid transparent' }}>
            <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{bids.filter(b => b.task_id === t.id).length} bids · {cusd(t.budget_wei)} XLM</div>
          </div>
        ))}
      </div>

      {/* Right: bid timeline */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
          {displayBids.length} bids · auto-refresh 5s
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ position: 'relative', paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
            {displayBids.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map((bid, i) => {
              const meta = BID_STATUS[bid.status] || BID_STATUS.pending
              return (
                <div key={bid.id} style={{ position: 'relative', marginBottom: 16, animation: 'slide-in 0.2s ease', animationDelay: `${i*0.03}s`, animationFillMode: 'both' }}>
                  <div style={{ position: 'absolute', left: -17, top: 10, width: 8, height: 8, borderRadius: '50%', background: meta.color, boxShadow: bid.status === 'winning' ? `0 0 6px ${meta.color}` : 'none' }} />
                  <div style={{ background: 'var(--bg2)', border: `1px solid ${bid.status === 'winning' ? 'var(--accent)30' : 'var(--border)'}`, borderRadius: 'var(--r2)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{bid.bidder_name || shortAddr(bid.bidder_wallet)}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>rep: {bid.rep_score_snap}</span>
                        <span style={pill(meta.label, meta.color)}>{meta.label}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--accent)', fontWeight: 700 }}>{cusd(bid.amount_wei)} XLM</span>
                    </div>
                    {bid.message && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6, fontStyle: 'italic' }}>"{bid.message}"</div>}
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{ago(bid.created_at)}</div>
                  </div>
                </div>
              )
            })}
            {displayBids.length === 0 && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', paddingTop: 20 }}>No bids yet.</div>}
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
    ...tasks.map(t => ({ id: `p-${t.id}`, type: 'task_posted',   desc: t.title,              ts: t.created_at, txHash: t.tx_hash,  addr: t.poster_wallet, value: t.budget_wei })),
    ...bids.map(b  => ({ id: `b-${b.id}`, type: 'bid_submitted', desc: b.bidder_name || shortAddr(b.bidder_wallet), ts: b.created_at, txHash: b.tx_hash, addr: b.bidder_wallet, value: b.amount_wei })),
    ...tasks.filter(t => t.status === 'completed').map(t => ({ id: `s-${t.id}`, type: 'task_settled', desc: t.title, ts: t.updated_at, txHash: t.tx_hash, addr: t.poster_wallet, value: t.budget_wei })),
    ...tasks.filter(t => t.ipfs_cid).map(t => ({ id: `i-${t.id}`, type: 'ipfs_submitted', desc: t.ipfs_cid, ts: t.updated_at, txHash: null, addr: null, value: null })),
  ].sort((a,b) => new Date(b.ts) - new Date(a.ts))

  const filtered = typeFilter === 'all' ? events : events.filter(e => e.type === typeFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Total events',  val: events.length,        color: 'var(--text)'   },
          { label: 'XLM volume',   val: `${cusd(bids.filter(b=>b.status==='paid').reduce((s,b)=>s+BigInt(b.amount_wei||0),0n).toString())}`, color: 'var(--accent)' },
          { label: 'Unique agents', val: [...new Set(bids.map(b=>b.bidder_wallet))].length, color: 'var(--text)' },
          { label: 'IPFS delivers', val: tasks.filter(t=>t.ipfs_cid).length, color: 'var(--blue)' },
        ].map((s,i) => (
          <div key={i} style={{ padding: '14px 20px', borderRight: i<3 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type filters */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        {['all', ...Object.keys(TX_TYPES)].map(type => {
          const meta = TX_TYPES[type]
          return (
            <button key={type} onClick={() => setTypeFilter(type)} style={{
              background: typeFilter === type ? 'var(--bg3)' : 'transparent',
              border: 'none', borderRight: '1px solid var(--border)',
              borderBottom: typeFilter === type ? '2px solid var(--accent)' : '2px solid transparent',
              color: typeFilter === type ? 'var(--accent)' : 'var(--text2)',
              fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
              letterSpacing: '0.08em', padding: '10px 14px', whiteSpace: 'nowrap',
            }}>
              {meta ? meta.label : 'All events'}
            </button>
          )
        })}
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px 130px 130px 70px', padding: '8px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--bg)' }}>
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
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: ev.value ? 'var(--accent)' : 'var(--text3)', fontWeight: ev.value ? 700 : 400 }}>{ev.value ? `${cusd(ev.value)}` : '—'}</span>
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
        <a href={`${EXPLORER}/address/${import.meta.env.VITE_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer"
          style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--blue)', textDecoration: 'none' }}>
          ↗ view contract
        </a>
      </div>
    </div>
  )
}