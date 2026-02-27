import { useSimStore } from '../store/simulationStore'
import type { SpeedMultiplier } from '../engine/SimulationEngine'
import { ConfigPanel } from './ConfigPanel'
import { Sparkline } from './MetricsChart'

// ─── Primer anchor URL builder ────────────────────────────────────────────────

const PRIMER_BASE = 'https://github.com/donnemartin/system-design-primer'

const PRIMER_ANCHORS: Record<string, string> = {
  'System design topics: start here': '#system-design-topics-start-here',
  'Database':                          '#database',
  'Cache':                             '#cache',
  'Load balancer':                     '#load-balancer',
  'Availability':                      '#availability-vs-consistency',
  'Asynchronous workflows':            '#asynchronous-workflows',
}

function primerUrl(ref: string): string {
  const anchor = PRIMER_ANCHORS[ref] ?? ''
  return PRIMER_BASE + anchor
}

// ─── HUD top bar ─────────────────────────────────────────────────────────────

export function HUD() {
  const {
    isRunning, speed, start, pause, setSpeed,
    globalMetrics, level, simTimeSec, metricsHistory,
  } = useSimStore()
  const req = level?.requirements

  const p99Ok  = req ? globalMetrics.p99LatencyMs  <= req.maxP99LatencyMs   : true
  const upOk   = req ? globalMetrics.uptimePercent >= req.minUptimePercent   : true
  const costOk = req ? globalMetrics.monthlyCostUsd <= req.maxMonthlyCostUsd : true

  const rpsData = metricsHistory.map(s => s.rps)
  const p99Data = metricsHistory.map(s => s.p99)

  return (
    <div style={{
      height: 56,
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 16,
      flexShrink: 0,
    }}>
      {/* Sim controls */}
      <div style={{ display: 'flex', gap: 6 }}>
        <CtrlButton onClick={isRunning ? pause : start}>
          {isRunning ? '⏸ Pause' : '▶ Run'}
        </CtrlButton>
        {([1, 5, 10] as SpeedMultiplier[]).map(s => (
          <CtrlButton key={s} onClick={() => setSpeed(s)} active={speed === s}>
            {s}×
          </CtrlButton>
        ))}
      </div>

      <div style={{ width: 1, height: 32, background: '#1e293b' }} />

      <Stat label="Time" value={`${simTimeSec.toFixed(0)}s`} ok />

      {/* RPS with sparkline */}
      <StatWithChart
        label="RPS"
        value={String(globalMetrics.throughputRps)}
        ok
        data={rpsData}
        chartColor="#818cf8"
      />

      {/* p99 with sparkline */}
      <StatWithChart
        label="p99"
        value={`${globalMetrics.p99LatencyMs}ms`}
        ok={p99Ok}
        limit={req ? `/ ${req.maxP99LatencyMs}ms` : ''}
        data={p99Data}
        chartColor={p99Ok ? '#22c55e' : '#ef4444'}
      />

      <Stat label="Uptime" value={`${globalMetrics.uptimePercent.toFixed(1)}%`} ok={upOk}
            limit={req ? `/ ${req.minUptimePercent}%` : ''} />
      <Stat label="Cost" value={`$${globalMetrics.monthlyCostUsd}/mo`} ok={costOk}
            limit={req ? `/ $${req.maxMonthlyCostUsd}` : ''} />
    </div>
  )
}

function CtrlButton({ onClick, children, active }: {
  onClick: () => void
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#3730a3' : '#1e293b',
        border: `1px solid ${active ? '#818cf8' : '#334155'}`,
        borderRadius: 6,
        color: '#e2e8f0',
        padding: '4px 12px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  )
}

function Stat({ label, value, ok, limit = '' }: {
  label: string; value: string; ok: boolean; limit?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: ok ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 700 }}>
        {value}
        {limit && <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}> {limit}</span>}
      </span>
    </div>
  )
}

function StatWithChart({ label, value, ok, limit = '', data, chartColor }: {
  label: string; value: string; ok: boolean; limit?: string
  data: number[]; chartColor: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ color: ok ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 700 }}>
          {value}
          {limit && <span style={{ color: '#475569', fontWeight: 400, fontSize: 11 }}> {limit}</span>}
        </span>
      </div>
      <Sparkline data={data} color={chartColor} width={72} height={28} />
    </div>
  )
}

// ─── Right panel: brief + hints + win state ───────────────────────────────────

