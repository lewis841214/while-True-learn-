import type { NodeConfig, NodeMetrics, Request, SimEvent, SimNode, TrafficConfig } from '../types'

let reqCounter = 0
function newRequest(type: Request['type'], now: number): Request {
  return { id: `req-${++reqCounter}`, type, createdAt: now, path: [] }
}

/** Poisson inter-arrival: exponential distribution with rate λ = 1/rps */
function poissonDelay(rps: number): number {
  return -Math.log(1 - Math.random()) * (1000 / rps)
}

export class TrafficSource implements SimNode {
  readonly config: NodeConfig
  private traffic: TrafficConfig
  private nextEventTime = 0
  private generated = 0

  constructor(config: NodeConfig, traffic: TrafficConfig) {
    this.config = config
    this.traffic = traffic
  }

  /** Generate all request-arrival events up to `untilTime` sim-ms. */
  generateEvents(untilTime: number): SimEvent[] {
    const events: SimEvent[] = []
    const downstream = this.config.downstreamNodeIds ?? []
    if (downstream.length === 0) return events

    while (this.nextEventTime <= untilTime) {
      const rps = this.currentRps(this.nextEventTime)
      if (rps <= 0) { this.nextEventTime += 100; continue }

      const type: Request['type'] =
        Math.random() < this.traffic.readWriteRatio ? 'read' : 'write'

      const req = newRequest(type, this.nextEventTime)
      const target = downstream[this.generated % downstream.length]

      events.push({
        time: this.nextEventTime,
        kind: 'process',
        nodeId: target,
        request: req,
      })

      this.generated++
      this.nextEventTime += poissonDelay(rps)
    }

    return events
  }

  private currentRps(simTimeMs: number): number {
    const simTimeSec = simTimeMs / 1000
    const base = this.traffic.baseRps
    const pattern = this.traffic.pattern

    if (pattern === 'ramp') {
      return base * Math.min(1, simTimeSec / 60)  // ramp over 60s
    }

    if (pattern === 'spike') {
      const spikeAt = (this.traffic.spikeAtSeconds ?? 30)
      const spikeDur = (this.traffic.spikeDurationSeconds ?? 15)
      const mult = this.traffic.spikeMultiplier ?? 10
      if (simTimeSec >= spikeAt && simTimeSec < spikeAt + spikeDur) {
        return base * mult
      }
    }

    return base
  }

  // TrafficSource doesn't process incoming events
  process(_event: SimEvent, _now: number): SimEvent[] { return [] }
  tick(_now: number, _deltaMs: number): SimEvent[] { return [] }

  getMetrics(): NodeMetrics {
    return {
      nodeId: this.config.id,
      utilization: 0,
      latencyMs: 0,
      queueDepth: 0,
      requestsProcessed: this.generated,
      requestsDropped: 0,
      status: 'healthy',
    }
  }

  reset(): void {
    this.nextEventTime = 0
    this.generated = 0
    reqCounter = 0
  }
}
