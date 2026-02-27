import type { LevelDefinition } from '../engine/types'

/**
 * Level 9 — Writes Don't Scale  (Chapter 4 · Data at Scale)
 *
 * 3 000 RPS, 60% writes → 1 800 writes/s.
 * Pre-placed: src, LB, 2× Med Web (locked).
 * A Medium SQL DB is already connected and immediately overwhelmed:
 *   write cap 2 000 → 90% util → s-curve multiplier ~4× → p99 > 300ms.
 *
 * Fix: replace the SQL DB with a Medium NoSQL DB (same $200).
 *   NoSQL handles 25 000 RPS writes + reads with no write-read contention.
 *   Latency stays at 8ms flat. Cost is identical.
 *
 * Cost ceiling: $20 src + $50 LB + $100+$100 web + $200 nosql = $470 < $600.
 */
export const level09: LevelDefinition = {
  id: 'level-09',
  chapter: 4,
  title: 'Writes Don\'t Scale',
  brief:
    '3 000 RPS, 60 % writes.  The relational database cannot handle the write ' +
    'storm — connection-pool contention is exploding p99 to 400 ms.  ' +
    'You need a storage engine designed for write-heavy workloads.',
  concept:
    'NoSQL databases (Cassandra, DynamoDB) use append-only write paths and ' +
    'eventual consistency to absorb massive write throughput without the ' +
    'shared-lock bottleneck of RDBMS engines.',
  primerRef: 'NoSQL databases',

  traffic: {
    baseRps: 3_000,
    readWriteRatio: 0.40,   // 40% reads, 60% writes
    pattern: 'steady',
    workingSetGb: 20,
  },

  requirements: {
    maxP99LatencyMs: 80,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 600,
    holdDurationSeconds: 30,
    minThroughputRps: 2_400,
  },

  availableComponents: ['nosql_db', 'cache'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'medium', locked: false },
  ],

  failureEvents: [],

  hints: [
    'Run the simulation — watch the SQL DB write utilisation and p99.',
    'The Medium SQL DB has a write cap of 2 000 RPS. With 1 800 writes/s it hits 90% and latency explodes.',
    'Delete the SQL DB. Add a Medium NoSQL DB from the toolbar. Wire the same connections.',
    'NoSQL has no write-read contention — both reads and writes share a 25 000 RPS pool at 8 ms flat.',
    'Cost is identical: both Medium SQL and Medium NoSQL cost $200.',
  ],

  winMessage:
    'NoSQL absorbed 1 800 writes/s with ease. Notice: there is no join support and ' +
    'no foreign-key consistency — you traded guarantees for throughput.',
  tradeoffWarning:
    'NoSQL uses eventual consistency. Reads immediately after writes may return ' +
    'stale data until replication propagates (~milliseconds to seconds).',
}
