import { EventQueue } from './EventQueue'
import { TrafficSource } from './nodes/TrafficSource'
import { WebServer } from './nodes/WebServer'
import { SqlDatabase } from './nodes/SqlDatabase'
import { Cache } from './nodes/Cache'
import { LoadBalancer } from './nodes/LoadBalancer'
import { RateLimiter } from './nodes/RateLimiter'
import { MessageQueue } from './nodes/MessageQueue'
import { Worker } from './nodes/Worker'
import type {
  AnimationEvent,
  GlobalMetrics,
  GraphEdge,
  LevelDefinition,
  NodeConfig,
  NodeMetrics,
  SimNode,
} from './types'

const ANIMATION_SPEED_MS = 600   // how long a packet travels along an edge (real-time ms)

export type SpeedMultiplier = 0 | 1 | 5 | 10

export interface EngineSnapshot {
  nodeMetrics: Map<string, NodeMetrics>
  globalMetrics: GlobalMetrics
  animationEvents: AnimationEvent[]
  simTimeSec: number
  requirementsMet: boolean
  holdProgress: number    // 0–1, how far through hold_duration we are
  won: boolean
}

export class SimulationEngine {
  private queue = new EventQueue()
  private nodes = new Map<string, SimNode>()
  private trafficSource: TrafficSource | null = null

  private simClock = 0          // sim-time in ms
  private realClock = 0         // real-time ms (for animation)
  private speed: SpeedMultiplier = 1
  private running = false
  private rafHandle = 0

  private level: LevelDefinition | null = null
  private latencySamples: number[] = []
  private totalRequests = 0
  private droppedRequests = 0
  private uptimeChecks = { ok: 0, total: 0 }
  private holdTimer = 0         // how many ms requirements have held consecutively
  private won = false

  private pendingAnimations: AnimationEvent[] = []
  private onSnapshot: ((snap: EngineSnapshot) => void) | null = null

  // ─── Public API ────────────────────────────────────────────────────────────

  setSnapshotCallback(cb: (snap: EngineSnapshot) => void): void {
    this.onSnapshot = cb
  }

  loadLevel(level: LevelDefinition, nodes: NodeConfig[], edges: GraphEdge[]): void {
    this.stop()
    this.reset()
    this.level = level

    // Wire downstream node IDs from edges
    const downstreamMap = new Map<string, string[]>()
    for (const edge of edges) {
      const list = downstreamMap.get(edge.sourceNodeId) ?? []
      list.push(edge.targetNodeId)
      downstreamMap.set(edge.sourceNodeId, list)
    }

    for (const cfg of nodes) {
      const fullCfg = { ...cfg, downstreamNodeIds: downstreamMap.get(cfg.id) ?? [] }
      const node = this.createNode(fullCfg, level)
      this.nodes.set(cfg.id, node)
      if (cfg.type === 'traffic_source') {
        this.trafficSource = node as TrafficSource
      }
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.realClock = performance.now()
    this.loop()
  }

  stop(): void {
    this.running = false
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.rafHandle)
  }

  setSpeed(s: SpeedMultiplier): void { this.speed = s }

  pause(): void  { this.stop() }
  resume(): void { this.start() }

