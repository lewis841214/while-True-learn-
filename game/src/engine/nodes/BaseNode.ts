import type { NodeConfig, NodeMetrics, SimEvent, SimNode } from '../types'

/** Shared S-curve latency degradation used by all component types. */
export function scurveMultiplier(utilization: number): number {
  if (utilization <= 0.50) return 1.0
  if (utilization <= 0.80) return 1.0 + ((utilization - 0.50) / 0.30) * 1.0
  if (utilization <= 0.95) return 2.0 + ((utilization - 0.80) / 0.15) * 3.0
  return 5.0 + (utilization - 0.95) * 40   // very steep above 95%
}

/**
 * Abstract base for all SimNodes.
 *
 * Utilization is tracked as a sliding 1-second window of request arrivals.
 * `capacity` is the RPS the node can sustain before latency starts degrading.
 * This maps correctly to DES where each event is processed individually.
 */
export abstract class BaseNode implements SimNode {
  readonly config: NodeConfig

  // Sliding window: sim-timestamps (ms) of requests in the last 1000ms
  private requestWindow: number[] = []
  private lastPruneTime = 0

  protected queueDepth = 0
  protected processed = 0
  protected dropped = 0
  protected _status: NodeMetrics['status'] = 'healthy'

  constructor(config: NodeConfig) {
    this.config = config
  }

  abstract get capacity(): number        // max sustainable RPS
  abstract get baseLatencyMs(): number
  abstract get overflowQueueLimit(): number

  // ─── Utilization (rate-based, sliding window) ───────────────────────────────

  /** Prune window entries older than 1 second. Called every tick. */
  private pruneWindow(now: number): void {
    const cutoff = now - 1000
    let i = 0
    while (i < this.requestWindow.length && this.requestWindow[i] < cutoff) i++
    if (i > 0) this.requestWindow.splice(0, i)
    this.lastPruneTime = now
  }

  /** Requests processed in the last 1-second window = current RPS. */
  get currentRps(): number {
    return this.requestWindow.length
  }

  get utilization(): number {
    return Math.min(1.0, this.currentRps / this.capacity)
  }

  get effectiveLatencyMs(): number {
    return this.baseLatencyMs * scurveMultiplier(this.utilization)
  }

  // ─── Event helpers ──────────────────────────────────────────────────────────

  protected forwardEvents(request: SimEvent['request'], now: number): SimEvent[] {
    const downstream = this.config.downstreamNodeIds ?? []
    if (downstream.length === 0 || !request) return []
    return downstream.map(nodeId => ({
      time: now + this.effectiveLatencyMs,
      kind: 'process' as const,
      nodeId,
      request: { ...request, path: [...(request.path ?? []), this.config.id] },
    }))
  }

  protected dropRequest(request: SimEvent['request'], now: number): SimEvent[] {
    this.dropped++
    return [{ time: now, kind: 'drop' as const, nodeId: this.config.id, request }]
  }

  // ─── Core process / tick ────────────────────────────────────────────────────

  process(event: SimEvent, now: number): SimEvent[] {
    if (this._status === 'down') return this.dropRequest(event.request, now)

    // Over capacity: queue or drop
    if (this.utilization >= 1.0) {
      if (this.queueDepth < this.overflowQueueLimit) {
        this.queueDepth++
        // Extra latency for queued requests — proportional to queue depth
      } else {
        return this.dropRequest(event.request, now)
      }
    } else if (this.queueDepth > 0) {
      this.queueDepth--
    }

    // Record this request in the sliding window
    this.requestWindow.push(now)
    this.processed++

    const out = this.forwardEvents(event.request, now)
    this._updateStatus()
    return out
  }

  tick(now: number, _delta: number): SimEvent[] {
    this.pruneWindow(now)
    this._updateStatus()
    return []
  }

  private _updateStatus(): void {
    if (this._status === 'down') return
    this._status = this.utilization > 0.95 ? 'degraded' : 'healthy'
  }

  crash():   void { this._status = 'down' }
  recover(): void {
    this._status = 'healthy'
    this.requestWindow = []
    this.queueDepth = 0
  }

  getMetrics(): NodeMetrics {
    return {
      nodeId: this.config.id,
      utilization: this.utilization,
      latencyMs: this.effectiveLatencyMs,
      queueDepth: this.queueDepth,
      requestsProcessed: this.processed,
      requestsDropped: this.dropped,
      status: this._status,
    }
  }

  reset(): void {
    this.requestWindow = []
    this.lastPruneTime = 0
    this.queueDepth = 0
    this.processed = 0
    this.dropped = 0
    this._status = 'healthy'
  }
}

// Tier index helper — shared across node files
export const TIER_IDX = { small: 0, medium: 1, large: 2 } as const
