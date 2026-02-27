import type { LevelDefinition } from '../engine/types'

/**
 * Level 10 — Shard Your Database  (Chapter 4 · Data at Scale)
 *
 * 6 000 RPS, 50% writes → 3 000 writes/s.
 * A single Medium SQL DB (write cap 2 000) is immediately overwhelmed.
 *
 * Fix: add a Load Balancer in front of three Small SQL DBs.
 *   The DB-LB distributes writes across 3 shards → each shard sees 1 000 writes/s
 *   (50% util) and reads at normal latency.
 *
 * Cost:  $20 + $50 + 2×$100 + DB-LB $50 + 3×$100 = $520 < $700.
 */
export const level10: LevelDefinition = {
  id: 'level-10',
  chapter: 4,
  title: 'Shard Your Database',
  brief:
    '6 000 RPS, 50 % writes. One database can\'t handle 3 000 writes per second. ' +
    'You need to split the data across multiple shards — but first you need a ' +
    'database proxy to route queries to the right shard.',
  concept:
    'Horizontal sharding distributes data across multiple independent database ' +
    'instances. A load balancer in front of the shards acts as a query router, ' +
    'spreading writes and reads evenly to stay within each node\'s capacity.',
  primerRef: 'Sharding',

  traffic: {
    baseRps: 6_000,
    readWriteRatio: 0.50,   // 50% reads, 50% writes
    pattern: 'steady',
    workingSetGb: 50,
  },

  requirements: {
    maxP99LatencyMs: 80,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 700,
    holdDurationSeconds: 30,
    minThroughputRps: 4_800,
  },

  availableComponents: ['sql_db', 'load_balancer', 'cache'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'medium', locked: false },
  ],

  failureEvents: [],

  hints: [
    'One Medium SQL DB has a write cap of 2 000 RPS. With 3 000 writes/s it is over capacity.',
    'Remove the SQL DB. Add a Load Balancer, then connect three Small SQL DBs behind it.',
    'Wire: Web Servers → DB Load Balancer → DB-1, DB-2, DB-3.',
    'The LB round-robins queries: each shard receives ~1 000 writes/s (50% util).',
    'Total cost: 3 × $100 Small SQL + $50 LB = $350 for the data layer.',
  ],

  winMessage:
    'Three shards, each at 50% write utilisation. The proxy distributes queries evenly. ' +
    'Real sharding uses a hash key to deterministically route the same user\'s data to the same shard.',
  tradeoffWarning:
    'Cross-shard joins are impossible. Transactions touching two shards require distributed ' +
    'coordination (2PC) which is expensive and error-prone.',
}