  /**
   * Run the simulation synchronously for `durationMs` of sim-time.
   * Used for unit tests — bypasses requestAnimationFrame entirely.
   */
  runSync(durationMs: number, stepMs = 100): EngineSnapshot {
    for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
      this.advance(Math.min(stepMs, durationMs - elapsed))
    }
    return this.getSnapshot()
  }

  getSnapshot(): EngineSnapshot {
    const nodeMetrics = new Map<string, NodeMetrics>()
    for (const [id, node] of this.nodes) {
      nodeMetrics.set(id, node.getMetrics())
    }
    const req = this.level?.requirements
    const holdProgress = req
      ? Math.min(1, this.holdTimer / (req.holdDurationSeconds * 1000))
      : 0
    return {
      nodeMetrics,
      globalMetrics: this.computeGlobalMetrics(),
      animationEvents: [],
      simTimeSec: this.simClock / 1000,
      requirementsMet: holdProgress > 0,
      holdProgress,
      won: this.won,
    }
  }

  // ─── Main loop ─────────────────────────────────────────────────────────────

  private loop(): void {
    if (!this.running || typeof requestAnimationFrame === 'undefined') return
    this.rafHandle = requestAnimationFrame(() => {
      const now = performance.now()
      const realDelta = now - this.realClock
      this.realClock = now

      if (this.speed > 0) {
        const simDelta = realDelta * this.speed
        this.advance(simDelta)
      }

      this.emitSnapshot()
      this.loop()
    })
  }

  private advance(simDeltaMs: number): void {
    const target = this.simClock + simDeltaMs

    // Pre-generate traffic events for the upcoming window
    if (this.trafficSource) {
      const newEvents = (this.trafficSource as TrafficSource).generateEvents(target)
      newEvents.forEach(e => this.queue.push(e))
    }

    // Process failure events from level definition
    this.processFailureEvents(target)

    // Drain event queue up to target sim-time
    while (!this.queue.isEmpty() && this.queue.peek()!.time <= target) {
      const event = this.queue.pop()!
      const node = this.nodes.get(event.nodeId)
      if (!node) continue

      // Handle recovery events directly — notify load balancers too
      if (event.kind === 'node_recover') {
        ;(node as { recover?: () => void }).recover?.()
        this.notifyLoadBalancers('up', event.nodeId)
        continue
      }

      // Count each request once on arrival, not per output event
      if (event.request) this.totalRequests++

      const outEvents = node.process(event, event.time)

      for (const out of outEvents) {
        if (out.kind === 'drop') {
          this.droppedRequests++
        } else {
          this.queue.push(out)
          if (event.request) {
            this.pendingAnimations.push({
              requestId: event.request.id,
              fromNodeId: event.nodeId,
              toNodeId: out.nodeId,
              startTime: this.realClock,
              durationMs: ANIMATION_SPEED_MS,
              type: event.request.type,
              dropped: false,
            })
          }
        }
      }
    }

    // Tick all nodes — collect any events emitted (e.g. MessageQueue drain)
    for (const node of this.nodes.values()) {
      const tickEvents = node.tick(target, simDeltaMs)
      for (const e of tickEvents) {
        this.queue.push(e)
        if (e.request) {
          this.pendingAnimations.push({
            requestId: e.request.id,
            fromNodeId: node.config.id,
            toNodeId: e.nodeId,
            startTime: this.realClock,
            durationMs: ANIMATION_SPEED_MS,
            type: e.request.type,
            dropped: false,
          })
        }
      }
    }

    // Collect latency samples (approximate from node metrics)
    for (const node of this.nodes.values()) {
      const m = node.getMetrics()
      if (m.latencyMs > 0 && m.requestsProcessed > 0) {
        this.latencySamples.push(m.latencyMs)
        if (this.latencySamples.length > 500) this.latencySamples.shift()
      }
    }

    // Update uptime tracker — only meaningful when traffic is actually flowing.
    // Counting idle ticks (zero traffic) as "healthy" would let players win without
    // connecting any nodes, since errorRate = 0/0 trivially passes every threshold.
    if (this.totalRequests > 0) {
      this.uptimeChecks.total++
      const errorRate = this.droppedRequests / this.totalRequests
      if (errorRate < 0.01) this.uptimeChecks.ok++
    }

    // Check win condition
    if (this.level && !this.won) {
      const req = this.level.requirements
      const global = this.computeGlobalMetrics()

      // Require the system to be serving at least the configured minimum RPS
      // (defaults to 1 so "no traffic at all" never wins).
      const minRps = req.minThroughputRps ?? 1
      const met =
        global.throughputRps >= minRps &&
        global.p99LatencyMs  <= req.maxP99LatencyMs &&
        global.uptimePercent >= req.minUptimePercent &&
        global.monthlyCostUsd <= req.maxMonthlyCostUsd
      if (met) {
        this.holdTimer += simDeltaMs
        if (this.holdTimer >= req.holdDurationSeconds * 1000) this.won = true
      } else {
        this.holdTimer = 0
      }
    }

    this.simClock = target
  }

  private processFailureEvents(upToSimTimeMs: number): void {
    if (!this.level) return
    for (const fe of this.level.failureEvents) {
      const feMs = fe.atSeconds * 1000
      if (feMs > this.simClock && feMs <= upToSimTimeMs) {
        if (fe.type === 'node_crash' && fe.targetNodeId) {
          const node = this.nodes.get(fe.targetNodeId) as { crash?: () => void } | undefined
          node?.crash?.()
          this.notifyLoadBalancers('down', fe.targetNodeId)
          // Schedule recovery
          if (fe.durationSeconds) {
            this.queue.push({
              time: feMs + fe.durationSeconds * 1000,
              kind: 'node_recover',
              nodeId: fe.targetNodeId,
            })
          }
        }
      }
    }
  }

  /** Tell all load balancers in the graph that a node went up or down. */
  private notifyLoadBalancers(state: 'up' | 'down', nodeId: string): void {
    for (const node of this.nodes.values()) {
      if (node instanceof LoadBalancer) {
        if (state === 'down') node.markDown(nodeId)
        else node.markUp(nodeId)
      }
    }
  }

  private emitSnapshot(): void {
    if (!this.onSnapshot) return
    const nodeMetrics = new Map<string, NodeMetrics>()
    for (const [id, node] of this.nodes) {
      nodeMetrics.set(id, node.getMetrics())
    }

    const global = this.computeGlobalMetrics()
    const req = this.level?.requirements
    const holdProgress = req
      ? Math.min(1, this.holdTimer / (req.holdDurationSeconds * 1000))
      : 0

    this.onSnapshot({
      nodeMetrics,
      globalMetrics: global,
      animationEvents: this.drainAnimations(),
      simTimeSec: this.simClock / 1000,
      requirementsMet: holdProgress > 0,
      holdProgress,
      won: this.won,
    })
  }

  private computeGlobalMetrics(): GlobalMetrics {
    const sorted = [...this.latencySamples].sort((a, b) => a - b)
    const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0

    // When no traffic-carrying ticks have been recorded yet, uptime is undefined;
    // report 100 as "not measured" — the minThroughputRps check in the win condition
    // ensures this doesn't let idle systems win.
    const uptime = this.uptimeChecks.total > 0
      ? (this.uptimeChecks.ok / this.uptimeChecks.total) * 100
      : 100

    const errorRate = this.totalRequests > 0 ? this.droppedRequests / this.totalRequests : 0

    let cost = 0
    for (const node of this.nodes.values()) {
      cost += node.config.monthlyCostUsd ?? 0
    }

    const simSec = this.simClock / 1000
    const throughput = simSec > 0 ? this.totalRequests / simSec : 0

    return {
      throughputRps: Math.round(throughput),
      p99LatencyMs: Math.round(p99),
      errorRate,
      uptimePercent: parseFloat(uptime.toFixed(2)),
      monthlyCostUsd: cost,
    }
  }

  private drainAnimations(): AnimationEvent[] {
    const out = [...this.pendingAnimations]
    this.pendingAnimations = []
    return out
  }

  private reset(): void {
    this.queue.clear()
    this.nodes.clear()
    this.trafficSource = null
    this.simClock = 0
    this.latencySamples = []
    this.totalRequests = 0
    this.droppedRequests = 0
    this.uptimeChecks = { ok: 0, total: 0 }
    this.holdTimer = 0
    this.won = false
    this.pendingAnimations = []
  }

  // ─── Node factory ──────────────────────────────────────────────────────────

  private createNode(cfg: NodeConfig, level: LevelDefinition): SimNode {
    switch (cfg.type) {
      case 'traffic_source':
        return new TrafficSource(cfg, level.traffic)
      case 'web_server':
        return new WebServer(cfg)
      case 'sql_db':
        return new SqlDatabase(cfg)
      case 'cache': {
        const cache = new Cache(cfg)
        cache.workingSetGb = level.traffic.workingSetGb ?? 4
        return cache
      }
      case 'load_balancer':
        return new LoadBalancer(cfg)
      case 'rate_limiter':
        return new RateLimiter(cfg)
      case 'message_queue':
        return new MessageQueue(cfg)
      case 'worker':
        return new Worker(cfg)
      default:
        return new WebServer({ ...cfg, type: 'web_server' })
    }
  }
}
