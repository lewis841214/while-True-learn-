import type { LevelDefinition } from '../engine/types'

/**
 * Level 5 — Read Cache
 *
 * 2,000 RPS, 95% reads, 4 GB working set.
 * Pre-placed: src (locked) → LB (locked) → Web/M (locked) → DB/S (locked).
 *
 * Without cache: 1,900 reads vs effective DB cap of ~800 (write-contention
 * penalty) → severely overloaded.
 *
 * Fix: add Cache/Medium (8 GB) between Web and DB.
 * Hit rate = min(1, 8/4) × 0.95 = 0.95 → DB sees only ~5% of reads = ~95/s.
 * Total: $20 + $150 + $100 + $100 = $370 < $450.
 */
export const level05: LevelDefinition = {
  id: 'level-05',
  chapter: 2,
  title: 'Read Cache',
  brief:
    '2,000 requests per second, 95% of them reads.  The database is melting — ' +
    'its connection pool is saturated by the read flood.  ' +
    'You need to protect it without touching the budget ceiling of $450/month.',
  concept: 'A well-sized cache deflects the majority of reads, keeping the database in a healthy operating range.',
  primerRef: 'Cache',

  traffic: {
    baseRps: 2000,
    readWriteRatio: 0.95,
    pattern: 'steady',
    workingSetGb: 4,
  },

  requirements: {
    maxP99LatencyMs: 150,
    minUptimePercent: 99.5,
    maxMonthlyCostUsd: 450,
    holdDurationSeconds: 20,
    minThroughputRps: 1600,
  },

  availableComponents: ['cache'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small',  locked: true },
    { type: 'load_balancer',  tier: 'small',  locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'small',  locked: true },
  ],

  failureEvents: [],

  hints: [
    'Watch the DB utilisation — it is running well above safe capacity.',
    'Add a Cache node between the Web Server and the Database.',
    'The working set is 4 GB. A Medium cache (8 GB) fits it entirely — expect ~95% hit rate.',
    'After adding the cache, reconnect: Web → Cache → DB.',
  ],

  winMessage: 'Cache hit rate 95%. The database is down to ~5% utilisation — protected.',
  tradeoffWarning: 'Cache misses still reach the DB. If your working set grows beyond the cache size, hit rate drops.',
}
