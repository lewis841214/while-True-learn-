import type { NodeConfig, SimEvent } from '../types'
import { BaseNode, TIER_IDX } from './BaseNode'

const MAX_MEMORY_GB  = [1,      8,       64]
const OPS_CAPACITY   = [50_000, 200_000, 1_000_000]
const BASE_LATENCY   = [1,      0.5,     0.2]
const COSTS          = [30,     100,     300]

const POLICY_FACTOR: Record<string, number> = {
  lru: 0.95,
  lfu: 0.98,
  ttl: 0.85,
}

export class Cache extends BaseNode {
  /** Set by engine from level definition */
  workingSetGb = 4

  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
  }

  get capacity(): number           { return OPS_CAPACITY[TIER_IDX[this.config.tier]] }
  get baseLatencyMs(): number      { return BASE_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return 1_000 }

  get memoryGb(): number { return MAX_MEMORY_GB[TIER_IDX[this.config.tier]] }

  get hitRate(): number {
    const rawHitRate = Math.min(1.0, this.memoryGb / this.workingSetGb)
    const policy = this.config.evictionPolicy ?? 'lru'
    return rawHitRate * (POLICY_FACTOR[policy] ?? 0.95)
  }

  process(event: SimEvent, now: number): SimEvent[] {
    if (this._status === 'down') return this.dropRequest(event.request, now)

    const req = event.request
    const isRead = req?.type === 'read'

    // Writes always pass through to DB (cache-aside default)
    if (!isRead) return this.forwardEvents(req, now)

    const hit = Math.random() < this.hitRate
    if (hit) {
      // Cache hit — serve directly, no downstream
      this.processed++
      return []   // request satisfied here
    }

    // Cache miss — forward to downstream (DB)
    this.processed++
    return this.forwardEvents(req, now)
  }
}
