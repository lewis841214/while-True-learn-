import type { LevelDefinition } from '../engine/types'

/**
 * Level 18 — Graceful Degradation  (Chapter 7 · Reliability at Scale)
 *
 * 5 000 RPS, 70% reads. Traffic spike at t=10s (×3 = 15 000 RPS for 20s).
 * Pre-placed: src (spike), LB, 2× Med Web, Cache, SQL DB (all locked).
 *
 * During the spike:
 *   - Cache absorbs 80% of reads → 2 250 reads reach DB
 *   - Write rate: 4 500 RPS × 30% = 1 350 writes/s
 *   - Total DB: 2 250 + 1 350 = 3 600 RPS → exceeds Medium SQL capacity
 *
 * Fix: add a Rate Limiter in front of the DB to shed excess load gracefully.
 * Rate limit writes to 1 000 RPS and reads to 1 500 RPS during the spike.
 * Writes that exceed the limit get 429s (fast fail) rather than 30s timeouts.
 *
 * Players learn: fast fail (429) is better than slow fail (timeout).
 * Graceful degradation = return 429s quickly rather than bogging down.
 */
export const level18: LevelDefinition = {
  id: 'level-18',
  chapter: 7,
  title: 'Graceful Degradation',
  brief:
    '5 000 RPS steady — then at t=10 s a ×3 traffic spike hits for 20 seconds. ' +
    'The database can\'t absorb 15 000 RPS and will time out. ' +
    'Protect it with a rate limiter that returns fast 429 errors instead of slow timeouts.',
  concept:
    'Graceful degradation: when a system is overloaded it should reject requests ' +
    'quickly (429 Too Many Requests) rather than queue them until they time out. ' +
    'Users get instant feedback and can retry — instead of waiting 30 s for nothing.',
  primerRef: 'Rate limiting',

  traffic: {
    baseRps: 5_000,
    readWriteRatio: 0.70,
    pattern: 'spike',
    spikeAtSeconds: 10,
    spikeMultiplier: 3,
    spikeDurationSeconds: 20,
    workingSetGb: 20,
  },

  requirements: {
    maxP99LatencyMs: 80,
    minUptimePercent: 97,
    maxMonthlyCostUsd: 1_200,
    holdDurationSeconds: 30,
    minThroughputRps: 4_000,
  },

  availableComponents: ['rate_limiter', 'cache', 'nosql_db', 'load_balancer'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'cache',          tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'medium', locked: true },
  ],

  failureEvents: [],

  hints: [
    'Run the sim. Steady state is fine. At t=10 s the ×3 spike overwhelms the DB.',
    'The cache handles 80% of reads — but the DB still gets 3 000+ RPS during the spike.',
    'Add a Rate Limiter between the web servers and the DB. Set it to ~2 000 RPS.',
    'Requests above the limit get instant 429s — the DB p99 stays low, errors are visible but fast.',
    'Upgrade the Rate Limiter to Medium tier for higher throughput headroom during normal load.',
    'The goal: p99 ≤ 80ms even during the spike. Fast 429s count as errors but not slow responses.',
  ],

  winMessage:
    'The rate limiter shed excess load with instant 429s. ' +
    'p99 stayed low because the DB never queued requests — it simply rejected overflow. ' +
    '"Fail fast" is a core resilience pattern.',
  tradeoffWarning:
    'Rate limiting rejects valid requests. During the spike, some users got 429s. ' +
    'Use token-bucket rate limiting (per-user) rather than global limits to be fair to individuals.',
}
