import type { NodeConfig, SimEvent } from '../types'
import { BaseNode, TIER_IDX } from './BaseNode'

// CDN edge (Cloudflare / CloudFront style):
// - Read requests are served at edge (hitRate) or forwarded to origin (miss)
// - Write requests always pass through to origin
// - Hit rate can be set via config; tier provides the upper bound
const HIT_RATE    = [0.80, 0.90, 0.95]   // default per tier
const BASE_LATENCY = [5,   3,    2]       // ms for edge-served (cache hit)
const CAPACITY     = [50_000, 500_000, 5_000_000]
const COSTS        = [20,     60,      200]

export class CdnNode extends BaseNode {
  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
  }

  get capacity():           number { return CAPACITY[TIER_IDX[this.config.tier]] }
  get baseLatencyMs():      number { return BASE_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return 1_000 }

  private get hitRate(): number { return HIT_RATE[TIER_IDX[this.config.tier]] }

  process(event: SimEvent, now: number): SimEvent[] {
    if (this._status === 'down') return this.dropRequest(event.request, now)

    const req = event.request
    if (!req) return []

    // Writes always go to origin
    if (req.type === 'write') return super.process(event, now)

    // Reads: serve at edge with probability = hitRate
    if (Math.random() < this.hitRate) {
      // Cache hit — record as processed, no downstream events
      this.processed++
      return []
    }

    // Cache miss — forward to origin (with CDN latency added)
    return super.process(event, now)
  }
}
