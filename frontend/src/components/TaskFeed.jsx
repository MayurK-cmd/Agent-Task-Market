import { useState } from 'react'
import { useTasks }  from '../hooks/useMarketPlace.js'
import { useWallet } from '../hooks/useWallet.jsx'
import { CATEGORY_COLORS, STATUS_COLORS, EXPLORER, shortAddr, ago, timeLeft, cusd } from '../lib/config.js'
import PostTask from './PostTask.jsx'

const FILTERS = ['all','open','bidding','in_progress','completed','disputed']

const pill = (label, color) => ({
  display: 'inline-flex', alignItems: 'center',
  background: color + '18', color, border: `1px solid ${color}40`,
  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em',
  padding: '2px 7px', borderRadius: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
})

export default function TaskFeed() {
  const [filter,      setFilter]      = useState('all')
  const [showPost,    setShowPost]    = useState(false)
  const { tasks, loading, refetch }   = useTasks(filter)
  const { wallet }                    = useWallet()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? 'var(--bg3)' : 'transparent',
            borderRight: '1px solid var(--border)', borderTop: 'none', borderLeft: 'none',
            borderBottom: filter === f ? '2px solid var(--accent)' : '2px solid transparent',
            color: filter === f ? 'var(--accent)' : 'var(--text2)',
            fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
            letterSpacing: '0.08em', padding: '10px 16px', transition: 'all 0.1s',
          }}>
            {f.replace('_',' ')}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
          {loading && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', animation: 'pulse-dot 1s infinite' }} />}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
            {tasks.length} tasks
          </span>

          {/* Post task button */}
          <button onClick={() => setShowPost(true)} style={{
            background: wallet ? 'var(--accent)' : 'var(--bg3)',
            border: wallet ? 'none' : '1px solid var(--border2)',
            color: wallet ? '#000' : 'var(--text3)',
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
            padding: '5px 14px', borderRadius: 'var(--r)', letterSpacing: '0.06em',
          }}>
            {wallet ? '+ post task' : 'connect to post'}
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 110px 90px 80px 70px 80px 60px',
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--bg)',
      }}>
        <span>Task</span><span>Category</span><span>Budget</span>
        <span>Status</span><span>Bids</span><span>Deadline</span><span>Tx</span>
      </div>

      {/* Rows */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {tasks.length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>
            No tasks found. {wallet ? 'Post the first one!' : 'Connect wallet to post a task.'}
          </div>
        )}
        {tasks.map((t, i) => (
          <div key={t.id} style={{
            display: 'grid', gridTemplateColumns: '2fr 110px 90px 80px 70px 80px 60px',
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            alignItems: 'center', gap: 4,
            background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg2)',
            animation: 'slide-in 0.2s ease', transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
          onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg)' : 'var(--bg2)'}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                {shortAddr(t.poster_wallet)} · {ago(t.created_at)}
              </div>
            </div>
            <div><span style={pill(t.category.replace('_',' '), CATEGORY_COLORS[t.category] || '#888')}>{t.category.replace('_',' ')}</span></div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{cusd(t.budget_wei)} CELO</span>
            <div><span style={pill(t.status, STATUS_COLORS[t.status] || '#888')}>{t.status.replace('_',' ')}</span></div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: t.bid_count > 0 ? 'var(--text)' : 'var(--text3)' }}>
              {t.bid_count > 0 ? `${t.bid_count}` : '—'}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: timeLeft(t.deadline) === 'expired' ? 'var(--red)' : 'var(--text2)' }}>
              {timeLeft(t.deadline)}
            </span>
            {t.tx_hash ? (
              <a href={`${EXPLORER}/tx/${t.tx_hash}`} target="_blank" rel="noreferrer"
                style={{ color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 10, textDecoration: 'none' }}>
                ↗ tx
              </a>
            ) : <span style={{ color: 'var(--text3)', fontFamily: 'var(--mono)', fontSize: 10 }}>—</span>}
          </div>
        ))}
      </div>

      {showPost && <PostTask onClose={() => setShowPost(false)} onSuccess={refetch} />}
    </div>
  )
}