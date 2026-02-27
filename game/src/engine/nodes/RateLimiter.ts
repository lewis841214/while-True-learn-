import type { NodeConfig, SimEvent } from '../types'
import { BaseNode } from './BaseNode'

export class RateLimiter extends BaseNode {
  private tokens: number
  private lastRefill: number = 0
  private windowCounts: number[] = []  // for sliding_window

  constructor(config: NodeConfig) {
    super({ ...config, monthlyCostUsd: 10 })
    this.tokens = config.rateLimitRps ?? 1000
  }

  get capacity(): number           { return this.config.rateLimitRps ?? 1000 }
  get baseLatencyMs(): number      { return 1 }
  get overflowQueueLimit(): number { return 0 }

  process(event: SimEvent, now: number): SimEvent[] {
    if (this._status === 'down') return this.dropRequest(event.request, now)

    const algo = this.config.rateLimitAlgorithm ?? 'token_bucket'
    const allowed = this.checkLimit(algo, now)

    if (!allowed) return this.dropRequest(event.request, now)

    this.processed++
    return this.forwardEvents(event.request, now)
  }

  private checkLimit(algo: string, now: number): boolean {
    const limit = this.config.rateLimitRps ?? 1000

    if (algo === 'token_bucket') {
      const elapsed = now - this.lastRefill
      const refill = (elapsed / 1000) * limit
      this.tokens = Math.min(limit, this.tokens + refill)
      this.lastRefill = now
      if (this.tokens < 1) return false
      this.tokens--
      return true
    }

    if (algo === 'leaky_bucket' || algo === 'sliding_window') {
      // Sliding window: count requests in last 1000ms
      const windowMs = 1000
      const cutoff = now - windowMs
      this.windowCounts = this.windowCounts.filter(t => t > cutoff)
      if (this.windowCounts.length >= limit) return false
      this.windowCounts.push(now)
      return true
    }

    return true
  }

  tick(now: number, deltaMs: number): SimEvent[] {
    super.tick(now, deltaMs)
    return []
  }

  reset(): void {
    super.reset()
    this.tokens = this.config.rateLimitRps ?? 1000
    this.lastRefill = 0
    this.windowCounts = []
  }
}
