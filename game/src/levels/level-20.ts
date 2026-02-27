import type { LevelDefinition } from '../engine/types'

/**
 * Level 20 — Social Feed  (Chapter 8 · Capstone)
 *
 * Final capstone. Open-canvas. No pre-placed components except locked Traffic Source.
 * Traffic: 20 000 RPS, 70% reads (feed render), 30% writes (new posts).
 *
 * Key challenge: writes fan out to followers. If a celebrity (1M followers)
 * posts, naively pushing to all followers synchronously would create 1M writes.
 * Model: fan-out write amplification represented as a spike.
 *
 * A valid architecture:
 *   src → CDN (static assets) → LB → 5× Med Web →
 *     Reads: Cache (hot feed) → NoSQL DB
 *     Writes: MQ → 5× Workers → NoSQL DB
 *       Workers handle fan-out asynchronously — slow but guaranteed.
 *
 * Budget $2 000/mo. Requirements: p99 ≤ 50ms, uptime 99.9%, min throughput 16 000 RPS.
 */
export const level20: LevelDefinition = {
  id: 'level-20',
  chapter: 8,
  title: 'Social Feed',
  brief:
    'Design a social feed serving 20 000 RPS. ' +
    '70 % are feed reads (must be fast), 30 % are new posts. ' +
    'At t=30 s a ×2 traffic spike simulates a viral moment. ' +
    'Budget: $2 000/mo.',
  concept:
    'Social feeds mix read-heavy timelines with write-amplified fan-out. ' +
    'The read path needs aggressive caching; the write path needs an async queue ' +
    'to absorb fan-out spikes without overwhelming the database.',
  primerRef: 'Design a social media site like Twitter',

  traffic: {
    baseRps: 20_000,
    readWriteRatio: 0.70,
    pattern: 'spike',
    spikeAtSeconds: 30,
    spikeMultiplier: 2,
    spikeDurationSeconds: 30,
    workingSetGb: 100,
  },

  requirements: {
    maxP99LatencyMs: 50,
    minUptimePercent: 99.9,
    maxMonthlyCostUsd: 2_000,
    holdDurationSeconds: 45,
    minThroughputRps: 16_000,
  },

  availableComponents: [
    'cdn', 'load_balancer', 'web_server', 'cache',
    'sql_db', 'nosql_db', 'rate_limiter', 'message_queue', 'worker',
  ],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
  ],

  failureEvents: [],

  hints: [
    'Separate the read path from the write path from the start.',
    'Reads: LB → Web Servers → Large Cache → NoSQL DB. The cache is critical for feed renders.',
    'Writes: Web Servers → Message Queue → Workers → NoSQL DB. Async fan-out protects the DB.',
    'Add a CDN before the LB to absorb static content — reduces origin load by 80%.',
    'During the ×2 spike at t=30 s, the MQ buffers the surge. Workers drain it at their own pace.',
    'Scale CDN to Medium, Cache to Large, NoSQL to Medium. Monitor p99 and error rate during spike.',
    'Budget hint: CDN $60 + LB $50 + 4× Med Web $400 + Lg Cache $200 + Med NoSQL $200 + Sm MQ $30 + 4× Med Worker $800 = ~$1 740.',
  ],

  winMessage:
    'You\'ve designed a Twitter-scale social feed! The CDN and cache absorb most reads; ' +
    'the async queue handles write fan-out without blocking users. ' +
    'This is the architecture behind Instagram, Twitter, and TikTok. Congratulations!',
  tradeoffWarning:
    'Feed cache means users may not see posts instantly after publishing (eventual consistency). ' +
    'Twitter calls this "eventual timeline consistency" — generally acceptable for social content.',
}
