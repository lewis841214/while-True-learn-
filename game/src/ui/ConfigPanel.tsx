import { useSimStore } from '../store/simulationStore'
import type { NodeConfig, Tier } from '../engine/types'

// ─── Static lookup tables ─────────────────────────────────────────────────────

const TIER_COSTS: Partial<Record<string, [number, number, number]>> = {
  web_server:     [50,  150, 400],
  sql_db:         [100, 300, 800],
  load_balancer:  [20,  60,  150],
  cache:          [30,  100, 300],
  message_queue:  [30,  80,  200],
  worker:         [50,  150, 400],
}

const TIER_SPECS: Partial<Record<string, Array<{ label: string; values: [string, string, string] }>>> = {
  web_server:    [{ label: 'Capacity',   values: ['500 RPS',   '2,000 RPS',   '8,000 RPS'] }],
  sql_db:        [
    { label: 'Read cap',  values: ['2,000 RPS',  '10,000 RPS',  '50,000 RPS'] },
    { label: 'Write cap', values: ['500 RPS',    '2,000 RPS',   '10,000 RPS'] },
  ],
  load_balancer: [{ label: 'Capacity',   values: ['1,000 RPS', '10,000 RPS', '100,000 RPS'] }],
  cache:         [{ label: 'Memory',     values: ['1 GB',      '8 GB',       '64 GB'] }],
  message_queue: [
    { label: 'Throughput', values: ['200 RPS',  '500 RPS',  '2,000 RPS'] },
    { label: 'Buffer',     values: ['20k items', '100k items', '500k items'] },
  ],
  worker:        [{ label: 'Capacity',   values: ['300 RPS',   '1,000 RPS',  '5,000 RPS'] }],
}

const LB_ALGORITHMS: Array<{ id: string; label: string }> = [
  { id: 'round_robin',       label: 'Round Robin' },
  { id: 'least_connections', label: 'Least Connections' },
  { id: 'ip_hash',           label: 'IP Hash' },
]

const NODE_ICONS: Record<string, string> = {
  traffic_source: '🌐', load_balancer: '⚖️', web_server: '🖥️',
  sql_db: '🗄️', nosql_db: '📦', cache: '⚡', cdn: '🌍',
  message_queue: '📬', worker: '⚙️', rate_limiter: '🚦',
}

const NODE_LABELS: Record<string, string> = {
  traffic_source: 'Traffic Source', load_balancer: 'Load Balancer',
  web_server: 'Web Server',         sql_db: 'SQL Database',
  nosql_db: 'NoSQL Database',       cache: 'Cache',
  cdn: 'CDN',                       message_queue: 'Message Queue',
  worker: 'Worker',                 rate_limiter: 'Rate Limiter',
}

