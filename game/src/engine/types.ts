// ─── Request ────────────────────────────────────────────────────────────────

export type RequestType = 'read' | 'write'

export interface Request {
  id: string
  type: RequestType
  createdAt: number   // sim-time ms when generated
  path: string[]      // node IDs visited in order
}

// ─── Events ─────────────────────────────────────────────────────────────────

export type SimEventKind = 'process' | 'drop' | 'health_check' | 'node_crash' | 'node_recover'

export interface SimEvent {
  time: number          // sim-time ms when this event fires
  kind: SimEventKind
  nodeId: string
  request?: Request
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface NodeMetrics {
  nodeId: string
  utilization: number     // 0.0 – 1.0
  latencyMs: number       // current effective latency
  queueDepth: number
  requestsProcessed: number
  requestsDropped: number
  status: 'healthy' | 'degraded' | 'down'
}

export interface GlobalMetrics {
  throughputRps: number
  p99LatencyMs: number
  errorRate: number       // 0.0 – 1.0
  uptimePercent: number
  monthlyCostUsd: number
}

// ─── Animation ───────────────────────────────────────────────────────────────

export interface AnimationEvent {
  requestId: string
  fromNodeId: string
  toNodeId: string
  startTime: number     // real-time ms (for animation interpolation)
  durationMs: number
  type: RequestType
  dropped: boolean
}

// ─── Component config ────────────────────────────────────────────────────────

export type Tier = 'small' | 'medium' | 'large'

export type NodeType =
  | 'traffic_source'
  | 'load_balancer'
  | 'web_server'
  | 'sql_db'
  | 'nosql_db'
  | 'cache'
  | 'cdn'
  | 'message_queue'
  | 'worker'
  | 'rate_limiter'

export interface NodeConfig {
  id: string
  type: NodeType
  tier: Tier
  locked?: boolean          // if true, node cannot be deleted from canvas
  // policy choices — each node type reads what it needs
  algorithm?: 'round_robin' | 'least_connections' | 'ip_hash'
  healthCheckIntervalMs?: number
  replicationMode?: 'none' | 'master_slave' | 'master_master'
  consistencyModel?: 'eventual' | 'strong'
  evictionPolicy?: 'lru' | 'lfu' | 'ttl'
  writeStrategy?: 'cache_aside' | 'write_through' | 'write_behind'
  cacheStrategy?: 'pull' | 'push'
  deliveryGuarantee?: 'at_most_once' | 'at_least_once' | 'exactly_once'
  ordering?: 'unordered' | 'fifo'
  rateLimitRps?: number
  rateLimitAlgorithm?: 'token_bucket' | 'leaky_bucket' | 'sliding_window'
  rejectBehavior?: 'drop_429' | 'queue'
  // populated by SimulationEngine from level definition
  downstreamNodeIds?: string[]
  monthlyCostUsd?: number
}

// ─── SimNode interface ────────────────────────────────────────────────────────

export interface SimNode {
  readonly config: NodeConfig
  /** Receive a request, return new events (forwarded or error events). */
  process(event: SimEvent, now: number): SimEvent[]
  /** Called every engine tick; may return new events (e.g. MessageQueue drain). */
  tick(now: number, deltaMs: number): SimEvent[]
  getMetrics(): NodeMetrics
  reset(): void
}

// ─── Graph definition (used by engine) ───────────────────────────────────────

export interface GraphEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
}

// ─── Level definition ────────────────────────────────────────────────────────

export interface TrafficConfig {
  baseRps: number
  readWriteRatio: number        // fraction that are reads (0–1)
  pattern: 'steady' | 'ramp' | 'spike'
  spikeAtSeconds?: number
  spikeMultiplier?: number
  spikeDurationSeconds?: number
  workingSetGb?: number
}

export interface LevelRequirements {
  maxP99LatencyMs: number
  minUptimePercent: number
  maxMonthlyCostUsd: number
  holdDurationSeconds: number   // how long all reqs must hold simultaneously
  /** Minimum throughput the system must be serving. Defaults to 1 RPS if absent.
   *  Prevents trivially winning by having no traffic flow through the graph. */
  minThroughputRps?: number
}

export interface FailureEvent {
  atSeconds: number
  type: 'node_crash' | 'traffic_spike'
  targetNodeId?: string
  durationSeconds?: number
}

export interface LevelDefinition {
  id: string
  chapter: number
  title: string
  brief: string
  concept: string
  primerRef: string
  traffic: TrafficConfig
  requirements: LevelRequirements
  availableComponents: NodeType[]
  prePlaced: Array<{ type: NodeType; tier: Tier; locked: boolean }>
  failureEvents: FailureEvent[]
  hints: string[]
  winMessage: string
  tradeoffWarning?: string
}
