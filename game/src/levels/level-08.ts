import type { LevelDefinition } from '../engine/types'

/**
 * Level 8 — Worker Pool
 *
 * 1,500 RPS, 70% writes.  Pre-placed: src, LB/small, web1/small, web2/small,
 * MQ/medium (all locked).
 *
 * The MQ releases 500 RPS to its downstream.  Without workers, you'd connect
 * MQ → DB directly — but the DB would need to be Medium anyway.
 * The lesson: workers are the consumers that pull from the queue in parallel.
 * A single Small Worker (300 RPS capacity) can't keep up with 500 RPS from
 * the MQ → its queue fills, requests drop.  Two workers share the 500 RPS
 * load (250 each at ~83% util) and together forward sustainably to the DB.
 *
 * Solution: 2 × Worker/Small ($50 each) + DB/Medium ($300).
 * Cost: $20+$50+$50+$80+$100+$300 = $600 < $700.
 */
export const level08: LevelDefinition = {
  id: 'level-08',
  chapter: 3,
  title: 'Worker Pool',
  brief:
    '1,500 requests per second — 70% writes — are flowing through a Medium ' +
    'Message Queue that releases 500 writes/second to its consumers.  ' +
    'You need to process those writes fast enough and feed a database that ' +
    'can handle the sustained load.  ' +
    'One worker is not enough. Build a pool.',
  concept: 'Worker pools parallelize queue consumption. Scale the pool until throughput matches the queue release rate.',
  primerRef: 'Asynchronous workflows',

  traffic: {
    baseRps: 1500,
    readWriteRatio: 0.30,   // 30% reads, 70% writes
    pattern: 'steady',
    workingSetGb: 2,
  },

  requirements: {
    maxP99LatencyMs: 200,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 700,
    holdDurationSeconds: 30,
    minThroughputRps: 1200,
  },

  availableComponents: ['worker', 'sql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small',  locked: true },
    { type: 'load_balancer',  tier: 'small',  locked: true },
    { type: 'web_server',     tier: 'small',  locked: true },
    { type: 'web_server',     tier: 'small',  locked: true },
    { type: 'message_queue',  tier: 'medium', locked: true },
  ],

  failureEvents: [],

  hints: [
    'Run with one Small Worker — watch its utilisation. It will hit 100% and start dropping.',
    'A Small Worker handles 300 RPS; the queue releases 500 RPS. You need at least two.',
    'Add a second Small Worker, both connected downstream of the Message Queue.',
    'Add a Medium SQL DB as the final destination — it handles the 500 writes/s comfortably.',
    'Wire: MQ → Worker1 + Worker2 → DB.',
  ],

  winMessage: 'Two workers sharing the load. Each runs at 83% — busy but not dropping. The database is protected.',
  tradeoffWarning:
    'More workers = more cost and coordination overhead. In production, auto-scaling worker counts based on queue depth is the standard approach.',
}
