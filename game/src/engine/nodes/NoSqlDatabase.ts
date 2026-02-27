import type { NodeConfig } from '../types'
import { BaseNode, TIER_IDX } from './BaseNode'

// NoSQL (Cassandra / DynamoDB style):
// - No write/read contention — writes and reads use independent capacity pools
// - Much higher throughput than SQL, especially on writes
// - Latency is flat (no connection-pool serialisation penalty)
const CAPACITY    = [5_000,  25_000,  100_000]  // RPS (reads AND writes share same pool)
const BASE_LATENCY = [15,    8,       5]
const COSTS        = [80,    200,     600]

export class NoSqlDatabase extends BaseNode {
  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
  }

  get capacity():           number { return CAPACITY[TIER_IDX[this.config.tier]] }
  get baseLatencyMs():      number { return BASE_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return 500 }
}
