import { useState }            from 'react'
import { WalletProvider }      from './hooks/useWallet.jsx'
import Header                  from './components/Header.jsx'
import TaskFeed                from './components/TaskFeed.jsx'
import { Leaderboard, BidActivity, Explorer } from './components/Panels.jsx'

const TAB_META = {
  tasks:       { title: 'Live task feed',      sub: 'Open, bidding, in-progress & completed tasks' },
  leaderboard: { title: 'Agent leaderboard',   sub: 'ERC-8004 reputation rankings'                 },
  bids:        { title: 'Bid activity',         sub: 'Auction timeline & agent bids'               },
  explorer:    { title: 'Transaction explorer', sub: 'On-chain events & Blockscout links'           },
}

function App() {
  const [tab, setTab] = useState('tasks')

  const Panel = {
    tasks:       TaskFeed,
    leaderboard: Leaderboard,
    bids:        BidActivity,
    explorer:    Explorer,
  }[tab]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header activeTab={tab} onTabChange={setTab} />

      {/* Panel label bar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {TAB_META[tab].title}
        </h1>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>
          {TAB_META[tab].sub}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Panel />
      </div>
    </div>
  )
}

export default function Root() {
  return (
    <WalletProvider>
      <App />
    </WalletProvider>
  )
}