import type { LevelDefinition } from '../engine/types'

/**
 * Level 12 — The Slow Consumer  (Chapter 5 · Async Patterns Deep)
 *
 * 2 000 RPS, 100% writes.  Pre-placed: src, LB, 2× Med Web, Small MQ (locked).
 * Without workers the MQ has no downstream: writes queue up and p99 never resolves.
 *
 * Fix: add 4 Medium Workers (200 RPS each = 800 total) + Medium SQL DB.
 *   4 workers can only process 800/2 000 = 40% of the arriving writes.
 *   Queue depth grows → error rate rises → fails.
 *
 *   Correct fix: 10 Small Workers (100 RPS each = 1 000 RPS)
 *     OR 5 Medium Workers (200 each = 1 000 RPS).
 *   With 1 000 RPS workers and 2 000 arriving: workers process everything slowly
 *   but MQ absorbs the burst. Wait — we need worker capacity >= write RPS.
 *   5 Med Workers × 200 = 1 000 RPS > 2 000? No, 1 000 < 2 000.
 *   Use 10 Small Workers = 1 000 RPS... still < 2 000.
 *   Actually with pull-based MQ the queue drains at worker rate (1 000 RPS).
 *   Backlog builds at 1 000/s but never drops (just delayed). p99 will include queuing.
 *
 *   For level 12, let's require 10× Small Workers (1000 RPS) for a $300 budget:
 *   $20 + $50 + 2×$100 + $30 (MQ) + 10×$50 (workers) + $100 (DB) = $900 → over budget.
 *
 *   Simplify: 2 000 RPS writes → use Large Workers (500 RPS each).
 *   4 Large Workers = 2 000 RPS. Cost: 4 × $200 = $800.
 *   Total: $20+$50+2×$100+$30+$800+$100 = $1 200 > budget $900.
 *   Hmm.
 *
 *   Simpler scenario: 800 RPS writes.
 *   4 Small Workers (100 RPS each) = 400 RPS → not enough.
 *   Need 8 Small Workers = 800 RPS, cost 8×$50=$400 + $100 DB = $500 total $870.
 *   Player starts with 2 workers, sees queue depth build, adds 6 more.
 *
 * Revised: 800 RPS writes. 4× Small Worker pre-placed (insufficient). Add more workers.
 */
export const level12: LevelDefinition = {
  id: 'level-12',
  chapter: 5,
  title: 'The Slow Consumer',
  brief:
    '800 RPS, all writes. The message queue is filling up because the worker ' +
    'pool can\'t keep pace. Queue depth is climbing and messages are starting ' +
    'to be dropped. Scale the worker pool to drain the backlog.',
  concept:
    'Back-pressure occurs when producers generate work faster than consumers ' +
    'can process it. The queue absorbs the burst, but if consumers are ' +
    'permanently slower than producers the queue will overflow and messages drop.',
  primerRef: 'Asynchronous workflows',

  traffic: {
    baseRps: 800,
    readWriteRatio: 0.00,   // 100% writes
    pattern: 'steady',
    workingSetGb: 5,
  },

  requirements: {
    maxP99LatencyMs: 400,
    minUptimePercent: 98,
    maxMonthlyCostUsd: 900,
    holdDurationSeconds: 30,
    minThroughputRps: 640,
  },

  availableComponents: ['worker', 'sql_db', 'nosql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'message_queue',  tier: 'small',  locked: true },
    { type: 'worker',         tier: 'small',  locked: false },
    { type: 'worker',         tier: 'small',  locked: false },
  ],

  failureEvents: [],

  hints: [
    'Run the sim. Each Small Worker processes 100 RPS — 2 workers = 200 RPS total.',
    '800 writes/s arrive but only 200 drain. Queue depth rises, messages drop.',
    'Add more Small Workers from the toolbar. Wire them: MQ → Worker → DB.',
    'You need 8 Small Workers × 100 RPS = 800 RPS total to match the write rate.',
    'Connect all workers to a NoSQL DB ($80) — it handles write bursts without SQL contention.',
  ],

  winMessage:
    'Worker pool matched the write rate — queue depth is stable, no drops. ' +
    'This is auto-scaling: adding consumer instances to match producer throughput.',
  tradeoffWarning:
    'More workers mean more concurrent writes to the database. Ensure the DB tier ' +
    'can handle all workers writing simultaneously (8 × 100 = 800 RPS).',
}
