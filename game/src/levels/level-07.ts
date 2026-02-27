import type { LevelDefinition } from '../engine/types'

/**
 * Level 7 — Write Queue
 *
 * 600 RPS, 80% writes.  Pre-placed: src, LB, web1, web2, db/small (all locked).
 *
 * Without MQ, webs send 480 writes/s directly to the Small DB (write cap 500).
 * At 96% write utilisation the s-curve multiplier kicks in hard — write latency
 * jumps to ~5× baseline → p99 well over 300ms.
 *
 * Fix: add a Small Message Queue between the web servers and the DB.
 *   MQ buffers all incoming writes and releases 200/s to the DB.
 *   DB write utilisation drops to 40% → latency back to baseline 50ms.
 *   Queue depth grows slowly but stays well within the 20,000-item buffer
 *   for the 30s hold window (480-200 = 280 accumulate/s → 8,400 items < 20,000).
 *
 * Cost: $20+$50+$50+$30+$100 = $250 < $350.
 */
export const level07: LevelDefinition = {
  id: 'level-07',
  chapter: 3,
  title: 'Write Queue',
  brief:
    '600 requests per second, 80% of them writes.  The database is buckling ' +
    'under the write load — at 96% write capacity, every write takes 5× longer ' +
    'than normal and the p99 is through the roof.  ' +
    'Decouple the producers from the database with a message queue.',
  concept: 'A message queue buffers writes and releases them at a controlled rate, protecting the database from write storms.',
  primerRef: 'Asynchronous workflows',

  traffic: {
    baseRps: 600,
    readWriteRatio: 0.20,   // 20% reads, 80% writes
    pattern: 'steady',
    workingSetGb: 1,
  },

  requirements: {
    maxP99LatencyMs: 300,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 350,
    holdDurationSeconds: 30,
    minThroughputRps: 480,
  },

  availableComponents: ['message_queue'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'small', locked: true },
    { type: 'web_server',     tier: 'small', locked: true },
    { type: 'sql_db',         tier: 'small', locked: true },
  ],

  failureEvents: [],

  hints: [
    'Run the simulation and watch the DB utilisation and write latency.',
    'Add a Small Message Queue from the toolbar.',
    'Wire: Web Servers → Queue → DB.  The queue sits between the producers and the database.',
    'The Small MQ releases writes at 200 RPS — the DB write utilisation drops from 96% to 40%.',
    'Watch the queue depth metric grow. The buffer absorbs the burst without dropping events.',
  ],

  winMessage: 'The database is protected. The queue depth shows the backlog — writes are being drained safely.',
  tradeoffWarning:
    'Writes are now asynchronous — a consumer reading immediately after writing may see stale data. ' +
    'This is an "at-least-once" delivery tradeoff.',
}
