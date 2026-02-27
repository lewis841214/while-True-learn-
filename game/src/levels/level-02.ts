import type { LevelDefinition } from '../engine/types'

/**
 * Level 2 — Traffic Crunch
 *
 * 1,200 RPS, 90% reads.  The small DB looks fine on paper (2,000 read cap)
 * but write-contention math kills you: 120 writes/s eat 3× connection-pool
 * slots, collapsing effective read capacity to ~560 RPS.  1,080 reads × 1.93×
 * over capacity → p99 explodes.
 *
 * Fix: upgrade the DB from Small → Medium in the config panel.
 * Cost check: $150 (web/M) + $300 (db/M) = $450 < $600 budget.
 */
export const level02: LevelDefinition = {
  id: 'level-02',
  chapter: 1,
  title: 'Traffic Crunch',
  brief:
    'Your app went viral overnight. 1,200 requests per second are hitting a ' +
    'stack that was only sized for a fraction of that. ' +
    'The web server looks okay, but something is clearly wrong. Find the bottleneck ' +
    'and fix it without blowing the budget.',
  concept: 'Write-contention degrades database read capacity. Tier up the right component.',
  primerRef: 'Database',

  traffic: {
    baseRps: 1200,
    readWriteRatio: 0.9,
    pattern: 'steady',
    workingSetGb: 2,
  },

  requirements: {
    maxP99LatencyMs: 200,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 600,
    holdDurationSeconds: 20,
    minThroughputRps: 960,
  },

  availableComponents: ['sql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'small', locked: false },
  ],

  failureEvents: [],

  hints: [
    'Click the database node and look at its utilization.',
    'Even though reads are within the 2,000 RPS read cap, writes penalise the connection pool — effective read capacity is much lower.',
    'Upgrade the SQL DB to Medium tier in the config panel.',
  ],

  winMessage: 'Database upgraded. Write-contention is manageable now — latency is back in range.',
  tradeoffWarning: 'A larger DB is pricier. In a real system you\'d also consider read replicas.',
}
