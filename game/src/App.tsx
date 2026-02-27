import { useEffect, useRef, useState } from 'react'
import { useSimStore } from './store/simulationStore'
import { GameCanvas, Toolbar } from './canvas/GameCanvas'
import { HUD, SidePanel } from './ui/HUD'
import { ChapterMap } from './ui/ChapterMap'
import type { MapLevel } from './ui/ChapterMap'
import { saveProgress } from './store/progress'
import { levelDemo } from './levels/level-demo'
import { level01 }   from './levels/level-01'
import { level02 }   from './levels/level-02'
import { level03 }   from './levels/level-03'
import { level04 }   from './levels/level-04'
import { level05 }   from './levels/level-05'
import { level06 }   from './levels/level-06'
import { level07 }   from './levels/level-07'
import { level08 }   from './levels/level-08'
import type { CanvasNode } from './store/simulationStore'
import type { GraphEdge, LevelDefinition } from './engine/types'

// ─── Per-level canvas layouts ─────────────────────────────────────────────────

interface LevelLayout {
  level: LevelDefinition
  nodes: CanvasNode[]
  edges: GraphEdge[]
}

function cn(id: string, type: CanvasNode['data']['type'], tier: CanvasNode['data']['tier'],
            x: number, y: number, label: string, extra?: Partial<CanvasNode['data']>): CanvasNode {
  return {
    id,
    type: 'componentNode',
    position: { x, y },
    data: { id, type, tier, label, ...extra },
  }
}

function ed(src: string, tgt: string): GraphEdge {
  return { id: `${src}->${tgt}`, sourceNodeId: src, targetNodeId: tgt }
}

// ── Demo ──────────────────────────────────────────────────────────────────────
const DEMO: LevelLayout = {
  level: levelDemo,
  nodes: [
    cn('src',   'traffic_source', 'small',  60,  240, 'Traffic'),
    cn('lb',    'load_balancer',  'small',  280, 240, 'Load Balancer',  { algorithm: 'round_robin', monthlyCostUsd: 20 }),
    cn('web1',  'web_server',     'small',  500, 100, 'Web Server 1',  { monthlyCostUsd: 50 }),
    cn('web2',  'web_server',     'small',  500, 380, 'Web Server 2',  { monthlyCostUsd: 50 }),
    cn('cache', 'cache',          'medium', 720, 240, 'Cache (8 GB)',   { monthlyCostUsd: 100 }),
    cn('db',    'sql_db',         'small',  940, 240, 'SQL DB',         { monthlyCostUsd: 100 }),
  ],
  edges: [
    ed('src','lb'), ed('lb','web1'), ed('lb','web2'),
    ed('web1','cache'), ed('web2','cache'), ed('cache','db'),
  ],
}

// ── Level 1 ───────────────────────────────────────────────────────────────────
const L1: LevelLayout = {
  level: level01,
  nodes: [
    cn('src', 'traffic_source', 'small', 80, 260, 'Traffic', { locked: true }),
  ],
  edges: [],
}

// ── Level 2 ───────────────────────────────────────────────────────────────────
const L2: LevelLayout = {
  level: level02,
  nodes: [
    cn('src',  'traffic_source', 'small',  80,  260, 'Traffic',    { locked: true }),
    cn('web',  'web_server',     'medium', 340, 260, 'Web Server', { locked: true, monthlyCostUsd: 150 }),
    cn('db',   'sql_db',         'small',  600, 260, 'SQL DB',     { monthlyCostUsd: 100 }),
  ],
  edges: [ed('src','web'), ed('web','db')],
}

// ── Level 3 ───────────────────────────────────────────────────────────────────
const L3: LevelLayout = {
  level: level03,
  nodes: [
    cn('src',  'traffic_source', 'small',  80,  260, 'Traffic',    { locked: true }),
    cn('web',  'web_server',     'medium', 340, 260, 'Web Server', { locked: true, monthlyCostUsd: 150 }),
    cn('db',   'sql_db',         'large',  600, 260, 'SQL DB',     { monthlyCostUsd: 800 }),
  ],
  edges: [ed('src','web'), ed('web','db')],
}

