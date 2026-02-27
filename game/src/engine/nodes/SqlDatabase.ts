import type { NodeConfig, SimEvent } from '../types'
import { BaseNode, TIER_IDX, scurveMultiplier } from './BaseNode'

const READ_CAPACITY  = [2_000,  10_000,  50_000]
const WRITE_CAPACITY = [500,    2_000,   10_000]
const READ_LATENCY   = [20,     10,      5]
const WRITE_LATENCY  = [50,     20,      10]
const COSTS          = [100,    300,     800]

export class SqlDatabase extends BaseNode {
  // Sliding window for writes (same 1s window approach as BaseNode reads)
  private writeWindow: number[] = []

  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
  }

  private get readCapacity():  number { return READ_CAPACITY[TIER_IDX[this.config.tier]] }
  private get writeCapacity(): number { return WRITE_CAPACITY[TIER_IDX[this.config.tier]] }
  private get writeLatencyMs(): number { return WRITE_LATENCY[TIER_IDX[this.config.tier]] }

  /** Reads are penalised by active write rate (shared connection pool contention).
   *  At 100% write utilisation, read capacity drops to ~30% of baseline.
   *  At 50% write utilisation, ~65% of read capacity remains. */
  get capacity(): number {
    const writeUtil = Math.min(1, this.currentWriteRps / this.writeCapacity)
    return Math.max(1, this.readCapacity * (1 - writeUtil * 0.7))
  }

  get baseLatencyMs(): number      { return READ_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return 300 }

  get currentWriteRps(): number { return this.writeWindow.length }

  process(event: SimEvent, now: number): SimEvent[] {
    if (this._status === 'down') return this.dropRequest(event.request, now)

    const req = event.request
    if (req?.type === 'write') {
      // Check write capacity
      if (this.currentWriteRps >= this.writeCapacity) return this.dropRequest(req, now)

      this.writeWindow.push(now)
      this.processed++
      const writeUtil = Math.min(1, this.currentWriteRps / this.writeCapacity)
      const latency = this.writeLatencyMs * scurveMultiplier(writeUtil)
      return this.forwardEventsFixed(req, now, latency)
    }

    // Read path — uses BaseNode sliding-window capacity (which accounts for write contention)
    return super.process(event, now)
  }

  private forwardEventsFixed(req: SimEvent['request'], now: number, latency: number): SimEvent[] {
    const downstream = this.config.downstreamNodeIds ?? []
    if (downstream.length === 0 || !req) return []
    return downstream.map(nodeId => ({
      time: now + latency,
      kind: 'process' as const,
      nodeId,
      request: { ...req, path: [...(req.path ?? []), this.config.id] },
    }))
  }

  tick(now: number, deltaMs: number): SimEvent[] {
    super.tick(now, deltaMs)
    const cutoff = now - 1000
    let i = 0
    while (i < this.writeWindow.length && this.writeWindow[i] < cutoff) i++
    if (i > 0) this.writeWindow.splice(0, i)
    return []
  }

  reset(): void {
    super.reset()
    this.writeWindow = []
  }
}
