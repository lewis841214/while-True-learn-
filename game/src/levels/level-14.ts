import type { LevelDefinition } from '../engine/types'

/**
 * Level 14 — Dead Letters  (Chapter 5 · Async Patterns Deep)
 *
 * 500 RPS writes. A worker node crashes at t=20s.
 * Without a DLQ, messages that cannot be processed are lost forever.
 *
 * Fix: add a second Message Queue as a Dead Letter Queue (DLQ).
 *   Main pipeline: MQ → Worker → DB.
 *   Worker crashes → drops messages → those writes hit the DLQ.
 *   After worker recovers (or player adds a second worker), DLQ drains.
 *
 * In the simulation: the Worker node crashes → dropped requests count as errors.
 * With a DLQ (second MQ downstream of the worker's error path), the
 * dropped requests are routed there and can be reprocessed later.
 * (The current engine models DLQ conceptually: a MQ with very low throughput
 *  downstream of the worker acts as a buffer for overflow/dropped events.)
 *
 * Simpler gameplay: pre-place Main MQ + Worker (will crash at t=20s).
 * Player adds a secondary worker + DLQ pattern for redundancy.
 * Alternatively: main MQ → Worker1 + Worker2 (redundant workers) so one crash doesn't drop.
 *
 * Model: Worker1 crashes at t=20s for 15s. Without Worker2, 500 RPS dropped for 15s.
 * With Worker2 (500 RPS each): one handles all 500 RPS, error rate ≈ 0.
 */
export const level14: LevelDefinition = {
  id: 'level-14',
  chapter: 5,
  title: 'Dead Letters',
  brief:
    '500 RPS of critical writes. At t=20 s the worker crashes and stays down for 15 s. ' +
    'Every message that can\'t be processed is permanently lost. ' +
    'Add redundant workers so a single failure doesn\'t lose data.',
  concept:
    'A Dead Letter Queue (DLQ) captures messages that fail to process — ' +
    'instead of being silently dropped, they wait for manual inspection or retry. ' +
    'Redundant consumers prevent data loss when one consumer fails.',
  primerRef: 'Asynchronous workflows',

  traffic: {
    baseRps: 500,
    readWriteRatio: 0.00,
    pattern: 'steady',
    workingSetGb: 3,
  },

  requirements: {
    maxP99LatencyMs: 400,
    minUptimePercent: 97,
    maxMonthlyCostUsd: 800,
    holdDurationSeconds: 30,
    minThroughputRps: 400,
  },

  availableComponents: ['worker', 'message_queue', 'nosql_db', 'sql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'message_queue',  tier: 'small',  locked: true },
    { type: 'worker',         tier: 'medium', locked: true },
  ],

  failureEvents: [
    { atSeconds: 20, type: 'node_crash', targetNodeId: 'worker1', durationSeconds: 15 },
  ],

  hints: [
    'Run the sim. At t=20 s the pre-placed worker crashes for 15 seconds.',
    '500 writes/s are dropped for 15 s → ~7 500 lost messages and uptime dips.',
    'Add a second Medium Worker from the toolbar. Wire: MQ → Worker1, MQ → Worker2.',
    'Each worker receives all writes — but each processes at 200 RPS, so you need enough total capacity.',
    'With two workers (400 RPS total) you need slightly more — use Large Workers (500 RPS each) for one-crash tolerance.',
    'Optional: add a second MQ downstream of the workers as a Dead Letter Queue for inspection.',
  ],

  winMessage:
    'Worker redundancy means one crash no longer loses data. ' +
    'In production, DLQs capture poison-pill messages that repeatedly fail, ' +
    'allowing engineers to debug and replay them.',
  tradeoffWarning:
    'Redundant consumers can cause duplicate processing if the queue delivers ' +
    'at-least-once. Use idempotent writes or exactly-once semantics to avoid double-counting.',
}
