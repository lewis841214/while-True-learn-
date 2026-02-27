import type { LevelDefinition } from '../engine/types'

/**
 * Level 3 — Budget Crunch
 *
 * 400 RPS, 70% reads.  A Medium web server and a Large database have been
 * pre-provisioned.  Performance is fine, but the $950/mo bill blows the $700
 * budget.  Teach: right-sizing + caching reduces cost without hurting perf.
 *
 * Fix:
 *   1. Downgrade SQL DB Large → Medium  ($800 → $300, saves $500)
 *   2. Add Cache/Medium between web and DB  ($100)
 *      — 8 GB cache, 8 GB working set → ~95% hit rate
 *      — DB barely sees any reads even at the lower tier
 * Total: $150 + $300 + $100 = $550 < $700.
 */
export const level03: LevelDefinition = {
  id: 'level-03',
  chapter: 1,
  title: 'Budget Crunch',
  brief:
    'The system is technically healthy, but engineering just got a bill for $950/month. ' +
    'Your budget is $700. Performance cannot regress — p99 must stay under 200 ms. ' +
    'Find a way to right-size the infrastructure without breaking anything.',
  concept: 'Caching enables you to use a cheaper database tier without sacrificing performance.',
  primerRef: 'Cache',

  traffic: {
    baseRps: 400,
    readWriteRatio: 0.70,
    pattern: 'steady',
    workingSetGb: 8,
  },

  requirements: {
    maxP99LatencyMs: 200,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 700,
    holdDurationSeconds: 20,
    minThroughputRps: 320,
  },

  availableComponents: ['cache', 'sql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small',  locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'large',  locked: false },
  ],

  failureEvents: [],

  hints: [
    'Check the monthly cost display in the top bar — it exceeds the $700 budget.',
    'Click the Large SQL DB and downgrade to Medium — performance is overkill for this traffic.',
    'Add a Medium Cache between the web server and the database to absorb reads.',
    'The 8 GB cache matches the working set perfectly — expect ~95% hit rate.',
  ],

  winMessage: 'Right-sized. The cache absorbs most reads, so the smaller DB barely notices.',
  tradeoffWarning: 'Cache introduces stale-data risk. A TTL eviction policy limits staleness.',
}