// ── Level 4 ───────────────────────────────────────────────────────────────────
const L4: LevelLayout = {
  level: level04,
  nodes: [
    cn('src', 'traffic_source', 'small',  80,  260, 'Traffic', { locked: true }),
    cn('db',  'sql_db',         'medium', 800, 260, 'SQL DB',  { locked: true, monthlyCostUsd: 300 }),
  ],
  edges: [],
}

// ── Level 5 ───────────────────────────────────────────────────────────────────
const L5: LevelLayout = {
  level: level05,
  nodes: [
    cn('src',  'traffic_source', 'small',  60,  260, 'Traffic',      { locked: true }),
    cn('lb',   'load_balancer',  'small',  250, 260, 'Load Balancer',{ locked: true, algorithm: 'round_robin', monthlyCostUsd: 20 }),
    cn('web',  'web_server',     'medium', 440, 260, 'Web Server',   { locked: true, monthlyCostUsd: 150 }),
    cn('db',   'sql_db',         'small',  800, 260, 'SQL DB',       { locked: true, monthlyCostUsd: 100 }),
  ],
  edges: [ed('src','lb'), ed('lb','web'), ed('web','db')],
}

// ── Level 6 ───────────────────────────────────────────────────────────────────
const L6: LevelLayout = {
  level: level06,
  nodes: [
    cn('web1', 'web_server',     'medium', 350, 260, 'Web Server 1', { locked: true, monthlyCostUsd: 150 }),
    cn('src',  'traffic_source', 'small',  80,  260, 'Traffic',      { locked: true }),
    cn('db',   'sql_db',         'small',  620, 260, 'SQL DB',       { locked: true, monthlyCostUsd: 100 }),
  ],
  edges: [],
}

// ── Level 7 ───────────────────────────────────────────────────────────────────
const L7: LevelLayout = {
  level: level07,
  nodes: [
    cn('src',  'traffic_source', 'small', 60,  260, 'Traffic',      { locked: true }),
    cn('lb',   'load_balancer',  'small', 240, 260, 'Load Balancer',{ locked: true, algorithm: 'round_robin', monthlyCostUsd: 20 }),
    cn('web1', 'web_server',     'small', 420, 140, 'Web Server 1', { locked: true, monthlyCostUsd: 50 }),
    cn('web2', 'web_server',     'small', 420, 380, 'Web Server 2', { locked: true, monthlyCostUsd: 50 }),
    cn('db',   'sql_db',         'small', 760, 260, 'SQL DB',       { locked: true, monthlyCostUsd: 100 }),
  ],
  edges: [],
}

// ── Level 8 ───────────────────────────────────────────────────────────────────
const L8: LevelLayout = {
  level: level08,
  nodes: [
    cn('src',  'traffic_source', 'small',  60,  260, 'Traffic',      { locked: true }),
    cn('lb',   'load_balancer',  'small',  240, 260, 'Load Balancer',{ locked: true, algorithm: 'round_robin', monthlyCostUsd: 20 }),
    cn('web1', 'web_server',     'small',  420, 140, 'Web Server 1', { locked: true, monthlyCostUsd: 50 }),
    cn('web2', 'web_server',     'small',  420, 380, 'Web Server 2', { locked: true, monthlyCostUsd: 50 }),
    cn('mq',   'message_queue',  'medium', 650, 260, 'Message Queue',{ locked: true, monthlyCostUsd: 80 }),
  ],
  edges: [],
}

// ─── Level registry ───────────────────────────────────────────────────────────

type LevelId = 'demo' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7' | 'l8'

