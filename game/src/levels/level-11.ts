import type { LevelDefinition } from '../engine/types'

/**
 * Level 11 — Cache or Pay  (Chapter 4 · Data at Scale)
 *
 * 10 000 RPS, 95% reads, 5% writes. Working set 200 GB.
 * Pre-placed: src, LB, 3× Large Web (locked), Large SQL DB (locked).
 *   Large SQL DB: 50 000 read cap → 9 500 reads/s = 19% util → healthy? YES.
 *   BUT 9 500 reads × 5ms latency hits p99 just fine on paper.
 *   Monthly cost however: $50 LB + 3×$300 web + $800 DB = $1 750 → WAY over $1 200.
 *
 * Fix: downgrade web servers to Medium, add a Small Cache.
 *   Small Cache ($50): 80% hit rate on 200 GB → passes ~2 000 reads to DB.
 *   DB only sees 2 000 reads/s → can use a Medium DB ($300).
 *   Savings: 3 × ($300→$100) web = $600 saved; ($800→$300) db = $500 saved.
 *   Final: $50+$50+3×$100+$50+$300 = $750 < $1 200.
 *
 * (The locking forces users to buy everything pre-placed; they can still downgrade tiers.)
 */
export const level11: LevelDefinition = {
  id: 'level-11',
  chapter: 4,
  title: 'Cache or Pay',
  brief:
    '10 000 RPS, 95 % reads. The system works — but the monthly bill is $1 750, ' +
    'way over the $1 200 budget. Introduce a cache to absorb the read traffic ' +
    'and downgrade the oversized components.',
  concept:
    'A cache in front of the database absorbs repeated reads for hot data. ' +
    'At an 80% hit rate, only 20% of reads reach the database, allowing you ' +
    'to use a smaller, cheaper database tier.',
  primerRef: 'Cache',

  traffic: {
    baseRps: 10_000,
    readWriteRatio: 0.95,
    pattern: 'steady',
    workingSetGb: 200,
  },

  requirements: {
    maxP99LatencyMs: 50,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 1_200,
    holdDurationSeconds: 30,
    minThroughputRps: 8_000,
  },

  availableComponents: ['cache', 'sql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'large',  locked: false },
    { type: 'web_server',     tier: 'large',  locked: false },
    { type: 'web_server',     tier: 'large',  locked: false },
    { type: 'sql_db',         tier: 'large',  locked: false },
  ],

  failureEvents: [],

  hints: [
    'Run the sim. Metrics are healthy, but the monthly cost is ~$1 750 — over budget.',
    'The bottleneck is not performance, it\'s cost. You need to shrink expensive nodes.',
    'Add a Small Cache between the web servers and the database.',
    'The cache has a ~60% hit rate for this 200 GB working set — it reduces DB reads significantly.',
    'Downgrade web servers from Large to Medium, then downgrade the DB from Large to Medium.',
    'Verify p99 still meets 50ms after downgrades — use the metrics.',
  ],

  winMessage:
    'Cache cut DB reads by 60%, letting you downgrade to cheaper tiers. ' +
    'Caching is often the highest-ROI optimisation in read-heavy systems.',
  tradeoffWarning:
    'Cache invalidation is hard. Stale data in the cache can persist until TTL expires, ' +
    'meaning reads may see an old version of data after a write.',
}