export function SidePanel() {
  const { level, hintsRevealed, revealNextHint, holdProgress, won, selectedNodeId } = useSimStore()
  if (!level) return null

  const nodeSelected = !!selectedNodeId

  return (
    <div style={{
      width: 280,
      background: '#0f172a',
      borderLeft: '1px solid #1e293b',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflowY: 'auto',
    }}>
      <ConfigPanel />

      {/* Level header */}
      <div>
        <div style={{ color: '#818cf8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
          {level.chapter === 0 ? 'Sandbox' : `Chapter ${level.chapter}`}
        </div>
        <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 700 }}>{level.title}</div>
      </div>

      {!nodeSelected && (
        <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>{level.brief}</div>
      )}

      <RequirementsCard />

      {/* Hold progress */}
      {holdProgress > 0 && !won && (
        <div>
          <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>Holding requirements…</div>
          <div style={{ background: '#1e293b', borderRadius: 4, height: 6 }}>
            <div style={{
              background: '#22c55e',
              width: `${holdProgress * 100}%`,
              height: '100%',
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Win banner */}
      {won && (
        <div style={{
          background: '#14532d',
          border: '1px solid #22c55e',
          borderRadius: 8,
          padding: 12,
        }}>
          <div style={{ color: '#86efac', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            ✅ {level.winMessage}
          </div>
          {level.tradeoffWarning && (
            <div style={{ color: '#fbbf24', fontSize: 12, marginBottom: 8 }}>
              ⚠️ {level.tradeoffWarning}
            </div>
          )}
          {level.primerRef && (
            <a
              href={primerUrl(level.primerRef)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#67e8f9',
                fontSize: 11,
                textDecoration: 'none',
                border: '1px solid #164e63',
                borderRadius: 4,
                padding: '3px 8px',
                background: '#0c4a6e',
              }}
            >
              📖 Read more in system-design-primer ↗
            </a>
          )}
        </div>
      )}

      {/* Hints */}
      {!nodeSelected && (
        <div>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
            Hints
          </div>
          {level.hints.slice(0, hintsRevealed).map((h, i) => (
            <div key={i} style={{
              background: '#1e293b',
              borderRadius: 6,
              padding: '8px 10px',
              color: '#cbd5e1',
              fontSize: 12,
              marginBottom: 6,
              lineHeight: 1.5,
            }}>
              💡 {h}
            </div>
          ))}
          {hintsRevealed < level.hints.length && (
            <button
              onClick={revealNextHint}
              style={{
                background: 'transparent',
                border: '1px dashed #334155',
                borderRadius: 6,
                color: '#475569',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 12,
                width: '100%',
              }}
            >
              Show hint ({level.hints.length - hintsRevealed} left)
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Requirements card ────────────────────────────────────────────────────────

function RequirementsCard() {
  const { level, globalMetrics, isRunning } = useSimStore()
  if (!level) return null
  const req = level.requirements
  const minRps = req.minThroughputRps ?? 1
  const hasTraffic = globalMetrics.throughputRps >= minRps

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: 8,
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
        Requirements
      </div>

      {/* No-traffic warning */}
      {isRunning && !hasTraffic && (
        <div style={{
          background: '#431407',
          border: '1px solid #7c2d12',
          borderRadius: 6,
          padding: '6px 10px',
          color: '#fdba74',
          fontSize: 11,
          lineHeight: 1.5,
        }}>
          ⚠ No traffic is reaching any node. Connect your components and hit Run.
        </div>
      )}

      <ReqRow
        label="Throughput"
        value={`${globalMetrics.throughputRps} RPS`}
        limit={`≥ ${minRps} RPS`}
        ok={hasTraffic}
      />
      <ReqRow
        label="p99 latency"
        value={`${globalMetrics.p99LatencyMs}ms`}
        limit={`≤ ${req.maxP99LatencyMs}ms`}
        ok={globalMetrics.p99LatencyMs <= req.maxP99LatencyMs}
      />
      <ReqRow
        label="Uptime"
        value={`${globalMetrics.uptimePercent.toFixed(1)}%`}
        limit={`≥ ${req.minUptimePercent}%`}
        ok={globalMetrics.uptimePercent >= req.minUptimePercent}
      />
      <ReqRow
        label="Monthly cost"
        value={`$${globalMetrics.monthlyCostUsd}`}
        limit={`≤ $${req.maxMonthlyCostUsd}`}
        ok={globalMetrics.monthlyCostUsd <= req.maxMonthlyCostUsd}
      />
    </div>
  )
}

function ReqRow({ label, value, limit, ok }: {
  label: string; value: string; limit: string; ok: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: ok ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{value}</span>
        <span style={{ color: '#475569', fontSize: 10 }}>{limit}</span>
        <span>{ok ? '✅' : '❌'}</span>
      </div>
    </div>
  )
}
