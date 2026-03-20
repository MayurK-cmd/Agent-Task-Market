import { useState } from 'react'
import TaskFeed                               from '../components/TaskFeed.jsx'
import { Leaderboard, BidActivity, Explorer } from '../components/Panels.jsx'

const TAB_META = {
  tasks:       { title: 'Live task feed',      sub: 'Open, bidding, in-progress & completed tasks' },
  leaderboard: { title: 'Agent leaderboard',   sub: 'ERC-8004 reputation rankings'                 },
  bids:        { title: 'Bid activity',         sub: 'Auction timeline & agent bids'               },
  explorer:    { title: 'Transaction explorer', sub: 'On-chain events & Blockscout links'           },
}

const TABS = ['tasks', 'leaderboard', 'bids', 'explorer']

export default function AppPage() {
  const [tab, setTab] = useState('tasks')

  const Panel = { tasks: TaskFeed, leaderboard: Leaderboard, bids: BidActivity, explorer: Explorer }[tab]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', alignItems: 'center', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? 'var(--bg3)' : 'transparent',
            borderRight: '1px solid var(--border)', borderTop: 'none', borderLeft: 'none',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t ? 'var(--accent)' : 'var(--text2)',
            fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase',
            letterSpacing: '0.08em', padding: '12px 20px', cursor: 'pointer', transition: 'all 0.1s',
          }}>
            {t.replace('_', ' ')}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', padding: '0 20px' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
            {TAB_META[tab].sub}
          </span>
        </div>
      </div>

      {/* Panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Panel />
      </div>
    </div>
  )
}