import { create } from 'zustand'
import { SimulationEngine } from '../engine/SimulationEngine'
import type { EngineSnapshot, SpeedMultiplier } from '../engine/SimulationEngine'
import type {
  AnimationEvent,
  GlobalMetrics,
  GraphEdge,
  LevelDefinition,
  NodeConfig,
  NodeMetrics,
} from '../engine/types'

// ─── Graph node (React Flow visual node) ─────────────────────────────────────

export interface CanvasNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: NodeConfig & { label: string }
}

// ─── Metrics history sample (1 per sim-second) ───────────────────────────────

export interface MetricSample {
  time: number    // sim-time seconds
  rps: number
  p99: number
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface SimState {
  engine: SimulationEngine

  canvasNodes: CanvasNode[]
  canvasEdges: GraphEdge[]
  setCanvasNodes: (nodes: CanvasNode[]) => void
  setCanvasEdges: (edges: GraphEdge[]) => void
  updateNodeConfig: (id: string, patch: Partial<NodeConfig>) => void

  isRunning: boolean
  speed: SpeedMultiplier
  start: () => void
  pause: () => void
  setSpeed: (s: SpeedMultiplier) => void

  level: LevelDefinition | null
  loadLevel: (level: LevelDefinition) => void

  nodeMetrics: Map<string, NodeMetrics>
  globalMetrics: GlobalMetrics
  simTimeSec: number
  holdProgress: number
  won: boolean

  // Packet animation events emitted this snapshot frame
  animationEvents: AnimationEvent[]

  // Rolling 60-sample history for sparklines (sampled every 1 sim-second)
  metricsHistory: MetricSample[]

  selectedNodeId: string | null
  selectNode: (id: string | null) => void

  hintsRevealed: number
  revealNextHint: () => void
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_GLOBAL: GlobalMetrics = {
  throughputRps: 0,
  p99LatencyMs: 0,
  errorRate: 0,
  uptimePercent: 100,
  monthlyCostUsd: 0,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSimStore = create<SimState>((set, get) => {
  const engine = new SimulationEngine()

  engine.setSnapshotCallback((snap: EngineSnapshot) => {
    set(state => {
      // Sample metrics history once per sim-second
      const lastSample = state.metricsHistory[state.metricsHistory.length - 1]
      const shouldSample = !lastSample || snap.simTimeSec - lastSample.time >= 1.0
      const metricsHistory = shouldSample
        ? [
            ...state.metricsHistory.slice(-59),
            { time: snap.simTimeSec, rps: snap.globalMetrics.throughputRps, p99: snap.globalMetrics.p99LatencyMs },
          ]
        : state.metricsHistory

      return {
        nodeMetrics: snap.nodeMetrics,
        globalMetrics: snap.globalMetrics,
        simTimeSec: snap.simTimeSec,
        holdProgress: snap.holdProgress,
        won: snap.won,
        animationEvents: snap.animationEvents,
        metricsHistory,
      }
    })
  })

  return {
    engine,
    canvasNodes: [],
    canvasEdges: [],
    isRunning: false,
    speed: 1,
    level: null,
    nodeMetrics: new Map(),
    globalMetrics: DEFAULT_GLOBAL,
    simTimeSec: 0,
    holdProgress: 0,
    won: false,
    animationEvents: [],
    metricsHistory: [],
    selectedNodeId: null,
    hintsRevealed: 0,

    setCanvasNodes: (nodes) => set({ canvasNodes: nodes }),
    setCanvasEdges: (edges) => set({ canvasEdges: edges }),

    updateNodeConfig: (id, patch) => {
      const { canvasNodes, isRunning, pause } = get()
      if (isRunning) pause()
      set({
        canvasNodes: canvasNodes.map(n =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
        ),
      })
    },

    loadLevel: (level) => {
      const { engine, canvasNodes, canvasEdges } = get()
      const nodeCfgs: NodeConfig[] = canvasNodes.map(n => n.data)
      engine.loadLevel(level, nodeCfgs, canvasEdges)
      set({
        level,
        won: false,
        holdProgress: 0,
        hintsRevealed: 0,
        isRunning: false,
        animationEvents: [],
        metricsHistory: [],
      })
    },

    start: () => {
      const { engine, level, canvasNodes, canvasEdges } = get()
      if (!level) return
      const nodeCfgs: NodeConfig[] = canvasNodes.map(n => n.data)
      engine.loadLevel(level, nodeCfgs, canvasEdges)
      engine.start()
      set({ isRunning: true })
    },

    pause: () => {
      get().engine.pause()
      set({ isRunning: false })
    },

    setSpeed: (s) => {
      get().engine.setSpeed(s)
      set({ speed: s })
    },

    selectNode: (id) => set({ selectedNodeId: id }),

    revealNextHint: () => {
      const { hintsRevealed, level } = get()
      const max = level?.hints.length ?? 0
      if (hintsRevealed < max) set({ hintsRevealed: hintsRevealed + 1 })
    },
  }
})