const TIER_IDX: Record<Tier, 0 | 1 | 2> = { small: 0, medium: 1, large: 2 }
const TIER_DEFS: Array<{ id: Tier; label: string }> = [
  { id: 'small',  label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large',  label: 'Large' },
]

// ─── ConfigPanel ──────────────────────────────────────────────────────────────

export function ConfigPanel() {
  const selectedId       = useSimStore(s => s.selectedNodeId)
  const canvasNodes      = useSimStore(s => s.canvasNodes)
  const nodeMetrics      = useSimStore(s => s.nodeMetrics)
  const updateNodeConfig = useSimStore(s => s.updateNodeConfig)
  const selectNode       = useSimStore(s => s.selectNode)
  const isRunning        = useSimStore(s => s.isRunning)

  if (!selectedId) return null
  const node = canvasNodes.find(n => n.id === selectedId)
  if (!node) return null

  const { data }    = node
  const metrics     = nodeMetrics.get(selectedId)
  const tierCosts   = TIER_COSTS[data.type]
  const tierSpecs   = TIER_SPECS[data.type]
  const isSource    = data.type === 'traffic_source'
  const isLocked    = isSource || !!data.locked
  const showTier    = !isSource && !!tierCosts
  const showLBAlgo  = data.type === 'load_balancer'
  const idx         = TIER_IDX[data.tier]

  const setTier = (tier: Tier) => {
    if (!tierCosts) return
    updateNodeConfig(selectedId, { tier, monthlyCostUsd: tierCosts[TIER_IDX[tier]] })
  }

  return (
    <div style={{
      background: '#0c1220',
      border: '1px solid #1e293b',
      borderRadius: 8,
      padding: 14,
      marginBottom: 12,
    }}>
      {/* Node identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22 }}>{NODE_ICONS[data.type] ?? '📦'}</span>
        <div>
          <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 700 }}>
            {NODE_LABELS[data.type] ?? data.type}
          </div>
          <div style={{ color: '#475569', fontSize: 10, fontFamily: 'inherit' }}>
            ID: {data.id}
          </div>
          {isLocked && (
            <div style={{ fontSize: 9, color: '#f59e0b', background: '#451a03', border: '1px solid #92400e', borderRadius: 4, padding: '1px 6px', marginTop: 2, display: 'inline-block' }}>
              🔒 locked
            </div>
          )}
        </div>
        <button
          onClick={() => selectNode(null)}
          title="Deselect"
          style={{
            marginLeft: 'auto', background: 'transparent', border: 'none',
            color: '#334155', cursor: 'pointer', fontSize: 14, padding: 2,
          }}
        >✕</button>
      </div>

      {/* Tier selector */}
      {showTier && (
        <Section label={
          isRunning
            ? 'Tier  ·  changes pause the sim'
            : 'Tier  ·  takes effect on next Run'
        }>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {TIER_DEFS.map((t, i) => {
              const active = data.tier === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTier(t.id)}
                  style={{
                    flex: 1, padding: '7px 2px',
                    background: active ? '#1e3a5f' : '#1e293b',
                    border: `1px solid ${active ? '#3b82f6' : '#334155'}`,
                    borderRadius: 6, cursor: 'pointer',
                    color: active ? '#93c5fd' : '#64748b',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: active ? '#60a5fa' : '#475569', marginTop: 1 }}>
                    ${tierCosts![i]}/mo
                  </div>
                </button>
              )
            })}
          </div>

          {/* Spec rows for currently selected tier */}
          {tierSpecs && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {tierSpecs.map(spec => (
                <div key={spec.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: '#475569' }}>{spec.label}</span>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>{spec.values[idx]}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* LB Algorithm selector */}
      {showLBAlgo && (
        <Section label="Algorithm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {LB_ALGORITHMS.map(a => {
              const active = (data.algorithm ?? 'round_robin') === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => updateNodeConfig(selectedId, { algorithm: a.id as NodeConfig['algorithm'] })}
                  style={{
                    background: active ? '#1e3a5f' : 'transparent',
                    border: `1px solid ${active ? '#3b82f6' : '#1e293b'}`,
                    borderRadius: 5, padding: '5px 8px',
                    cursor: 'pointer', textAlign: 'left', fontSize: 11,
                    color: active ? '#93c5fd' : '#64748b',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span style={{ marginRight: 6, opacity: 0.6 }}>{active ? '●' : '○'}</span>
                  {a.label}
                </button>
              )
            })}
          </div>
        </Section>
      )}

      {/* Live metrics */}
      {metrics && !isSource && (
        <Section label="Live Metrics">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
            <MetricCell
              label="Utilization"
              value={`${(metrics.utilization * 100).toFixed(1)}%`}
              color={metrics.utilization > 0.9 ? '#ef4444' : metrics.utilization > 0.6 ? '#f59e0b' : '#22c55e'}
            />
            <MetricCell label="Latency" value={`${metrics.latencyMs.toFixed(0)}ms`} color="#94a3b8" />
            <MetricCell
              label="Served" value={metrics.requestsProcessed.toLocaleString()} color="#94a3b8"
            />
            <MetricCell
              label="Dropped"
              value={metrics.requestsDropped.toLocaleString()}
              color={metrics.requestsDropped > 0 ? '#ef4444' : '#22c55e'}
            />
            {metrics.queueDepth > 0 && (
              <MetricCell label="Queue" value={String(metrics.queueDepth)} color="#f59e0b" />
            )}
          </div>
        </Section>
      )}

      {/* Traffic source — just show RPS from level */}
      {isSource && (
        <Section label="Status">
          <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 700 }}>
            Generating traffic
          </div>
          <div style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>
            Rate defined by level
          </div>
        </Section>
      )}
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#475569', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ color: '#334155', fontSize: 9, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color, fontSize: 12, fontWeight: 700 }}>{value}</div>
    </div>
  )
}
