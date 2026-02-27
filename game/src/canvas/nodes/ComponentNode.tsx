import { useCallback } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'
import { useSimStore } from '../../store/simulationStore'
import type { NodeConfig } from '../../engine/types'

const NODE_ICONS: Record<string, string> = {
  traffic_source: '🌐',
  load_balancer:  '⚖️',
  web_server:     '🖥️',
  sql_db:         '🗄️',
  nosql_db:       '📦',
  cache:          '⚡',
  cdn:            '🌍',
  message_queue:  '📬',
  worker:         '⚙️',
  rate_limiter:   '🚦',
}

const NODE_LABELS: Record<string, string> = {
  traffic_source: 'Traffic',
  load_balancer:  'Load Balancer',
  web_server:     'Web Server',
  sql_db:         'SQL DB',
  nosql_db:       'NoSQL DB',
  cache:          'Cache',
  cdn:            'CDN',
  message_queue:  'Queue',
  worker:         'Worker',
  rate_limiter:   'Rate Limiter',
}

function statusColor(utilization: number, status: string): string {
  if (status === 'down') return '#ef4444'
  if (utilization > 0.9)  return '#ef4444'
  if (utilization > 0.6)  return '#f59e0b'
  return '#22c55e'
}

interface Props {
  id: string
  data: NodeConfig & { label: string }
  selected: boolean
}

export function ComponentNode({ id, data, selected }: Props) {
  const metrics    = useSimStore(s => s.nodeMetrics.get(data.id))
  const selectNode = useSimStore(s => s.selectNode)
  const isRunning  = useSimStore(s => s.isRunning)
  const level      = useSimStore(s => s.level)
  const { deleteElements } = useReactFlow()

  const util     = metrics?.utilization ?? 0
  const color    = statusColor(util, metrics?.status ?? 'healthy')
  const isSource = data.type === 'traffic_source'
  const isLocked = isSource || !!data.locked

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()   // prevent node selection
    deleteElements({ nodes: [{ id }] })
  }, [id, deleteElements])

  return (
    <div
      onClick={() => selectNode(data.id)}
      style={{
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#818cf8' : color}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 130,
        cursor: 'grab',
        boxShadow: selected ? `0 0 0 3px #818cf820` : undefined,
        transition: 'border-color 0.3s',
        position: 'relative',
      }}
    >
      {/* Delete button — top-right, hidden unless selected and not running */}
      {selected && !isLocked && !isRunning && (
        <button
          onClick={handleDelete}
          title="Remove node (or press Delete)"
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#ef4444',
            border: 'none',
            color: '#fff',
            fontSize: 10,
            lineHeight: '18px',
            textAlign: 'center',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          ✕
        </button>
      )}

      {/* Target handle (left) */}
      {!isSource && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: '#818cf8', width: 10, height: 10 }}
        />
      )}

      {/* Node header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{NODE_ICONS[data.type] ?? '📦'}</span>
        <div>
          <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>
            {NODE_LABELS[data.type] ?? data.type}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' }}>
            {isSource ? '' : data.tier}
          </div>
        </div>
      </div>

      {/* Metrics strip */}
      {metrics && !isSource && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <MetricRow label="util"  value={`${(util * 100).toFixed(0)}%`} color={color} />
          <MetricRow label="lat"   value={`${metrics.latencyMs.toFixed(0)}ms`} color="#94a3b8" />
          {metrics.queueDepth > 0 && (
            <MetricRow label="queue" value={String(metrics.queueDepth)} color="#f59e0b" />
          )}
        </div>
      )}

      {/* Traffic source RPS badge */}
      {isSource && (
        <div style={{ color: '#22c55e', fontSize: 11, marginTop: 4 }}>
          {level?.traffic.baseRps ?? 0} rps
        </div>
      )}

      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#818cf8', width: 10, height: 10 }}
      />
    </div>
  )
}

function MetricRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}
