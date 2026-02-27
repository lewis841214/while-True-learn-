import type { LevelDefinition } from '../engine/types'

/**
 * Level 19 — Build a URL Shortener  (Chapter 8 · Capstone)
 *
 * Open-canvas capstone. No pre-placed components (except locked Traffic Source).
 * Traffic: 10 000 RPS, 90% reads (redirect lookups), 10% writes (new short URLs).
 *
 * There is no single correct solution — the simulator grades on SLA metrics only.
 *
 * One valid architecture:
 *   src → LB → 3× Med Web → Cache (read path) → NoSQL DB
 *                          → Rate Limiter (write path) → NoSQL DB
 *
 * Requirements: p99 ≤ 30ms (redirects must be fast), 99.9% uptime, budget $1 500.
 *
 * Key learning: reads (redirects) dominate — optimise for read latency.
 * Cache hit rate is high because a small number of URLs are accessed frequently (Pareto).
 * Writes (short URL creation) can afford higher latency.
 */
export const level19: LevelDefinition = {
  id: 'level-19',
  chapter: 8,
  title: 'URL Shortener',
  brief:
    'Design a URL shortener serving 10 000 RPS. ' +
    '90 % of requests are redirects (reads) — they must resolve in under 30 ms. ' +
    '10 % are new short URL creation (writes). Budget: $1 500/mo.',
  concept:
    'URL shorteners are read-dominated. A cache in front of the database ' +
    'achieves a very high hit rate because a small fraction of URLs ' +
    'generate most of the traffic (power-law distribution). ' +
    'This is your first open-canvas design challenge.',
  primerRef: 'Design a URL shortening service like bit.ly',

  traffic: {
    baseRps: 10_000,
    readWriteRatio: 0.90,
    pattern: 'steady',
    workingSetGb: 5,
  },

  requirements: {
    maxP99LatencyMs: 30,
    minUptimePercent: 99.9,
    maxMonthlyCostUsd: 1_500,
    holdDurationSeconds: 45,
    minThroughputRps: 8_000,
  },

  availableComponents: [
    'load_balancer', 'web_server', 'cache', 'cdn',
    'sql_db', 'nosql_db', 'rate_limiter', 'message_queue', 'worker',
  ],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
  ],

  failureEvents: [],

  hints: [
    'Start with the read path: Traffic → LB → Web Servers → Cache → DB.',
    '90% reads means cache hit rate determines your p99. Use a Medium Cache for a large hot set.',
    'NoSQL DB excels here: key-value lookups (shortcode → URL) at 8ms, no joins needed.',
    'For writes: add a Rate Limiter before the DB to protect it from write bursts.',
    'Target: 3× Medium Web ($300) + Medium Cache ($50) + Medium NoSQL ($200) = ~$600. Budget is ample.',
    'Add a CDN if p99 is still too high — CDN serves cached redirects in 5ms.',
  ],

  winMessage:
    'Congratulations — you designed a production-grade URL shortener! ' +
    'At 10 000 RPS with 30ms p99, this architecture handles bit.ly-scale traffic. ' +
    'The cache is the hero: ~85% hit rate means only 1 500 RPS reaches the database.',
}
