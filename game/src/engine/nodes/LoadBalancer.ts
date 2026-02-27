import type { NodeConfig, SimEvent } from '../types'
import { BaseNode, TIER_IDX } from './BaseNode'

const CAPACITIES   = [1_000,  10_000,  100_000]
const BASE_LATENCY = [2,      1,       0.5]
const COSTS        = [20,     60,      150]

export class LoadBalancer extends BaseNode {
  private rrIndex = 0
  private healthyNodes: Set<string> = new Set()
  private connectionCounts: Map<string, number> = new Map()
  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: COSTS[TIER_IDX[config.tier]] })
    // Populate from config — downstreamNodeIds is known at construction time
    ;(config.downstreamNodeIds ?? []).forEach(id => {
      this.healthyNodes.add(id)
      this.connectionCounts.set(id, 0)
    })
  }

  get capacity(): number           { return CAPACITIES[TIER_IDX[this.config.tier]] }
  get baseLatencyMs(): number      { return BASE_LATENCY[TIER_IDX[this.config.tier]] }
  get overflowQueueLimit(): number { return 500 }

  /** Called by engine to register which downstream nodes exist. */
  initHealthyNodes(nodeIds: string[]): void {
    nodeIds.forEach(id => {
      this.healthyNodes.add(id)
      this.connectionCounts.set(id, 0)
    })
  }

  markDown(nodeId: string): void  { this.healthyNodes.delete(nodeId) }
  markUp(nodeId: string): void    { this.healthyNodes.add(nodeId) }

  process(event: SimEvent, now: number): SimEvent[] {
    if (this._status === 'down') return this.dropRequest(event.request, now)

    const healthy = [...this.healthyNodes]
    if (healthy.length === 0) return this.dropRequest(event.request, now)

    const target = this.pickTarget(healthy)
    if (!target) return this.dropRequest(event.request, now)

    this.processed++
    const latency = this.effectiveLatencyMs
    this.connectionCounts.set(target, (this.connectionCounts.get(target) ?? 0) + 1)

    const req = event.request
      ? { ...event.request, path: [...(event.request.path ?? []), this.config.id] }
      : event.request

    return [{
      time: now + latency,
      kind: 'process',
      nodeId: target,
      request: req,
    }]
  }

  private pickTarget(healthy: string[]): string | undefined {
    if (healthy.length === 0) return undefined
    const algo = this.config.algorithm ?? 'round_robin'

    if (algo === 'round_robin') {
      const target = healthy[this.rrIndex % healthy.length]
      this.rrIndex++
      return target
    }

    if (algo === 'least_connections') {
      return healthy.reduce((best, id) =>
        (this.connectionCounts.get(id) ?? 0) < (this.connectionCounts.get(best) ?? 0) ? id : best
      )
    }

    // ip_hash — deterministic but we simulate with round-robin for MVP (no client IPs)
    const target = healthy[this.rrIndex % healthy.length]
    this.rrIndex++
    return target
  }

  tick(now: number, deltaMs: number): SimEvent[] {
    super.tick(now, deltaMs)
    this.connectionCounts.forEach((count, id) => {
      this.connectionCounts.set(id, Math.max(0, count - 1))
    })
    return []
  }

  reset(): void {
    super.reset()
    this.rrIndex = 0
    this.connectionCounts.clear()
    this.healthyNodes = new Set(this.config.downstreamNodeIds ?? [])
  }
}
