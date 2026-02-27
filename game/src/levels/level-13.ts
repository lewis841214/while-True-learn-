import type { LevelDefinition } from '../engine/types'

/**
 * Level 13 — Fan-Out  (Chapter 5 · Async Patterns Deep)
 *
 * 1 000 RPS, 100% writes (event bus pattern).
 * Pre-placed: src, LB, 2× Med Web, Small MQ (locked).
 * Player must connect THREE independent worker→db pipelines (email, analytics, search).
 * Each pipeline processes the same events independently.
 *
 * The MQ forwards all events to all downstream nodes (broadcast = fan-out).
 * Each downstream chain gets 1 000 events/s independently.
 *
 * Solution:
 *   MQ → Worker-Email (Small, 100 RPS × 10 = 1000? No: each worker is independent here)
 *   Actually: MQ broadcasts to 3 workers (each gets 1000 RPS).
 *   Each worker must handle 1000 RPS alone → use Large Worker (500 RPS × 2 per chain).
 *   Simpler: 2 Medium Workers per chain (200×2 = 400? still not 1000).
 *   Use: 5 Small Workers per chain (5×100 = 500 RPS) – but each chain is one path.
 *   Fan-out concept: the MQ sends each write to ALL downstream consumers.
 *   So if MQ → WorkerA + WorkerB + WorkerC, each worker receives ALL 1000 writes.
 *   Each worker must handle 1000 RPS: needs Large Worker (500 RPS) × 2 per chain.
 *
 * Let's simplify: 300 RPS writes, 3 consumer pipelines.
 *   Each Large Worker (500 RPS) handles all 300 writes with ease.
 *   Cost: $20+$50+2×$100+$30 MQ +3×($200 LW+$80 NoSQL) = $300+$830 = ~$1130 < $1400.
 */
export const level13: LevelDefinition = {
  id: 'level-13',
  chapter: 5,
  title: 'Fan-Out',
  brief:
    '300 RPS of events need to be processed by three independent consumers: ' +
    'an email notifier, an analytics pipeline, and a search indexer. ' +
    'The message queue must broadcast each event to all three pipelines simultaneously.',
  concept:
    'Fan-out (pub/sub) delivers one event to multiple independent consumers. ' +
    'Each consumer maintains its own queue position and processes events at ' +
    'its own pace — slow consumers don\'t block fast ones.',
  primerRef: 'Asynchronous workflows',

  traffic: {
    baseRps: 300,
    readWriteRatio: 0.00,   // 100% writes (events)
    pattern: 'steady',
    workingSetGb: 2,
  },

  requirements: {
    maxP99LatencyMs: 500,
    minUptimePercent: 98,
    maxMonthlyCostUsd: 1_400,
    holdDurationSeconds: 30,
    minThroughputRps: 240,
  },

  availableComponents: ['worker', 'nosql_db', 'sql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'message_queue',  tier: 'small',  locked: true },
  ],

  failureEvents: [],

  hints: [
    'The MQ broadcasts every event to ALL its downstream connections — this is fan-out.',
    'Add three Workers from the toolbar and connect MQ → Worker1, MQ → Worker2, MQ → Worker3.',
    'Each worker represents a different consumer (email, analytics, search index).',
    'Each worker receives all 300 RPS independently. Wire each worker to its own NoSQL DB.',
    'A Large Worker ($200) can handle 500 RPS — one per consumer pipeline is sufficient.',
  ],

  winMessage:
    'Three independent consumers, each processing every event. The MQ decouples ' +
    'producers from consumers — adding a fourth consumer requires zero changes to the producers.',
  tradeoffWarning:
    'Fan-out multiplies infrastructure cost: each consumer needs its own storage. ' +
    'At high event rates (100k+ RPS), fan-out can exhaust memory in the broker.',
}
