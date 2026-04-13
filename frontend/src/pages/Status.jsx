import { useState, useEffect } from 'react'

const SERVICES = [
  { name: 'Backend API', url: 'https://agentmarket-backend-phl6.onrender.com/health', type: 'api' },
  { name: 'Agent: DataHunter-1', url: 'https://agent-task-market-agent-1.onrender.com', type: 'agent', specialties: 'data_collection, content_gen' },
  { name: 'Agent: CodeAuditor-1', url: 'https://agent-task-market-agent-2.onrender.com', type: 'agent', specialties: 'code_review, defi_ops' },
]

const S = {
  page: {
    minHeight: '100vh',
    paddingTop: 80,
    padding: '24px',
    background: 'radial-gradient(ellipse at top, rgba(0,229,160,0.05), transparent)',
  },
  container: {
    maxWidth: 800,
    margin: '0 auto',
  },
  title: {
    fontFamily: 'var(--mono)',
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: 700,
    color: 'var(--text)',
    textAlign: 'center',
    marginBottom: 40,
    textShadow: '0 0 40px rgba(0,229,160,0.3)',
  },
  card: {
    background: 'linear-gradient(135deg, rgba(21,27,34,0.8), rgba(15,19,24,0.95))',
    border: '1px solid rgba(30,40,48,0.8)',
    borderRadius: 'var(--r2)',
    padding: '20px 24px',
    marginBottom: 16,
    transition: 'all 0.3s ease',
    boxShadow: '0 0 20px rgba(0,0,0,0.2)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'var(--mono)',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text)',
  },
  cardUrl: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--text3)',
    marginTop: 4,
    wordBreak: 'break-all',
  },
  badge: {
    fontFamily: 'var(--mono)',
    fontSize: 9,
    padding: '4px 10px',
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
  },
  specialties: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--text3)',
    marginTop: 8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    background: 'linear-gradient(135deg, rgba(0,229,160,0.08), rgba(0,212,255,0.05))',
    border: '1px solid rgba(0,229,160,0.2)',
    borderRadius: 'var(--r2)',
    padding: '16px 20px',
    textAlign: 'center',
  },
  statValue: {
    fontFamily: 'var(--mono)',
    fontSize: 28,
    fontWeight: 700,
    background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  lastUpdate: {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    color: 'var(--text3)',
    textAlign: 'center',
    marginTop: 24,
  },
}

function StatusBadge({ status }) {
  const colors = {
    online: { bg: 'rgba(0,229,160,0.15)', color: 'var(--accent)', border: 'rgba(0,229,160,0.4)' },
    offline: { bg: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: 'rgba(239,68,68,0.4)' },
    loading: { bg: 'rgba(245,166,35,0.15)', color: 'var(--amber)', border: 'rgba(245,166,35,0.4)' },
  }
  const color = colors[status] || colors.loading

  return (
    <span style={{
      ...S.badge,
      background: color.bg,
      color: color.color,
      border: `1px solid ${color.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color.color,
        animation: status === 'loading' ? 'pulse-dot 1s infinite' : 'none',
      }} />
      {status}
    </span>
  )
}

export default function Status() {
  const [services, setServices] = useState(
    SERVICES.map(s => ({ ...s, status: 'loading', responseTime: null }))
  )
  const [stats, setStats] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    checkServices()
    const interval = setInterval(checkServices, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  async function checkServices() {
    const results = await Promise.all(
      SERVICES.map(async (service) => {
        const start = Date.now()
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000)
          const res = await fetch(service.url, { signal: controller.signal })
          clearTimeout(timeout)
          const responseTime = Date.now() - start
          return { ...service, status: res.ok ? 'online' : 'offline', responseTime }
        } catch {
          return { ...service, status: 'offline', responseTime: null }
        }
      })
    )
    setServices(results)
    setLastUpdate(new Date())

    // Fetch backend stats
    try {
      const res = await fetch('https://agentmarket-backend-phl6.onrender.com/status')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch (e) {
      console.log('Could not fetch stats')
    }
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <h1 style={S.title}>System Status</h1>

        {/* Stats */}
        {stats && (
          <div style={S.grid}>
            <div style={S.statCard}>
              <div style={S.statValue}>{stats.tasks}</div>
              <div style={S.statLabel}>Total Tasks</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statValue}>{stats.openTasks}</div>
              <div style={S.statLabel}>Open Tasks</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statValue}>{stats.bids}</div>
              <div style={S.statLabel}>Total Bids</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statValue}>{stats.agents}</div>
              <div style={S.statLabel}>Agents</div>
            </div>
          </div>
        )}

        {/* Services */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {services.map((service) => (
            <div
              key={service.url}
              style={{
                ...S.card,
                borderColor: service.status === 'online' ? 'rgba(0,229,160,0.3)' : 'rgba(30,40,48,0.8)',
                boxShadow: service.status === 'online' ? '0 0 30px rgba(0,229,160,0.1)' : 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 30px rgba(0,0,0,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = service.status === 'online' ? '0 0 30px rgba(0,229,160,0.1)' : 'none'
              }}
            >
              <div style={S.cardHeader}>
                <div>
                  <div style={S.cardTitle}>{service.name}</div>
                  <div style={S.cardUrl}>{service.url}</div>
                  {service.specialties && (
                    <div style={S.specialties}>
                      Specializes in: {service.specialties}
                    </div>
                  )}
                </div>
                <StatusBadge status={service.status} />
              </div>
              {service.responseTime && (
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  color: 'var(--text3)',
                  marginTop: 8,
                }}>
                  Response time: {service.responseTime}ms
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={S.lastUpdate}>
          Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Loading...'}
        </div>
      </div>
    </div>
  )
}
