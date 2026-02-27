import type { NodeConfig } from '../types'
import { BaseNode, TIER_IDX } from './BaseNode'

// Workers are async processors that sit downstream of a MessageQueue.
// They represent consumer processes pulling jobs from the queue.
const CAPACITIES      = [300,   1_000,  5_000]
const BASE_LATENCY    = [30,    15,     5]
const QUEUE_LIMITS    = [100,   500,    2_000]
const COSTS           = [50,    150,    400]

export class Worker extends BaseNode {
  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
  }

  get capacity(): number           { return CAPACITIES[TIER_IDX[this.config.tier]] }
  get baseLatencyMs(): number      { return BASE_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return QUEUE_LIMITS[TIER_IDX[this.config.tier]] }
}
