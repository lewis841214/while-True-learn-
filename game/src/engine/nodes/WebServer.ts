import type { NodeConfig } from '../types'
import { BaseNode, TIER_IDX } from './BaseNode'

// capacity = max sustainable RPS (not concurrent slots — model is rate-based)
const CAPACITIES    = [500,  2_000,  8_000]
const BASE_LATENCY  = [50,   30,   20]
const QUEUE_LIMITS  = [200,  500,  1_000]
const COSTS         = [50,   150,  400]

export class WebServer extends BaseNode {
  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
  }

  get capacity(): number        { return CAPACITIES[TIER_IDX[this.config.tier]] }
  get baseLatencyMs(): number   { return BASE_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return QUEUE_LIMITS[TIER_IDX[this.config.tier]] }
}