const LEVELS: Array<{ id: LevelId; label: string; chapter: string; layout: LevelLayout }> = [
  { id: 'demo', label: 'Demo',   chapter: '0',  layout: DEMO },
  { id: 'l1',   label: '1',      chapter: '1',  layout: L1   },
  { id: 'l2',   label: '2',      chapter: '1',  layout: L2   },
  { id: 'l3',   label: '3',      chapter: '1',  layout: L3   },
  { id: 'l4',   label: '4',      chapter: '2',  layout: L4   },
  { id: 'l5',   label: '5',      chapter: '2',  layout: L5   },
  { id: 'l6',   label: '6',      chapter: '2',  layout: L6   },
  { id: 'l7',   label: '7',      chapter: '3',  layout: L7   },
  { id: 'l8',   label: '8',      chapter: '3',  layout: L8   },
]

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { loadLevel, setCanvasNodes, setCanvasEdges, pause, won, hintsRevealed, simTimeSec } = useSimStore()
  const [activeId, setActiveId] = useState<LevelId>('demo')
  const [showMap, setShowMap] = useState(false)

  const active = LEVELS.find(l => l.id === activeId)!

  // ── Load level when selection changes ───────────────────────────────────────
  useEffect(() => {
    pause()
    setCanvasNodes(active.layout.nodes)
    setCanvasEdges(active.layout.edges)
    loadLevel(active.layout.level)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // ── Save progress when player wins ──────────────────────────────────────────
  const prevWon = useRef(false)
  useEffect(() => {
    if (won && !prevWon.current && activeId !== 'demo') {
      prevWon.current = true
      saveProgress(activeId, { won: true, hintsUsed: hintsRevealed, simTimeSec })
    }
    if (!won) prevWon.current = false
  }, [won, activeId, hintsRevealed, simTimeSec])

  // ── Map level descriptors ────────────────────────────────────────────────────
  const mapLevels: MapLevel[] = LEVELS.map(l => ({
    id: l.id,
    label: l.label,
    title: l.layout.level.title,
    chapter: l.chapter,
    chapterLabel: { '0': 'Sandbox', '1': 'Chapter 1 · Basics', '2': 'Chapter 2 · Scale', '3': 'Chapter 3 · Async' }[l.chapter] ?? `Chapter ${l.chapter}`,
    brief: l.layout.level.brief,
  }))

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0f172a',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    }}>
      {/* Level selector bar */}
      <LevelBar activeId={activeId} onSelect={setActiveId} onOpenMap={() => setShowMap(true)} />

      {/* Sim controls + metrics */}
      <HUD />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Toolbar />
        <div style={{ flex: 1 }}>
          {/* key forces React Flow to remount fresh when level changes */}
          <GameCanvas
            key={activeId}
            initialNodes={active.layout.nodes}
            initialEdges={active.layout.edges}
          />
        </div>
        <SidePanel />
      </div>

      {/* Chapter map overlay */}
      {showMap && (
        <ChapterMap
          levels={mapLevels}
          activeId={activeId}
          onSelect={id => setActiveId(id as LevelId)}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  )
}

// ─── Level selector bar ───────────────────────────────────────────────────────

function LevelBar({ activeId, onSelect, onOpenMap }: {
  activeId: LevelId
  onSelect: (id: LevelId) => void
  onOpenMap: () => void
}) {
  const progress = (() => { try { return JSON.parse(localStorage.getItem('sysdesign-progress-v1') ?? '{}') } catch { return {} } })()

  const chapters = ['0', '1', '2', '3']
  const chapterLabels: Record<string, string> = {
    '0': 'Sandbox',
    '1': 'Ch 1 · Basics',
    '2': 'Ch 2 · Scale',
    '3': 'Ch 3 · Async',
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '5px 14px',
      background: '#020617',
      borderBottom: '1px solid #0f172a',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {/* Map button */}
      <button
        onClick={onOpenMap}
        title="Open chapter map"
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 5,
          color: '#94a3b8',
          padding: '3px 10px',
          cursor: 'pointer',
          fontSize: 11,
          marginRight: 12,
          flexShrink: 0,
        }}
      >
        🗺 Map
      </button>

      {chapters.map(ch => {
        const items = LEVELS.filter(l => l.chapter === ch)
        if (items.length === 0) return null
        return (
          <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 3, marginRight: 10 }}>
            <span style={{ color: '#334155', fontSize: 10, marginRight: 4, whiteSpace: 'nowrap' }}>
              {chapterLabels[ch]}
            </span>
            {items.map(l => {
              const won = progress[l.id]?.won
              return (
                <button
                  key={l.id}
                  onClick={() => onSelect(l.id)}
                  title={l.layout.level.title}
                  style={{
                    background: activeId === l.id ? '#1e3a5f' : 'transparent',
                    border: `1px solid ${activeId === l.id ? '#3b82f6' : won ? '#166534' : '#1e293b'}`,
                    borderRadius: 5,
                    color: activeId === l.id ? '#93c5fd' : won ? '#4ade80' : '#475569',
                    padding: '3px 9px',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: activeId === l.id ? 700 : 400,
                    minWidth: 32,
                  }}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
