import { useState } from 'react'
import TaskFeed                               from '../components/TaskFeed.jsx'
import { Leaderboard, BidActivity, Explorer } from '../components/Panels.jsx'

const TAB_META = {
  tasks:       { sub: 'Open, bidding, in-progress & completed tasks', icon: '▦' },
  leaderboard: { sub: 'Marketplace reputation rankings',              icon: '★' },
  bids:        { sub: 'Auction timeline & agent bids',               icon: '↑' },
  explorer:    { sub: 'Stellar events & explorer links',              icon: '⬡' },
}

const TABS = ['tasks', 'leaderboard', 'bids', 'explorer']

export default function AppPage() {
  const [tab, setTab] = useState('tasks')
  const Panel = { tasks: TaskFeed, leaderboard: Leaderboard, bids: BidActivity, explorer: Explorer }[tab]

  return (
    <div style={{
      position: 'fixed',
      top: 64,        /* below navbar */
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,229,160,0.03), transparent 60%)',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', flexShrink: 0,
        borderBottom: '1px solid rgba(30,40,48,0.8)',
        background: 'linear-gradient(180deg, rgba(15,19,24,0.95), rgba(10,12,15,0.98))',
        backdropFilter: 'blur(20px)',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 100,
      }}>
        <div style={{
          display: 'flex',
          padding: '0 20px',
          borderRight: '1px solid rgba(30,40,48,0.8)',
        }}>
          {TABS.map((t, i) => {
            const isActive = tab === t
            const meta = TAB_META[t]
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  background: isActive ? 'rgba(0,229,160,0.1)' : 'transparent',
                  borderRight: i < TABS.length - 1 ? '1px solid rgba(30,40,48,0.6)' : 'none',
                  borderTop: 'none', borderLeft: 'none',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text2)',
                  fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase',
                  letterSpacing: '0.1em', padding: '14px 24px', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', gap: 8,
                  position: 'relative',
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
                  textShadow: isActive ? '0 0 10px rgba(0,229,160,0.5)' : 'none',
                }}>{meta.icon}</span>
                {t.replace('_', ' ')}
                {isActive && (
                  <span style={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 0 8px rgba(0,229,160,0.5)',
                  }} />
                )}
              </button>
            )
          })}
        </div>
        <div style={{ marginLeft: 'auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {TAB_META[tab].sub}
          </span>
        </div>
      </div>

      {/* Panel fills remaining space */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        minHeight: 0,
        background: 'transparent',
      }}>
        <Panel />
      </div>
    </div>
  )
}