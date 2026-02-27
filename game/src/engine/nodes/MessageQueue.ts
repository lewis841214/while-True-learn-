import type { NodeConfig, NodeMetrics, SimEvent } from '../types'
import { BaseNode, TIER_IDX } from './BaseNode'

// Throughput = rate at which the MQ releases buffered events downstream (RPS)
const THROUGHPUT_RPS = [200,   500,    2_000]
const BUFFER_LIMIT   = [20_000, 100_000, 500_000]
const BASE_LATENCY   = [3,      2,       1]
const COSTS          = [30,     80,      200]

/**
 * Pull-based message queue.
 *
 * process() stores incoming events in an internal buffer without forwarding them.
 * tick() releases batches of buffered events to downstream nodes at the configured
 * throughput rate — this is the true pull-based throttle that protects downstream
 * nodes from write bursts.
 *
 * Utilization reflects buffer fullness (0 = empty, 1 = full).
 * Events are only dropped when the buffer is completely full.
 */
export class MessageQueue extends BaseNode {
  private buffer: Array<{ request: SimEvent['request'] }> = []
  private rrIndex = 0

  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
  }

  private get throughputRps(): number { return THROUGHPUT_RPS[TIER_IDX[this.config.tier]] }
  private get bufferLimit():    number { return BUFFER_LIMIT[TIER_IDX[this.config.tier]] }

  // capacity/overflowQueueLimit satisfy BaseNode abstract contract but
  // aren't used since we override process() entirely.
  get capacity(): number           { return this.throughputRps }
  get baseLatencyMs(): number      { return BASE_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return 0 }

  // Show buffer fullness as utilization, not arrival rate
  override get utilization(): number {
    return this.buffer.length / this.bufferLimit
  }

  // ─── Accept and buffer incoming events ──────────────────────────────────────

  override process(event: SimEvent, now: number): SimEvent[] {
    if (this._status === 'down') return this.dropRequest(event.request, now)

    if (this.buffer.length < this.bufferLimit) {
      this.buffer.push({ request: event.request })
      this.processed++
      this.queueDepth = this.buffer.length
      return []   // event buffered — not forwarded yet
    }

    return this.dropRequest(event.request, now)
  }

  // ─── Release buffered events at throughput rate ──────────────────────────────

  override tick(now: number, deltaMs: number): SimEvent[] {
    super.tick(now, deltaMs)
    this.queueDepth = this.buffer.length

    if (this._status === 'down' || this.buffer.length === 0) return []

    const downstream = this.config.downstreamNodeIds ?? []
    if (downstream.length === 0) return []

    // Release up to throughputRps * elapsed seconds worth of events
    const toRelease = Math.max(1, Math.round(this.throughputRps * deltaMs / 1000))
    const count = Math.min(toRelease, this.buffer.length)
    const batch = this.buffer.splice(0, count)
    this.queueDepth = this.buffer.length

    return batch.map(item => {
      const target = downstream[this.rrIndex % downstream.length]
      this.rrIndex++
      return {
        time: now + this.baseLatencyMs,
        kind: 'process' as const,
        nodeId: target,
        request: item.request,
      }
    })
  }

  override getMetrics(): NodeMetrics {
    return {
      nodeId: this.config.id,
      utilization: this.utilization,
      latencyMs: this.baseLatencyMs,
      queueDepth: this.buffer.length,
      requestsProcessed: this.processed,
      requestsDropped: this.dropped,
      status: this._status,
    }
  }

  override reset(): void {
    super.reset()
    this.buffer = []
    this.rrIndex = 0
  }
}
